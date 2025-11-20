import { Database } from 'sqlite3';
import { LiquidityPosition, Transaction, ApiResponse, PaginatedResponse } from '../types';
import { getDatabase } from '../database/init';
import { rpcService } from './rpcService';
import { logger, logDatabase, logBlockchain } from '../utils/logger';

export class LiquidityService {
  private get db(): Database {
    return getDatabase();
  }

  // Add liquidity
  async addLiquidity(
    tokenA: string,
    tokenB: string,
    amountA: string,
    amountB: string,
    amountAMin: string,
    amountBMin: string,
    userAddress: string,
    chainId: number,
    deadline?: number
  ): Promise<{ transactionHash: string; transaction: Transaction }> {
    try {
      // Get pair info from RPC service
      const pairInfo = await rpcService.getPairInfo(tokenA, tokenB, chainId);
      
      if (!pairInfo) {
        throw new Error('Trading pair not found');
      }

      // Validate amounts
      if (BigInt(amountA) < BigInt(amountAMin) || BigInt(amountB) < BigInt(amountBMin)) {
        throw new Error('Insufficient amounts provided');
      }

      // Create transaction record
      const liquidity = this.calculateLiquidityAmount(amountA, amountB, pairInfo);
      const transaction = await this.createLiquidityTransaction({
        type: 'add_liquidity',
        user_address: userAddress,
        token_in: tokenA.toLowerCase(),
        token_out: tokenB.toLowerCase(),
        amount_in: amountA,
        amount_out: amountB,
        lp_amount: liquidity,
        gas_used: '0',
        gas_price: '0',
        status: 'success',
        block_number: 0,
        timestamp: new Date().toISOString()
      });

      // Simulate transaction hash
      const transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      // Update transaction with hash
      await this.updateTransactionHash(transaction.id!, transactionHash);

      // Create or update liquidity position
      await this.createOrUpdateLiquidityPosition({
        user_address: userAddress,
        token_a: tokenA.toLowerCase(),
        token_b: tokenB.toLowerCase(),
        pair_address: pairInfo.pairAddress,
        lp_token_amount: this.calculateLiquidityAmount(amountA, amountB, pairInfo),
        token_a_amount: amountA,
        token_b_amount: amountB
      });

      logBlockchain('LIQUIDITY', 'Add', {
        transactionHash,
        tokenA,
        tokenB,
        amountA,
        amountB,
        userAddress
      });

      return {
        transactionHash,
        transaction: { ...transaction, transaction_hash: transactionHash }
      };
    } catch (error) {
      logger.error('Failed to add liquidity', {
        tokenA,
        tokenB,
        amountA,
        amountB,
        userAddress,
        chainId,
        error
      });
      throw error;
    }
  }

  // Remove liquidity
  async removeLiquidity(
    tokenA: string,
    tokenB: string,
    liquidity: string,
    amountAMin: string,
    amountBMin: string,
    userAddress: string,
    chainId: number,
    deadline?: number
  ): Promise<{ transactionHash: string; transaction: Transaction }> {
    try {
      // Get existing liquidity position
      const position = await this.getLiquidityPosition(tokenA, tokenB, userAddress, chainId);
      
      if (!position) {
        throw new Error('No liquidity position found');
      }

      if (BigInt(position.lp_token_amount) < BigInt(liquidity)) {
        throw new Error('Insufficient liquidity balance');
      }

      // Create transaction record
      const transaction = await this.createLiquidityTransaction({
        type: 'remove_liquidity',
        user_address: userAddress,
        token_in: tokenA.toLowerCase(),
        token_out: tokenB.toLowerCase(),
        amount_in: liquidity,
        amount_out: '0',
        lp_amount: liquidity,
        gas_used: '0',
        gas_price: '0',
        status: 'success',
        block_number: 0,
        timestamp: new Date().toISOString()
      });

      // Simulate transaction hash
      const transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      // Update transaction with hash
      await this.updateTransactionHash(transaction.id!, transactionHash);

      // Update liquidity position
      const newLiquidityAmount = (BigInt(position.lp_token_amount) - BigInt(liquidity)).toString();
      
      if (newLiquidityAmount === '0') {
        // Remove position entirely
        await this.deleteLiquidityPosition(position.id!);
      } else {
        // Update position
        await this.updateLiquidityPosition(position.id!, {
          lp_token_amount: newLiquidityAmount
        });
      }

      logBlockchain('LIQUIDITY', 'Remove', {
        transactionHash,
        tokenA,
        tokenB,
        liquidity,
        userAddress
      });

      return {
        transactionHash,
        transaction: { ...transaction, transaction_hash: transactionHash }
      };
    } catch (error) {
      logger.error('Failed to remove liquidity', {
        tokenA,
        tokenB,
        liquidity,
        userAddress,
        chainId,
        error
      });
      throw error;
    }
  }

  // Get liquidity positions for user
  async getUserLiquidityPositions(
    userAddress: string,
    page: number = 1,
    limit: number = 20,
    chainId?: number
  ): Promise<{ data: LiquidityPosition[]; pagination: any }> {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      let query = 'SELECT * FROM liquidity_positions WHERE user_address = ?';
      let countQuery = 'SELECT COUNT(*) as total FROM liquidity_positions WHERE user_address = ?';
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
          logDatabase('SELECT', 'liquidity_positions', { error: err.message });
          reject(err);
          return;
        }

        const total = countResult.total;

        // Get positions
        this.db.all(query, queryParams, (err, rows: any[]) => {
          if (err) {
            logDatabase('SELECT', 'liquidity_positions', { error: err.message });
            reject(err);
            return;
          }

          logDatabase('SELECT', 'liquidity_positions', {
            userAddress,
            count: rows.length,
            page,
            limit
          });

          resolve({
            data: rows as LiquidityPosition[],
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

  // Get liquidity position for specific pair
  async getLiquidityPosition(
    tokenA: string,
    tokenB: string,
    userAddress: string,
    chainId: number
  ): Promise<LiquidityPosition | null> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM liquidity_positions 
        WHERE user_address = ? AND chain_id = ?
        AND ((token_a = ? AND token_b = ?) OR (token_a = ? AND token_b = ?))
      `;
      
      const params = [
        userAddress.toLowerCase(),
        chainId,
        tokenA.toLowerCase(),
        tokenB.toLowerCase(),
        tokenB.toLowerCase(),
        tokenA.toLowerCase()
      ];

      this.db.get(query, params, (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'liquidity_positions', { error: err.message });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'liquidity_positions', {
          tokenA,
          tokenB,
          userAddress,
          chainId,
          found: !!row
        });

        resolve(row as LiquidityPosition || null);
      });
    });
  }

  // Get pair reserves
  async getPairReserves(tokenA: string, tokenB: string, chainId: number): Promise<any> {
    try {
      const pairInfo = await rpcService.getPairInfo(tokenA, tokenB, chainId);
      
      if (!pairInfo) {
        throw new Error('Trading pair not found');
      }

      const reserves = await rpcService.getPairReserves(pairInfo.pairAddress, chainId);
      
      return {
        pairAddress: pairInfo.pairAddress,
        token0: pairInfo.token0,
        token1: pairInfo.token1,
        reserve0: reserves.reserve0,
        reserve1: reserves.reserve1,
        blockTimestampLast: reserves.blockTimestampLast
      };
    } catch (error) {
      logger.error('Failed to get pair reserves', { tokenA, tokenB, chainId, error });
      throw error;
    }
  }

  // Get liquidity history for user
  async getLiquidityHistory(
    userAddress: string,
    page: number = 1,
    limit: number = 20,
    chainId?: number
  ): Promise<{ data: Transaction[]; pagination: any }> {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      let query = `
        SELECT * FROM transactions 
        WHERE user_address = ? AND (type = 'add_liquidity' OR type = 'remove_liquidity')
      `;
      let countQuery = `
        SELECT COUNT(*) as total FROM transactions 
        WHERE user_address = ? AND (type = 'add_liquidity' OR type = 'remove_liquidity')
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
            type: 'liquidity_history',
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

  // Get liquidity stats
  async getLiquidityStats(chainId?: number, timeframe: string = '24h'): Promise<any> {
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
          COUNT(*) as total_operations,
          COUNT(DISTINCT user_address) as unique_users,
          SUM(CASE WHEN type = 'add_liquidity' THEN 1 ELSE 0 END) as add_operations,
          SUM(CASE WHEN type = 'remove_liquidity' THEN 1 ELSE 0 END) as remove_operations
        FROM transactions 
        WHERE (type = 'add_liquidity' OR type = 'remove_liquidity') ${timeCondition}
      `;

      if (chainId) {
        query += ' AND chain_id = ?';
      }

      const params = chainId ? [chainId] : [];

      this.db.get(query, params, (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'transactions', { error: err.message, type: 'liquidity_stats' });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'transactions', { type: 'liquidity_stats', timeframe, chainId });
        resolve(row);
      });
    });
  }

  // Private helper methods
  private calculateLiquidityAmount(amountA: string, amountB: string, pairInfo: any): string {
    // Simplified liquidity calculation
    // In real implementation, this would use the actual AMM formula
    return (BigInt(amountA) + BigInt(amountB)).toString();
  }

  private async createLiquidityTransaction(transactionData: Partial<Transaction>): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO transactions (
          type, user_address, token_in, token_out, amount_in, amount_out,
          chain_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        transactionData.type,
        transactionData.user_address,
        transactionData.token_in,
        transactionData.token_out,
        transactionData.amount_in,
        transactionData.amount_out,
        transactionData.block_number,
        transactionData.status
      ];

      const db = this.db;
      db.run(query, params, function(err) {
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

  private async createOrUpdateLiquidityPosition(positionData: Partial<LiquidityPosition>): Promise<void> {
    return new Promise((resolve, reject) => {
      // First, try to find existing position
        const findQuery = `
          SELECT * FROM liquidity_positions 
          WHERE user_address = ? AND pair_address = ?
        `;
        
        this.db.get(findQuery, [
          positionData.user_address,
          positionData.pair_address
        ], (err: Error | null, existingRow: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (existingRow) {
            // Update existing position
            const updateQuery = `
              UPDATE liquidity_positions 
              SET lp_token_amount = ?, token_a_amount = ?, token_b_amount = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `;
            
            const newLiquidityAmount = (BigInt(existingRow.lp_token_amount) + BigInt(positionData.lp_token_amount!)).toString();
            const newTokenAAmount = (BigInt(existingRow.token_a_amount) + BigInt(positionData.token_a_amount!)).toString();
            const newTokenBAmount = (BigInt(existingRow.token_b_amount) + BigInt(positionData.token_b_amount!)).toString();

            this.db.run(updateQuery, [newLiquidityAmount, newTokenAAmount, newTokenBAmount, existingRow.id], (err: Error | null) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            });
          } else {
            // Create new position
            const insertQuery = `
              INSERT INTO liquidity_positions (
                user_address, pair_address, lp_token_amount,
                token_a_amount, token_b_amount
              ) VALUES (?, ?, ?, ?, ?)
            `;

            this.db.run(insertQuery, [
              positionData.user_address,
              positionData.pair_address,
              positionData.lp_token_amount,
              positionData.token_a_amount,
              positionData.token_b_amount
            ], (err: Error | null) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            });
          }
        });
    });
  }

  private async updateLiquidityPosition(id: number, updates: Partial<LiquidityPosition>): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE liquidity_positions 
        SET lp_token_amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      this.db.run(query, [updates.lp_token_amount, id], function(err: Error | null) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private async deleteLiquidityPosition(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM liquidity_positions WHERE id = ?';
      
      this.db.run(query, [id], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

export const liquidityService = new LiquidityService();