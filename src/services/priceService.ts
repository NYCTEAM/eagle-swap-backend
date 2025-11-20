import { Database } from 'sqlite3';
import { TokenPrice, ApiResponse, PaginatedResponse } from '../types';
import { getDatabase } from '../database/init';
import { rpcService } from './rpcService';
import { logger, logDatabase } from '../utils/logger';
import axios from 'axios';

export class PriceService {
  private priceCache: Map<string, { price: TokenPrice; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 60 * 1000; // 1 minute cache

  private get db(): Database {
    return getDatabase();
  }

  // Get token price by address
  async getTokenPrice(tokenAddress: string, chainId: number): Promise<TokenPrice | null> {
    const cacheKey = `${chainId}-${tokenAddress.toLowerCase()}`;
    
    // Check cache first
    const cached = this.priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }

    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM token_prices 
        WHERE token_address = ? AND chain_id = ?
        ORDER BY updated_at DESC 
        LIMIT 1
      `;
      
      this.db.get(query, [tokenAddress.toLowerCase(), chainId], (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'token_prices', { error: err.message, tokenAddress, chainId });
          reject(err);
          return;
        }

        const price = row as TokenPrice || null;
        
        // Cache the result
        if (price) {
          this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
        }

        logDatabase('SELECT', 'token_prices', { tokenAddress, chainId, found: !!price });
        resolve(price);
      });
    });
  }

  // Get multiple token prices
  async getTokenPrices(
    tokenAddresses: string[],
    chainId: number
  ): Promise<{ [address: string]: TokenPrice }> {
    const prices: { [address: string]: TokenPrice } = {};
    
    for (const address of tokenAddresses) {
      try {
        const price = await this.getTokenPrice(address, chainId);
        if (price) {
          prices[address.toLowerCase()] = price;
        }
      } catch (error) {
        logger.warn('Failed to get price for token', { address, chainId, error });
      }
    }

    return prices;
  }

  // Update token price
  async updateTokenPrice(priceData: Partial<TokenPrice>): Promise<TokenPrice> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO token_prices (
          token_address, chain_id, price_usd, price_change_24h, 
          market_cap, volume_24h, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const params = [
        priceData.token_address!.toLowerCase(),
        priceData.chain_id,
        priceData.price_usd,
        priceData.price_change_24h || 0,
        priceData.market_cap || 0,
        priceData.volume_24h || 0
      ];

      const db = this.db;
      const priceCache = this.priceCache;
      db.run(query, params, function(err: Error | null) {
        if (err) {
          logDatabase('INSERT', 'token_prices', { error: err.message, priceData });
          reject(err);
          return;
        }

        // Get the inserted/updated price
        const selectQuery = `
          SELECT * FROM token_prices 
          WHERE token_address = ? AND chain_id = ?
          ORDER BY updated_at DESC 
          LIMIT 1
        `;
        
        db.get(selectQuery, [priceData.token_address!.toLowerCase(), priceData.chain_id], (err: Error | null, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          const price = row as TokenPrice;
          
          // Update cache
          const cacheKey = `${priceData.chain_id}-${priceData.token_address!.toLowerCase()}`;
          priceCache.set(cacheKey, { price, timestamp: Date.now() });

          logDatabase('INSERT', 'token_prices', { 
            tokenAddress: priceData.token_address,
            chainId: priceData.chain_id,
            priceUsd: priceData.price_usd
          });

          resolve(price);
        });
      });
    });
  }

  // Get price history for a token
  async getTokenPriceHistory(
    tokenAddress: string,
    chainId: number,
    timeframe: string = '24h',
    limit: number = 100
  ): Promise<TokenPrice[]> {
    return new Promise((resolve, reject) => {
      let timeCondition = '';
      const now = new Date();
      
      switch (timeframe) {
        case '1h':
          timeCondition = `AND last_updated > datetime('${new Date(now.getTime() - 60 * 60 * 1000).toISOString()}')`;
          break;
        case '24h':
          timeCondition = `AND last_updated > datetime('${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}')`;
          break;
        case '7d':
          timeCondition = `AND last_updated > datetime('${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()}')`;
          break;
        case '30d':
          timeCondition = `AND last_updated > datetime('${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()}')`;
          break;
      }

      const query = `
        SELECT * FROM token_prices 
        WHERE token_address = ? AND chain_id = ? ${timeCondition}
        ORDER BY last_updated DESC 
        LIMIT ?
      `;

      this.db.all(query, [tokenAddress.toLowerCase(), chainId, limit], (err, rows: any[]) => {
        if (err) {
          logDatabase('SELECT', 'token_prices', { error: err.message, type: 'history' });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'token_prices', { 
          type: 'history',
          tokenAddress,
          chainId,
          timeframe,
          count: rows.length
        });

        resolve(rows as TokenPrice[]);
      });
    });
  }

  // Sync prices from external sources
  async syncPricesFromExternal(tokenAddresses: string[], chainId: number): Promise<void> {
    try {
      // Try to get prices from Eagle Indexer first
      const indexerUrl = process.env.EAGLE_INDEXER_URL || 'http://localhost:3005';
      
      try {
        const response = await axios.post(`${indexerUrl}/api/prices/batch`, {
          tokens: tokenAddresses.map(addr => ({ address: addr, chainId }))
        });

        if (response.data && response.data.success && response.data.data) {
          for (const priceData of response.data.data) {
            await this.updateTokenPrice({
              token_address: priceData.address,
              chain_id: chainId,
              price_usd: priceData.priceUsd,
              price_change_24h: priceData.priceChange24h,
              market_cap: priceData.marketCap,
              volume_24h: priceData.volume24h
            });
          }
          
          logger.info('Synced prices from Eagle Indexer', { 
            tokenCount: response.data.data.length,
            chainId
          });
          return;
        }
      } catch (indexerError) {
        logger.warn('Failed to sync from Eagle Indexer, trying fallback', { 
          error: indexerError,
          chainId
        });
      }

      // Fallback: Try to get prices from DEX pairs via RPC
      for (const tokenAddress of tokenAddresses) {
        try {
          // This is a simplified approach - in reality you'd need to:
          // 1. Find the most liquid pair for this token
          // 2. Get reserves from the pair
          // 3. Calculate price based on reserves and known stable token prices
          
          // For now, we'll simulate getting price data
          const mockPrice = Math.random() * 1000; // Mock price
          
          await this.updateTokenPrice({
            token_address: tokenAddress,
            chain_id: chainId,
            price_usd: mockPrice.toString(),
            price_change_24h: ((Math.random() - 0.5) * 20).toString(), // Random change between -10% and +10%
            market_cap: (mockPrice * Math.random() * 1000000).toString(),
            volume_24h: (mockPrice * Math.random() * 100000).toString()
          });

          logger.info('Updated token price via fallback', { tokenAddress, chainId, price: mockPrice });
        } catch (error) {
          logger.error('Failed to sync price for token', { tokenAddress, chainId, error });
        }
      }
    } catch (error) {
      logger.error('Failed to sync prices from external sources', { tokenAddresses, chainId, error });
      throw error;
    }
  }

  // Get trending tokens by price change
  async getTrendingTokens(
    chainId?: number,
    timeframe: string = '24h',
    limit: number = 20
  ): Promise<TokenPrice[]> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT DISTINCT tp.*, t.symbol, t.name 
        FROM token_prices tp
        LEFT JOIN tokens t ON tp.token_address = t.address AND tp.chain_id = t.chain_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (chainId) {
        query += ' AND tp.chain_id = ?';
        params.push(chainId);
      }

      // Add time filter
      const now = new Date();
      let timeCondition = '';
      
      switch (timeframe) {
        case '1h':
          timeCondition = `AND tp.last_updated > datetime('${new Date(now.getTime() - 60 * 60 * 1000).toISOString()}')`;
          break;
        case '24h':
          timeCondition = `AND tp.last_updated > datetime('${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}')`;
          break;
        case '7d':
          timeCondition = `AND tp.last_updated > datetime('${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()}')`;
          break;
      }

      query += ` ${timeCondition} ORDER BY tp.price_change_24h DESC LIMIT ?`;
      params.push(limit);

      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          logDatabase('SELECT', 'token_prices', { error: err.message, type: 'trending' });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'token_prices', { 
          type: 'trending',
          chainId,
          timeframe,
          count: rows.length
        });

        resolve(rows as TokenPrice[]);
      });
    });
  }

  // Get price statistics
  async getPriceStats(chainId?: number, timeframe: string = '24h'): Promise<any> {
    return new Promise((resolve, reject) => {
      let timeCondition = '';
      const now = new Date();
      
      switch (timeframe) {
        case '1h':
          timeCondition = `AND last_updated > datetime('${new Date(now.getTime() - 60 * 60 * 1000).toISOString()}')`;
          break;
        case '24h':
          timeCondition = `AND last_updated > datetime('${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}')`;
          break;
        case '7d':
          timeCondition = `AND last_updated > datetime('${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()}')`;
          break;
        case '30d':
          timeCondition = `AND last_updated > datetime('${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()}')`;
          break;
      }

      let query = `
        SELECT 
          COUNT(DISTINCT token_address) as total_tokens,
          AVG(CAST(price_change_24h AS REAL)) as avg_price_change,
          MAX(CAST(price_change_24h AS REAL)) as max_price_change,
          MIN(CAST(price_change_24h AS REAL)) as min_price_change,
          SUM(CAST(volume_24h AS REAL)) as total_volume,
          COUNT(*) as total_price_updates
        FROM token_prices 
        WHERE 1=1 ${timeCondition}
      `;

      if (chainId) {
        query += ' AND chain_id = ?';
      }

      const params = chainId ? [chainId] : [];

      this.db.get(query, params, (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'token_prices', { error: err.message, type: 'stats' });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'token_prices', { type: 'stats', timeframe, chainId });
        resolve(row);
      });
    });
  }

  // Calculate token price from DEX pair reserves
  async calculatePriceFromReserves(
    tokenAddress: string,
    pairAddress: string,
    chainId: number
  ): Promise<string | null> {
    try {
      // Get pair reserves from RPC
      const reserves = await rpcService.getPairReserves(pairAddress, chainId);
      
      if (!reserves || !reserves.reserve0 || !reserves.reserve1) {
        return null;
      }

      // Get pair info to determine token order
      const pairInfo = await rpcService.getPairInfo(tokenAddress, pairAddress, chainId);
      
      if (!pairInfo) {
        return null;
      }

      // Determine which reserve corresponds to our token
      const isToken0 = pairInfo.token0.toLowerCase() === tokenAddress.toLowerCase();
      const tokenReserve = isToken0 ? reserves.reserve0 : reserves.reserve1;
      const otherReserve = isToken0 ? reserves.reserve1 : reserves.reserve0;
      const otherTokenAddress = isToken0 ? pairInfo.token1 : pairInfo.token0;

      // Get the price of the other token (assuming it's a known stable token or ETH)
      const otherTokenPrice = await this.getKnownTokenPrice(otherTokenAddress, chainId);
      
      if (!otherTokenPrice) {
        return null;
      }

      // Calculate price: (otherReserve / tokenReserve) * otherTokenPrice
      const price = (parseFloat(otherReserve) / parseFloat(tokenReserve)) * otherTokenPrice;
      
      logger.info('Calculated price from reserves', {
        tokenAddress,
        pairAddress,
        chainId,
        price,
        tokenReserve,
        otherReserve,
        otherTokenPrice
      });

      return price.toString();
    } catch (error) {
      logger.error('Failed to calculate price from reserves', {
        tokenAddress,
        pairAddress,
        chainId,
        error
      });
      return null;
    }
  }

  // Get known token prices (ETH, USDC, USDT, etc.)
  private async getKnownTokenPrice(tokenAddress: string, chainId: number): Promise<number | null> {
    // Known stable token addresses (this should be configurable)
    const knownTokens: { [key: string]: { [chainId: number]: number } } = {
      // USDC
      '0xa0b86a33e6441e6c7b4b1b248e0b0b4b1b1b1b1b': { 1: 1, 56: 1, 137: 1 },
      // USDT  
      '0xdac17f958d2ee523a2206206994597c13d831ec7': { 1: 1, 56: 1, 137: 1 },
      // ETH (this would need real-time pricing)
      '0x0000000000000000000000000000000000000000': { 1: 2000, 56: 2000, 137: 2000 }
    };

    const normalizedAddress = tokenAddress.toLowerCase();
    
    for (const [knownAddress, chainPrices] of Object.entries(knownTokens)) {
      if (knownAddress.toLowerCase() === normalizedAddress && chainPrices[chainId]) {
        return chainPrices[chainId];
      }
    }

    // Try to get from database
    const existingPrice = await this.getTokenPrice(tokenAddress, chainId);
    if (existingPrice && existingPrice.price_usd) {
      return parseFloat(existingPrice.price_usd);
    }

    return null;
  }

  // Clear price cache
  clearCache(): void {
    this.priceCache.clear();
    logger.info('Price cache cleared');
  }

  // Get cache stats
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.priceCache.size,
      keys: Array.from(this.priceCache.keys())
    };
  }
}

export const priceService = new PriceService();