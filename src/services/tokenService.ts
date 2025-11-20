import { Database } from 'sqlite3';
import { Token, TokenPrice, ApiResponse, PaginatedResponse, ApiError } from '../types';
import { getDatabase } from '../database/init';
import { rpcService } from './rpcService';
import { logger, logDatabase } from '../utils/logger';

export class TokenService {
  private get db(): Database {
    return getDatabase();
  }

  // Get all tokens with pagination
  async getTokens(page: number = 1, limit: number = 20, chainId?: number): Promise<PaginatedResponse<Token>> {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      let query = 'SELECT * FROM tokens';
      let countQuery = 'SELECT COUNT(*) as total FROM tokens';
      const params: any[] = [];

      if (chainId) {
        query += ' WHERE chain_id = ?';
        countQuery += ' WHERE chain_id = ?';
        params.push(chainId);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      // Get total count
      this.db.get(countQuery, chainId ? [chainId] : [], (err, countResult: any) => {
        if (err) {
          logDatabase('SELECT', 'tokens', { error: err.message });
          reject(err);
          return;
        }

        const total = countResult.total;

        // Get tokens
        this.db.all(query, params, (err, rows: any[]) => {
          if (err) {
            logDatabase('SELECT', 'tokens', { error: err.message });
            reject(err);
            return;
          }

          logDatabase('SELECT', 'tokens', { count: rows.length, page, limit });
          
          resolve({
            data: rows as Token[],
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

  // Get token by address
  async getTokenByAddress(address: string, chainId: number): Promise<Token | null> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM tokens WHERE address = ? AND chain_id = ?';
      
      this.db.get(query, [address.toLowerCase(), chainId], (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'tokens', { error: err.message, address, chainId });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'tokens', { address, chainId, found: !!row });
        resolve(row as Token || null);
      });
    });
  }

  // Add new token
  async addToken(tokenData: Omit<Token, 'id' | 'created_at' | 'updated_at'>): Promise<Token> {
    return new Promise(async (resolve, reject) => {
      try {
        // Validate token with RPC service
        const tokenInfo = await rpcService.getTokenInfo(tokenData.address, tokenData.chain_id);
        
        if (!tokenInfo) {
          throw new Error('Token not found on blockchain');
        }

        // Verify token data matches blockchain
        if (tokenInfo.symbol !== tokenData.symbol || tokenInfo.decimals !== tokenData.decimals) {
          throw new Error('Token data mismatch with blockchain');
        }

        const query = `
          INSERT INTO tokens (address, symbol, name, decimals, chain_id, logo_uri, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
          tokenData.address.toLowerCase(),
          tokenData.symbol,
          tokenData.name,
          tokenData.decimals,
          tokenData.chain_id,
          tokenData.logo_uri || null,
          tokenData.is_active !== false ? 1 : 0
        ];

        const db = this.db;
         db.run(query, params, function(err: Error | null) {
           if (err) {
             logDatabase('INSERT', 'tokens', { error: err.message, tokenData });
             reject(err);
             return;
           }

           // Get the inserted token
           const selectQuery = 'SELECT * FROM tokens WHERE id = ?';
           db.get(selectQuery, [this.lastID], (err: Error | null, row: any) => {
             if (err) {
               reject(err);
               return;
             }

             logDatabase('INSERT', 'tokens', { id: this.lastID, address: tokenData.address });
             resolve(row as Token);
           });
         });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Update token
  async updateToken(address: string, chainId: number, updates: Partial<Token>): Promise<Token | null> {
    return new Promise((resolve, reject) => {
      const allowedFields = ['symbol', 'name', 'logo_uri', 'is_active'];
      const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
      
      if (updateFields.length === 0) {
        reject(new Error('No valid fields to update'));
        return;
      }

      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      const query = `UPDATE tokens SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE address = ? AND chain_id = ?`;
      
      const params = [
        ...updateFields.map(field => updates[field as keyof Token]),
        address.toLowerCase(),
        chainId
      ];

      const db = this.db;
       db.run(query, params, function(err: Error | null) {
         if (err) {
           logDatabase('UPDATE', 'tokens', { error: err.message, address, chainId });
           reject(err);
           return;
         }

         if (this.changes === 0) {
           resolve(null);
           return;
         }

         // Get updated token
         const selectQuery = 'SELECT * FROM tokens WHERE address = ? AND chain_id = ?';
         db.get(selectQuery, [address.toLowerCase(), chainId], (err: Error | null, row: any) => {
           if (err) {
             reject(err);
             return;
           }

           logDatabase('UPDATE', 'tokens', { address, chainId, changes: this.changes });
           resolve(row as Token);
         });
       });
    });
  }

  // Delete token
  async deleteToken(address: string, chainId: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM tokens WHERE address = ? AND chain_id = ?';
      
      this.db.run(query, [address.toLowerCase(), chainId], function(err) {
        if (err) {
          logDatabase('DELETE', 'tokens', { error: err.message, address, chainId });
          reject(err);
          return;
        }

        logDatabase('DELETE', 'tokens', { address, chainId, changes: this.changes });
        resolve(this.changes > 0);
      });
    });
  }

  // Search tokens
  async searchTokens(query: string, chainId?: number, limit: number = 10): Promise<Token[]> {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT * FROM tokens 
        WHERE (symbol LIKE ? OR name LIKE ? OR address LIKE ?) 
        AND is_active = 1
      `;
      const params = [`%${query}%`, `%${query}%`, `%${query}%`];

      if (chainId) {
         sql += ' AND chain_id = ?';
         params.push(chainId.toString());
       }

       sql += ' ORDER BY symbol ASC LIMIT ?';
       params.push(limit.toString());

      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          logDatabase('SELECT', 'tokens', { error: err.message, query, chainId });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'tokens', { query, chainId, count: rows.length });
        resolve(rows as Token[]);
      });
    });
  }

  // Get token balance for user
  async getTokenBalance(tokenAddress: string, userAddress: string, chainId: number): Promise<string> {
    try {
      const balance = await rpcService.getTokenBalance(tokenAddress, userAddress, chainId);
      logger.info('Token balance retrieved', { tokenAddress, userAddress, chainId, balance });
      return balance;
    } catch (error) {
      logger.error('Failed to get token balance', { tokenAddress, userAddress, chainId, error });
      throw error;
    }
  }

  // Get native balance for user
  async getNativeBalance(userAddress: string, chainId: number): Promise<string> {
    try {
      const balance = await rpcService.getNativeBalance(userAddress, chainId);
      logger.info('Native balance retrieved', { userAddress, chainId, balance });
      return balance;
    } catch (error) {
      logger.error('Failed to get native balance', { userAddress, chainId, error });
      throw error;
    }
  }

  // Get popular tokens
  async getPopularTokens(chainId?: number, limit: number = 10): Promise<Token[]> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT t.*, COUNT(tx.id) as transaction_count
        FROM tokens t
        LEFT JOIN transactions tx ON (t.address = tx.token_in OR t.address = tx.token_out)
        WHERE t.is_active = 1
      `;
      const params: any[] = [];

      if (chainId) {
        query += ' AND t.chain_id = ?';
        params.push(chainId);
      }

      query += `
        GROUP BY t.id
        ORDER BY transaction_count DESC, t.created_at DESC
        LIMIT ?
      `;
      params.push(limit);

      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          logDatabase('SELECT', 'tokens', { error: err.message, chainId });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'tokens', { type: 'popular', chainId, count: rows.length });
        resolve(rows as Token[]);
      });
    });
  }

  // Sync token from blockchain
  async syncTokenFromBlockchain(address: string, chainId: number): Promise<Token> {
    try {
      const tokenInfo = await rpcService.getTokenInfo(address, chainId);
      
      if (!tokenInfo) {
        throw new Error('Token not found on blockchain');
      }

      const tokenData = {
        address: address.toLowerCase(),
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        decimals: tokenInfo.decimals,
        chain_id: chainId,
        is_active: true
      };

      // Check if token already exists
      const existingToken = await this.getTokenByAddress(address, chainId);
      
      if (existingToken) {
        // Update existing token
        return await this.updateToken(address, chainId, tokenData) as Token;
      } else {
        // Add new token
        return await this.addToken(tokenData);
      }
    } catch (error) {
      logger.error('Failed to sync token from blockchain', { address, chainId, error });
      throw error;
    }
   }

  async createToken(tokenData: Omit<Token, 'created_at' | 'updated_at'>): Promise<ApiResponse<Token>> {
    try {
      const db = getDatabase();
      const insertQuery = `
        INSERT INTO tokens (address, symbol, name, decimals, logo_uri, chain_id, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      const selectQuery = `
        SELECT * FROM tokens WHERE address = ?
      `;

      return new Promise((resolve, reject) => {
        db.run(insertQuery, [
          tokenData.address.toLowerCase(),
          tokenData.symbol,
          tokenData.name,
          tokenData.decimals,
          tokenData.logo_uri || null,
          tokenData.chain_id,
          tokenData.is_active !== undefined ? tokenData.is_active : 1
        ], function(err: Error | null) {
          if (err) {
            logger.error('Error creating token', { error: err, tokenData });
            reject(new ApiError('Failed to create token', 500));
            return;
          }

          db.get(selectQuery, [tokenData.address.toLowerCase()], (err: Error | null, row: any) => {
            if (err) {
              logger.error('Error retrieving created token', { error: err });
              reject(new ApiError('Failed to retrieve created token', 500));
              return;
            }

            if (!row) {
              reject(new ApiError('Token not found after creation', 404));
              return;
            }

            resolve({
              success: true,
              data: row as Token,
              timestamp: new Date().toISOString()
            });
          });
        });
      });
    } catch (error) {
      logger.error('Error in createToken', { error });
      throw new ApiError('Failed to create token', 500);
     }
   }
}

export const tokenService = new TokenService();