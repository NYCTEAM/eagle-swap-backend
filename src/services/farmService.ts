import { Database } from 'sqlite3';
import { Farm, FarmPosition, Transaction, StakingPosition, ApiResponse, PaginatedResponse, ApiError } from '../types';
import { getDatabase } from '../database/init';
import { rpcService } from './rpcService';
import { logger, logDatabase, logBlockchain } from '../utils/logger';

export class FarmService {
  private get db(): Database {
    return getDatabase();
  }

  // Get all farms with pagination
  async getFarms(page: number = 1, limit: number = 20, chainId?: number): Promise<PaginatedResponse<Farm>> {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      let query = 'SELECT * FROM farms WHERE is_active = 1';
      let countQuery = 'SELECT COUNT(*) as total FROM farms WHERE is_active = 1';
      const params: any[] = [];

      if (chainId) {
        query += ' AND chain_id = ?';
        countQuery += ' AND chain_id = ?';
        params.push(chainId);
      }

      query += ' ORDER BY total_staked DESC, created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      // Get total count
      this.db.get(countQuery, chainId ? [chainId] : [], (err, countResult: any) => {
        if (err) {
          logDatabase('SELECT', 'farms', { error: err.message });
          reject(err);
          return;
        }

        const total = countResult.total;

        // Get farms
        this.db.all(query, params, (err, rows: any[]) => {
          if (err) {
            logDatabase('SELECT', 'farms', { error: err.message });
            reject(err);
            return;
          }

          logDatabase('SELECT', 'farms', { count: rows.length, page, limit });
          
          resolve({
            data: rows as Farm[],
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

  // Get farm by ID
  async getFarmById(id: number): Promise<Farm | null> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM farms WHERE id = ? AND is_active = 1';
      
      this.db.get(query, [id], (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'farms', { error: err.message, id });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'farms', { id, found: !!row });
        resolve(row as Farm || null);
      });
    });
  }

  // Stake tokens in farm
  async stake(
    farmId: number,
    amount: string,
    userAddress: string,
    chainId: number
  ): Promise<{ transactionHash: string; transaction: Transaction }> {
    try {
      // Get farm info
      const farm = await this.getFarmById(farmId);
      
      if (!farm) {
        throw new Error('Farm not found');
      }

      if (farm.chain_id !== chainId) {
        throw new Error('Chain ID mismatch');
      }

      // Get farm info from blockchain
      const farmInfo = await rpcService.getFarmInfo(farm.contract_address, chainId);
      
      if (!farmInfo) {
        throw new Error('Farm contract not found');
      }

      // Create transaction record
      const transaction = await this.createFarmTransaction({
        type: 'stake',
        user_address: userAddress,
        farm_id: farmId,
        amount_in: amount,
        chain_id: chainId,
        status: 'pending'
      });

      // Simulate transaction hash
      const transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      // Update transaction with hash
      await this.updateTransactionHash(transaction.id!, transactionHash);

      // Create or update staking position
      await this.createOrUpdateStakingPosition({
        user_address: userAddress,
        farm_id: farmId,
        staked_amount: amount,
        chain_id: chainId
      });

      // Update farm total staked
      await this.updateFarmTotalStaked(farmId, amount, 'add');

      logBlockchain('FARM', 'Stake', {
        transactionHash,
        farmId,
        amount,
        userAddress
      });

      return {
        transactionHash,
        transaction: { ...transaction, transaction_hash: transactionHash }
      };
    } catch (error) {
      logger.error('Failed to stake in farm', {
        farmId,
        amount,
        userAddress,
        chainId,
        error
      });
      throw error;
    }
  }

  // Unstake tokens from farm
  async unstake(
    farmId: number,
    amount: string,
    userAddress: string,
    chainId: number
  ): Promise<{ transactionHash: string; transaction: Transaction }> {
    try {
      // Get farm info
      const farm = await this.getFarmById(farmId);
      
      if (!farm) {
        throw new Error('Farm not found');
      }

      // Get existing staking position
      const position = await this.getStakingPosition(farmId, userAddress, chainId);
      
      if (!position) {
        throw new Error('No staking position found');
      }

      if (BigInt(position.staked_amount) < BigInt(amount)) {
        throw new Error('Insufficient staked balance');
      }

      // Create transaction record
      const transaction = await this.createFarmTransaction({
        type: 'unstake',
        user_address: userAddress,
        farm_id: farmId,
        amount_in: amount,
        chain_id: chainId,
        status: 'pending'
      });

      // Simulate transaction hash
      const transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      // Update transaction with hash
      await this.updateTransactionHash(transaction.id!, transactionHash);

      // Update staking position
      const newStakedAmount = (BigInt(position.staked_amount) - BigInt(amount)).toString();
      
      if (newStakedAmount === '0') {
        // Remove position entirely
        await this.deleteStakingPosition(position.id!);
      } else {
        // Update position
        await this.updateStakingPosition(position.id!, {
          staked_amount: newStakedAmount
        });
      }

      // Update farm total staked
      await this.updateFarmTotalStaked(farmId, amount, 'subtract');

      logBlockchain('FARM', 'Unstake', {
        transactionHash,
        farmId,
        amount,
        userAddress
      });

      return {
        transactionHash,
        transaction: { ...transaction, transaction_hash: transactionHash }
      };
    } catch (error) {
      logger.error('Failed to unstake from farm', {
        farmId,
        amount,
        userAddress,
        chainId,
        error
      });
      throw error;
    }
  }

  // Harvest rewards from farm
  async harvest(
    farmId: number,
    userAddress: string,
    chainId: number
  ): Promise<{ transactionHash: string; transaction: Transaction; rewards: string }> {
    try {
      // Get farm info
      const farm = await this.getFarmById(farmId);
      
      if (!farm) {
        throw new Error('Farm not found');
      }

      // Get pending rewards from blockchain
      const pendingRewards = await rpcService.getPendingRewards(farm.farm_address, userAddress, chainId);
      
      if (BigInt(pendingRewards) === BigInt(0)) {
        throw new Error('No rewards to harvest');
      }

      // Create transaction record
      const transaction = await this.createFarmTransaction({
        type: 'harvest',
        user_address: userAddress,
        farm_id: farmId,
        amount_out: pendingRewards,
        chain_id: chainId,
        status: 'pending'
      });

      // Simulate transaction hash
      const transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      // Update transaction with hash
      await this.updateTransactionHash(transaction.id!, transactionHash);

      // Update staking position rewards
      await this.updateStakingPositionRewards(farmId, userAddress, chainId, pendingRewards);

      logBlockchain('FARM', 'Harvest', {
        transactionHash,
        farmId,
        rewards: pendingRewards,
        userAddress
      });

      return {
        transactionHash,
        transaction: { ...transaction, transaction_hash: transactionHash },
        rewards: pendingRewards
      };
    } catch (error) {
      logger.error('Failed to harvest from farm', {
        farmId,
        userAddress,
        chainId,
        error
      });
      throw error;
    }
  }

  // Get user staking positions
  async getUserStakingPositions(
    userAddress: string,
    page: number = 1,
    limit: number = 20,
    chainId?: number
  ): Promise<{ data: StakingPosition[]; pagination: any }> {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      let query = `
        SELECT sp.*, f.name as farm_name, f.staking_token, f.reward_token, f.apy
        FROM staking_positions sp
        JOIN farms f ON sp.farm_id = f.id
        WHERE sp.user_address = ?
      `;
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM staking_positions sp
        JOIN farms f ON sp.farm_id = f.id
        WHERE sp.user_address = ?
      `;
      const params: any[] = [userAddress.toLowerCase()];

      if (chainId) {
        query += ' AND sp.chain_id = ?';
        countQuery += ' AND sp.chain_id = ?';
        params.push(chainId);
      }

      query += ' ORDER BY sp.created_at DESC LIMIT ? OFFSET ?';
      const queryParams = [...params, limit, offset];

      // Get total count
      this.db.get(countQuery, params, (err, countResult: any) => {
        if (err) {
          logDatabase('SELECT', 'staking_positions', { error: err.message });
          reject(err);
          return;
        }

        const total = countResult.total;

        // Get positions
        this.db.all(query, queryParams, (err, rows: any[]) => {
          if (err) {
            logDatabase('SELECT', 'staking_positions', { error: err.message });
            reject(err);
            return;
          }

          logDatabase('SELECT', 'staking_positions', {
            userAddress,
            count: rows.length,
            page,
            limit
          });

          resolve({
            data: rows as StakingPosition[],
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

  // Get staking position for specific farm
  async getStakingPosition(
    farmId: number,
    userAddress: string,
    chainId: number
  ): Promise<StakingPosition | null> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT sp.*, f.name as farm_name, f.staking_token, f.reward_token, f.apy
        FROM staking_positions sp
        JOIN farms f ON sp.farm_id = f.id
        WHERE sp.farm_id = ? AND sp.user_address = ? AND sp.chain_id = ?
      `;
      
      this.db.get(query, [farmId, userAddress.toLowerCase(), chainId], (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'staking_positions', { error: err.message });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'staking_positions', {
          farmId,
          userAddress,
          chainId,
          found: !!row
        });

        resolve(row as StakingPosition || null);
      });
    });
  }

  // Get pending rewards for user
  async getPendingRewards(
    farmId: number,
    userAddress: string,
    chainId: number
  ): Promise<string> {
    try {
      const farm = await this.getFarmById(farmId);
      
      if (!farm) {
        throw new Error('Farm not found');
      }

      const pendingRewards = await rpcService.getPendingRewards(farm.farm_address, userAddress, chainId);
      
      logger.info('Pending rewards retrieved', { farmId, userAddress, chainId, pendingRewards });
      return pendingRewards;
    } catch (error) {
      logger.error('Failed to get pending rewards', { farmId, userAddress, chainId, error });
      throw error;
    }
  }

  // Get farm history for user
  async getFarmHistory(
    userAddress: string,
    page: number = 1,
    limit: number = 20,
    chainId?: number
  ): Promise<{ data: Transaction[]; pagination: any }> {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      let query = `
        SELECT * FROM transactions 
        WHERE user_address = ? AND (type = 'stake' OR type = 'unstake' OR type = 'harvest')
      `;
      let countQuery = `
        SELECT COUNT(*) as total FROM transactions 
        WHERE user_address = ? AND (type = 'stake' OR type = 'unstake' OR type = 'harvest')
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
            type: 'farm_history',
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

  // Get farm statistics
  async getFarmStats(chainId?: number, timeframe: string = '24h'): Promise<any> {
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
          SUM(CASE WHEN type = 'stake' THEN 1 ELSE 0 END) as stake_operations,
          SUM(CASE WHEN type = 'unstake' THEN 1 ELSE 0 END) as unstake_operations,
          SUM(CASE WHEN type = 'harvest' THEN 1 ELSE 0 END) as harvest_operations
        FROM transactions 
        WHERE (type = 'stake' OR type = 'unstake' OR type = 'harvest') ${timeCondition}
      `;

      if (chainId) {
        query += ' AND chain_id = ?';
      }

      const params = chainId ? [chainId] : [];

      this.db.get(query, params, (err, row: any) => {
        if (err) {
          logDatabase('SELECT', 'transactions', { error: err.message, type: 'farm_stats' });
          reject(err);
          return;
        }

        logDatabase('SELECT', 'transactions', { type: 'farm_stats', timeframe, chainId });
        resolve(row);
      });
    });
  }

  // Private helper methods
  private async createFarmTransaction(transactionData: Partial<Transaction>): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO transactions (
          type, user_address, farm_id, amount_in, amount_out, chain_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        transactionData.type,
        transactionData.user_address,
        transactionData.farm_id,
        transactionData.amount_in,
        transactionData.amount_out,
        transactionData.chain_id,
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

  private async createOrUpdateStakingPosition(positionData: Partial<StakingPosition>): Promise<void> {
    return new Promise((resolve, reject) => {
      // First, try to find existing position
      const findQuery = `
        SELECT * FROM staking_positions 
        WHERE user_address = ? AND farm_id = ? AND chain_id = ?
      `;
      
      this.db.get(findQuery, [
        positionData.user_address,
        positionData.farm_id,
        positionData.farm_id
      ], (err, existingRow: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (existingRow) {
          // Update existing position
          const updateQuery = `
            UPDATE staking_positions 
            SET staked_amount = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `;
          
          const newStakedAmount = (BigInt(existingRow.staked_amount) + BigInt(positionData.staked_amount!)).toString();

          this.db.run(updateQuery, [newStakedAmount, existingRow.id], (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        } else {
          // Create new position
          const insertQuery = `
            INSERT INTO staking_positions (
              user_address, farm_id, staked_amount, rewards_earned, chain_id
            ) VALUES (?, ?, ?, ?, ?)
          `;

          this.db.run(insertQuery, [
            positionData.user_address,
            positionData.farm_id,
            positionData.staked_amount,
            '0',
            positionData.farm_id
          ], (err) => {
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

  private async updateStakingPosition(id: number, updates: Partial<StakingPosition>): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE staking_positions 
        SET staked_amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      this.db.run(query, [updates.staked_amount, id], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private async deleteStakingPosition(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM staking_positions WHERE id = ?';
      
      this.db.run(query, [id], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private async updateFarmTotalStaked(farmId: number, amount: string, operation: 'add' | 'subtract'): Promise<void> {
    return new Promise((resolve, reject) => {
      // First get current total
      const selectQuery = 'SELECT total_staked FROM farms WHERE id = ?';
      
      this.db.get(selectQuery, [farmId], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        const currentTotal = BigInt(row?.total_staked || '0');
        const amountBigInt = BigInt(amount);
        
        const newTotal = operation === 'add' 
          ? (currentTotal + amountBigInt).toString()
          : (currentTotal - amountBigInt).toString();

        const updateQuery = 'UPDATE farms SET total_staked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        
        this.db.run(updateQuery, [newTotal, farmId], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  private async updateStakingPositionRewards(
    farmId: number,
    userAddress: string,
    chainId: number,
    rewards: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE staking_positions 
        SET rewards_earned = CAST(rewards_earned AS TEXT) || '+' || ?, updated_at = CURRENT_TIMESTAMP
        WHERE farm_id = ? AND user_address = ? AND chain_id = ?
      `;
      
      this.db.run(query, [rewards, farmId, userAddress.toLowerCase(), chainId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

export const farmService = new FarmService();