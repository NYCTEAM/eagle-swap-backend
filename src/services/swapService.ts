import { Database } from 'sqlite3';
import { SwapQuote, SwapRoute, Transaction, ApiResponse } from '../types';
import { getDatabase } from '../database/init';
import { rpcService } from './rpcService';
import { logger, logDatabase, logBlockchain } from '../utils/logger';

export class SwapService {
  private get db(): Database {
    return getDatabase();
  }

  // Get swap quote
  async getSwapQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    chainId: number,
    slippage: number = 0.5
  ): Promise<SwapQuote> {
    try {
      // Get quote from RPC service
      const quote = await rpcService.getSwapQuote(tokenIn, tokenOut, amountIn, chainId);
      
      if (!quote) {
        throw new Error('Unable to get swap quote');
      }

      // Calculate slippage
      const amountOutMin = this.calculateAmountOutMin(quote.amountOut, slippage);
      
      const swapQuote: SwapQuote = {
        amountOut: quote.amountOut,
        priceImpact: quote.priceImpact || '0',
        route: quote.route || [],
        gasEstimate: quote.gasEstimate || '0'
      };

      logBlockchain('SWAP', 'Quote', { tokenIn, tokenOut, amountIn, amountOut: quote.amountOut });
      
      return swapQuote;
    } catch (error) {
      logger.error('Failed to get swap quote', { tokenIn, tokenOut, amountIn, chainId, error });
      throw error;
    }
  }

  // Execute swap
  async executeSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    amountOutMin: string,
    userAddress: string,
    chainId: number,
    deadline?: number,
    slippage: number = 0.5
  ): Promise<{ transactionHash: string; transaction: Transaction }> {
    try {
      // Get fresh quote to ensure prices are still valid
      const quote = await this.getSwapQuote(tokenIn, tokenOut, amountIn, chainId, slippage);
      
      // Validate minimum output amount
      if (BigInt(quote.amountOut) < BigInt(amountOutMin)) {
        throw new Error('Price changed, minimum output amount not met');
      }

      // Create transaction record
      const transaction = await this.createTransaction({
        type: 'swap',
        user_address: userAddress,
        token_in: tokenIn.toLowerCase(),
        token_out: tokenOut.toLowerCase(),
        amount_in: amountIn,
        amount_out: quote.amountOut,
        status: 'pending',
        gas_estimate: quote.gasEstimate,
        slippage: slippage
       });

      // In a real implementation, this would interact with a smart contract
      // For now, we'll simulate the transaction hash
      const transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      // Update transaction with hash
      await this.updateTransactionHash(transaction.id!, transactionHash);

      logBlockchain('SWAP', 'Execute', {
        transactionHash,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut: quote.amountOut,
        userAddress
      });

      return {
        transactionHash,
        transaction: { ...transaction, transaction_hash: transactionHash }
      };
    } catch (error) {
      logger.error('Failed to execute swap', {
        tokenIn,
        tokenOut,
        amountIn,
        userAddress,
        chainId,
        error
      });
      throw error;
    }
  }

  // Get swap history for user
  async getSwapHistory(
    userAddress: string,
    page: number = 1,
    limit: number = 20,
    chainId?: number
  ): Promise<{ data: Transaction[]; pagination: any }> {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      let query = `
        SELECT * FROM transactions 
        WHERE user_address = ? AND type = 'swap'
      `;
      let countQuery = `
        SELECT COUNT(*) as total FROM transactions 
        WHERE user_address = ? AND type = 'swap'
      `;
      const params: any[] = [userAddress.toLowerCase()];

      if (chainId) {
        query += ' AND chain_id = ?';
        countQuery += ' AND chain_id = ?';
        params.push(chainId);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      const queryParams = [...params, limit, offset];

      // Get total count
      this.db.get(countQuery, params, (err, countResult: any) => {
        if (err) {
          logDatabase('SELECT', 'transactions', { error: err.message });
          reject(err);
          return;
        }

        const total = countResult.total;

        // Get transactions
        this.db.all(query, queryParams, (err, rows: any[]) => {
          if (err) {
            logDatabase('SELECT', 'transactions', { error: err.message });
            reject(err);
            return;
          }

          logDatabase('SELECT', 'transactions', {
            type: 'swap_history',
            userAddress,
            count: rows.length,
            page,
            limit
          });

          resolve({
            data: rows as Transaction[],
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit)
            }
          });
        });
      });
    });
  }

  // Get transaction by hash
  async getTransactionByHash(hash: string): Promise<Transaction | null> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM transactions WHERE transaction_hash = ?';
      
      this.db.get(query, [hash], (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'transactions', { error: err.message, hash });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'transactions', { hash, found: !!row });
        resolve(row as Transaction || null);
      });
    });
  }

  // Update transaction status
  async updateTransactionStatus(hash: string, status: string, blockNumber?: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let query = 'UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP';
      const params: any[] = [status];

      if (blockNumber) {
        query += ', block_number = ?';
        params.push(blockNumber);
      }

      query += ' WHERE transaction_hash = ?';
      params.push(hash);

      this.db.run(query, params, function(err) {
        if (err) {
          logDatabase('UPDATE', 'transactions', { error: err.message, hash, status });
          reject(err);
          return;
        }

        logDatabase('UPDATE', 'transactions', { hash, status, changes: this.changes });
        resolve(this.changes > 0);
      });
    });
  }

  // Get best route for swap
  async getBestRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    chainId: number
  ): Promise<SwapRoute[]> {
    try {
      // This would typically query multiple DEX protocols
      // For now, we'll return a simple direct route
      const quote = await rpcService.getSwapQuote(tokenIn, tokenOut, amountIn, chainId);
      
      if (!quote || !quote.route) {
        return [];
      }

      return quote.route.map((hop: any, index: number) => ({
        tokenIn: hop.tokenIn,
        tokenOut: hop.tokenOut,
        amountIn: hop.amountIn,
        amountOut: hop.amountOut,
        exchange: hop.exchange || 'PancakeSwap',
        fee: hop.fee || '0.25',
        hopIndex: index
      }));
    } catch (error) {
      logger.error('Failed to get best route', { tokenIn, tokenOut, amountIn, chainId, error });
      return [];
    }
  }

  // Calculate minimum output amount with slippage
  private calculateAmountOutMin(amountOut: string, slippage: number): string {
    const slippageMultiplier = (100 - slippage) / 100;
    const amountOutBigInt = BigInt(amountOut);
    const amountOutMin = (amountOutBigInt * BigInt(Math.floor(slippageMultiplier * 10000))) / BigInt(10000);
    return amountOutMin.toString();
  }

  // Create transaction record
  private async createTransaction(transactionData: Partial<Transaction>): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO transactions (
          type, user_address, token_in, token_out, amount_in, amount_out,
          chain_id, status, gas_estimate, slippage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        transactionData.type || 'swap',
        transactionData.user_address || '',
        transactionData.token_in || '',
        transactionData.token_out || '',
        transactionData.amount_in || '0',
        transactionData.amount_out || '0',
        transactionData.block_number || 0,
        transactionData.status || 'pending',
        transactionData.gas_estimate || '0',
        transactionData.slippage || 0.5
      ];

      const db = this.db;
      db.run(query, params, function(err: Error | null) {
        if (err) {
          logDatabase('INSERT', 'transactions', { error: err.message, transactionData });
          reject(err);
          return;
        }

        // Get the inserted transaction
        const selectQuery = 'SELECT * FROM transactions WHERE id = ?';
        db.get(selectQuery, [this.lastID], (err: Error | null, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          logDatabase('INSERT', 'transactions', { id: this.lastID, type: transactionData.type });
          resolve(row as Transaction);
        });
      });
    });
  }

  // Update transaction hash
  private async updateTransactionHash(id: number, hash: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE transactions SET transaction_hash = ? WHERE id = ?';
      
      this.db.run(query, [hash, id], function(err) {
        if (err) {
          logDatabase('UPDATE', 'transactions', { error: err.message, id, hash });
          reject(err);
          return;
        }

        logDatabase('UPDATE', 'transactions', { id, hash, changes: this.changes });
        resolve();
      });
    });
  }

  // Get swap statistics
  async getSwapStats(chainId?: number, timeframe: string = '24h'): Promise<any> {
    return new Promise((resolve, reject) => {
      let timeCondition = '';
      const now = new Date();
      
      switch (timeframe) {
        case '1h':
          timeCondition = `AND created_at > datetime('${new Date(now.getTime() - 60 * 60 * 1000).toISOString()}')`;
          break;
        case '24h':
          timeCondition = `AND created_at > datetime('${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}')`;
          break;
        case '7d':
          timeCondition = `AND created_at > datetime('${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()}')`;
          break;
        case '30d':
          timeCondition = `AND created_at > datetime('${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()}')`;
          break;
      }

      let query = `
        SELECT 
          COUNT(*) as total_swaps,
          COUNT(DISTINCT user_address) as unique_users,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_swaps,
          AVG(CAST(gas_estimate as REAL)) as avg_gas_estimate
        FROM transactions 
        WHERE type = 'swap' ${timeCondition}
      `;

      if (chainId) {
        query += ' AND chain_id = ?';
      }

      const params = chainId ? [chainId] : [];

      this.db.get(query, params, (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'transactions', { error: err.message, type: 'stats' });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'transactions', { type: 'stats', timeframe, chainId });
        resolve(row);
      });
    });
  }
}

export const swapService = new SwapService();