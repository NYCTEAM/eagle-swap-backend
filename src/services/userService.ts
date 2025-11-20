import { Database } from 'sqlite3';
import { User, ApiResponse, PaginatedResponse, ApiError } from '../types';
import { getDatabase } from '../database/init';
import { rpcService } from './rpcService';
import { logger, logDatabase } from '../utils/logger';

export class UserService {
  private get db(): Database {
    return getDatabase();
  }

  // Get user by address
  async getUserByAddress(address: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE wallet_address = ?';
      
      this.db.get(query, [address.toLowerCase()], (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'users', { error: err.message, address });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'users', { address, found: !!row });
        resolve(row as User || null);
      });
    });
  }

  // Create or update user
  async createOrUpdateUser(userData: Partial<User>): Promise<User> {
    return new Promise((resolve, reject) => {
      const address = userData.address!.toLowerCase();
      
      // First, check if user exists
      this.getUserByAddress(address).then(existingUser => {
        if (existingUser) {
          // Update existing user
          const updateQuery = `
            UPDATE users 
            SET username = ?, email = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
            WHERE address = ?
          `;
          
          this.db.run(updateQuery, [
            userData.username || existingUser.username,
            userData.email || existingUser.email,
            userData.avatar_url || existingUser.avatar_url,
            address
          ], (err) => {
            if (err) {
              logDatabase('UPDATE', 'users', { error: err.message, address });
              reject(err);
              return;
            }

            // Get updated user
            this.db.get('SELECT * FROM users WHERE address = ?', [address], (err, row: any) => {
              if (err) {
                reject(err);
                return;
              }

              logDatabase('UPDATE', 'users', { address });
              resolve(row as User);
            });
          });
        } else {
          // Create new user
          const insertQuery = `
            INSERT INTO users (address, username, email, avatar_url)
            VALUES (?, ?, ?, ?)
          `;

          const db = this.db;
          db.run(insertQuery, [
            address,
            userData.username || null,
            userData.email || null,
            userData.avatar_url || null
          ], function(err) {
            if (err) {
              logDatabase('INSERT', 'users', { error: err.message, address });
              reject(err);
              return;
            }

            const lastID = this.lastID;
            // Get created user
            db.get('SELECT * FROM users WHERE id = ?', [lastID], (err, row: any) => {
              if (err) {
                reject(err);
                return;
              }

              logDatabase('INSERT', 'users', { id: lastID, address });
              resolve(row as User);
            });
          });
        }
      }).catch(reject);
    });
  }

  // Get all users with pagination
  async getUsers(page: number = 1, limit: number = 20, search?: string): Promise<PaginatedResponse<User>> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM users WHERE is_active = 1';
      let countQuery = 'SELECT COUNT(*) as total FROM users WHERE is_active = 1';
      const params: any[] = [];

      if (search) {
        query += ' AND (username LIKE ? OR email LIKE ? OR address LIKE ?)';
        countQuery += ' AND (username LIKE ? OR email LIKE ? OR address LIKE ?)';
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      this.db.get(countQuery, search ? [params[0], params[1], params[2]] : [], (err: any, countRow: any) => {
        if (err) {
          logger.error('Failed to count users', { error: err });
          reject(new ApiError('Failed to count users', 500, 'DATABASE_ERROR'));
          return;
        }

        this.db.all(query, params, (err: any, rows: any[]) => {
          if (err) {
            logger.error('Failed to get users', { error: err });
            reject(new ApiError('Failed to get users', 500, 'DATABASE_ERROR'));
            return;
          }

          const total = countRow.total;
          const totalPages = Math.ceil(total / limit);

          resolve({
            data: rows as User[],
            pagination: {
              page,
              limit,
              total,
              totalPages
            }
          });
        });
      });
    });
  }

  // Search users by username or address
  async searchUsers(query: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<User>> {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      const searchPattern = `%${query.toLowerCase()}%`;
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total FROM users 
        WHERE LOWER(username) LIKE ? OR LOWER(address) LIKE ?
      `;
      
      this.db.get(countQuery, [searchPattern, searchPattern], (err, countResult: any) => {
        if (err) {
          logDatabase('SELECT', 'users', { error: err.message });
          reject(err);
          return;
        }

        const total = countResult.total;

        // Get users
        const searchQuery = `
          SELECT * FROM users 
          WHERE LOWER(username) LIKE ? OR LOWER(address) LIKE ?
          ORDER BY created_at DESC 
          LIMIT ? OFFSET ?
        `;
        
        this.db.all(searchQuery, [searchPattern, searchPattern, limit, offset], (err, rows: any[]) => {
          if (err) {
            logDatabase('SELECT', 'users', { error: err.message });
            reject(err);
            return;
          }

          logDatabase('SELECT', 'users', { 
            type: 'search',
            query,
            count: rows.length,
            page,
            limit
          });
          
          resolve({
            data: rows as User[],
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

  // Get user portfolio (balances across all chains)
  async getUserPortfolio(address: string, chainIds?: number[]): Promise<any> {
    try {
      const user = await this.getUserByAddress(address);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Get supported chains if not specified
      const chains = chainIds || await this.getSupportedChains();
      
      const portfolio = {
        user,
        balances: [] as any[],
        totalValueUSD: '0'
      };

      // Get balances for each chain
      for (const chainId of chains) {
        try {
          // Get native balance
          const nativeBalance = await rpcService.getNativeBalance(address, chainId);
          
          if (nativeBalance && BigInt(nativeBalance) > 0) {
            portfolio.balances.push({
              chainId,
              type: 'native',
              symbol: this.getChainNativeSymbol(chainId),
              balance: nativeBalance,
              address: null
            });
          }

          // Get token balances (this would require getting user's token list)
          // For now, we'll skip token balances as it requires more complex logic
          
        } catch (error) {
          logger.warn('Failed to get balances for chain', { chainId, address, error });
        }
      }

      logger.info('User portfolio retrieved', { address, chainsChecked: chains.length });
      return portfolio;
    } catch (error) {
      logger.error('Failed to get user portfolio', { address, error });
      throw error;
    }
  }

  // Get user transaction history across all modules
  async getUserTransactionHistory(
    address: string,
    page: number = 1,
    limit: number = 20,
    chainId?: number,
    type?: string
  ): Promise<{ data: any[]; pagination: any }> {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      let query = 'SELECT * FROM transactions WHERE user_address = ?';
      let countQuery = 'SELECT COUNT(*) as total FROM transactions WHERE user_address = ?';
      const params: any[] = [address.toLowerCase()];

      if (chainId) {
        query += ' AND chain_id = ?';
        countQuery += ' AND chain_id = ?';
        params.push(chainId);
      }

      if (type) {
        query += ' AND type = ?';
        countQuery += ' AND type = ?';
        params.push(type);
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
            type: 'user_history',
            address,
            count: rows.length,
            page,
            limit
          });

          resolve({
            data: rows,
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

  // Get user statistics
  async getUserStats(address: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(DISTINCT chain_id) as chains_used,
          SUM(CASE WHEN type = 'swap' THEN 1 ELSE 0 END) as swap_count,
          SUM(CASE WHEN type = 'add_liquidity' OR type = 'remove_liquidity' THEN 1 ELSE 0 END) as liquidity_count,
          SUM(CASE WHEN type = 'stake' OR type = 'unstake' OR type = 'harvest' THEN 1 ELSE 0 END) as farm_count,
          MIN(created_at) as first_transaction,
          MAX(created_at) as last_transaction
        FROM transactions 
        WHERE user_address = ?
      `;

      this.db.get(query, [address.toLowerCase()], (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'transactions', { error: err.message, type: 'user_stats' });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'transactions', { type: 'user_stats', address });
        resolve(row);
      });
    });
  }

  // Update user preferences
  async updateUserPreferences(address: string, preferences: any): Promise<User> {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE users 
        SET preferences = ?, updated_at = CURRENT_TIMESTAMP
        WHERE address = ?
      `;

      this.db.run(query, [JSON.stringify(preferences), address.toLowerCase()], (err) => {
        if (err) {
          logDatabase('UPDATE', 'users', { error: err.message, address });
          reject(err);
          return;
        }

        // Get updated user
        this.db.get('SELECT * FROM users WHERE address = ?', [address.toLowerCase()], (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            reject(new Error('User not found'));
            return;
          }

          logDatabase('UPDATE', 'users', { address });
          resolve(row as User);
        });
      });
    });
  }

  // Delete user (soft delete by setting is_active = false)
  async deleteUser(address: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE users 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE address = ?
      `;

      this.db.run(query, [address.toLowerCase()], (err) => {
        if (err) {
          logDatabase('UPDATE', 'users', { error: err.message, address, type: 'soft_delete' });
          reject(err);
          return;
        }

        logDatabase('UPDATE', 'users', { address, type: 'soft_delete' });
        resolve();
      });
    });
  }

  // Get user activity summary
  async getUserActivitySummary(address: string, days: number = 30): Promise<any> {
    return new Promise((resolve, reject) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as transaction_count,
          COUNT(DISTINCT type) as unique_operations
        FROM transactions 
        WHERE user_address = ? AND created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      this.db.all(query, [address.toLowerCase(), startDate.toISOString()], (err, rows: any[]) => {
        if (err) {
          logDatabase('SELECT', 'transactions', { error: err.message, type: 'activity_summary' });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'transactions', { 
          type: 'activity_summary',
          address,
          days,
          records: rows.length
        });

        resolve(rows);
      });
    });
  }

  // Private helper methods
  private async getSupportedChains(): Promise<number[]> {
    try {
      const chains = await rpcService.getSupportedChains();
      return chains.map((chain: any) => chain.chainId);
    } catch (error) {
      logger.warn('Failed to get supported chains, using defaults', { error });
      return [1, 56, 137]; // Default to Ethereum, BSC, Polygon
    }
  }

  private getChainNativeSymbol(chainId: number): string {
    const symbols: { [key: number]: string } = {
      1: 'ETH',
      56: 'BNB',
      137: 'MATIC',
      250: 'FTM',
      43114: 'AVAX',
      42161: 'ETH',
      10: 'ETH'
    };
    
    return symbols[chainId] || 'UNKNOWN';
  }

  // Register or get user (for auto-registration)
  async registerOrGetUser(walletAddress: string, referralCode?: string, username?: string, avatarUrl?: string): Promise<{ user: any; isNewUser: boolean }> {
    return new Promise((resolve, reject) => {
      const address = walletAddress.toLowerCase();
      
      // Check if user exists
      this.db.get('SELECT * FROM users WHERE wallet_address = ?', [address], (err, existingUser: any) => {
        if (err) {
          logDatabase('SELECT', 'users', { error: err.message, address });
          reject(err);
          return;
        }

        if (existingUser) {
          // User already exists
          logDatabase('SELECT', 'users', { address, exists: true });
          resolve({ user: existingUser, isNewUser: false });
          return;
        }

        // Create new user (referral system removed)
        const insertQuery = `
          INSERT INTO users (
            wallet_address,
            username,
            avatar_url,
            swap_mining_bonus
          ) VALUES (?, ?, ?, 0.05)
        `;

        const db = this.db;
        db.run(insertQuery, [address, username || null, avatarUrl || null], function(err) {
          if (err) {
            logDatabase('INSERT', 'users', { error: err.message, address });
            reject(err);
            return;
          }

          const userId = this.lastID;
          
          // Get the newly created user
          db.get('SELECT * FROM users WHERE id = ?', [userId], (err, newUser: any) => {
            if (err) {
              reject(err);
              return;
            }

            logDatabase('INSERT', 'users', { id: userId, address, isNewUser: true });
            resolve({ user: newUser, isNewUser: true });
          });
        });
      });
    });
  }
}

export const userService = new UserService();