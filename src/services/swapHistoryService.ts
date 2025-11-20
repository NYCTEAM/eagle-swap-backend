import { Database } from 'sqlite3';
import { getDatabase } from '../database/init';
import { logger } from '../utils/logger';

export interface SwapTransaction {
  id?: number;
  tx_hash: string;
  user_address: string;
  token_in: string;
  token_out: string;
  amount_in: string;
  amount_out: string;
  dex_name: string;
  platform_fee: string;
  execution_price: string;
  slippage?: string;
  status: 'pending' | 'success' | 'failed';
  block_number?: number;
  timestamp: number;
  chain_id: number;
}

export interface TWAPOrder {
  id?: number;
  order_id: number;
  user_address: string;
  token_in: string;
  token_out: string;
  total_amount: string;
  amount_per_trade: string;
  total_trades: number;
  executed_trades: number;
  trade_interval: number;
  max_duration: number;
  order_type: 'market' | 'limit';
  min_amount_out?: string;
  status: 'active' | 'completed' | 'cancelled' | 'expired';
  created_tx_hash?: string;
  created_at_timestamp: number;
  last_execute_time?: number;
  chain_id: number;
}

export interface LimitOrder {
  id?: number;
  order_id: number;
  user_address: string;
  token_in: string;
  token_out: string;
  amount_in: string;
  min_amount_out: string;
  limit_price: string;
  expiry_time: number;
  status: 'active' | 'filled' | 'cancelled' | 'expired';
  created_tx_hash?: string;
  filled_tx_hash?: string;
  filled_amount_out?: string;
  filled_at_timestamp?: number;
  executor_address?: string;
  executor_reward?: string;
  platform_fee?: string;
  created_at_timestamp: number;
  chain_id: number;
}

export class SwapHistoryService {
  private get db(): Database {
    return getDatabase();
  }

  /**
   * 记录 Swap 交易
   */
  async recordSwapTransaction(swap: SwapTransaction): Promise<number> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO swap_transactions (
          tx_hash, user_address, token_in, token_out,
          amount_in, amount_out, dex_name, platform_fee,
          execution_price, slippage, status, block_number,
          timestamp, chain_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        query,
        [
          swap.tx_hash,
          swap.user_address.toLowerCase(),
          swap.token_in.toLowerCase(),
          swap.token_out.toLowerCase(),
          swap.amount_in,
          swap.amount_out,
          swap.dex_name,
          swap.platform_fee,
          swap.execution_price,
          swap.slippage || null,
          swap.status,
          swap.block_number || null,
          swap.timestamp,
          swap.chain_id,
        ],
        function (err: Error | null) {
          if (err) {
            logger.error('Failed to record swap transaction', { error: err.message, swap });
            reject(err);
          } else {
            logger.info('Swap transaction recorded', { id: this.lastID, tx_hash: swap.tx_hash });
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * 获取用户的 Swap 历史
   */
  async getUserSwapHistory(
    userAddress: string,
    chainId: number,
    limit: number = 50,
    offset: number = 0,
    swapType?: string
  ): Promise<SwapTransaction[]> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT * FROM swap_transactions
        WHERE user_address = ? AND chain_id = ?
      `;
      const params: any[] = [userAddress.toLowerCase(), chainId];

      if (swapType) {
        query += ' AND swap_type = ?';
        params.push(swapType);
      }

      query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      this.db.all(
        query,
        params,
        (err: Error | null, rows: any[]) => {
          if (err) {
            logger.error('Failed to get user swap history', { error: err.message, userAddress });
            reject(err);
          } else {
            resolve(rows as SwapTransaction[]);
          }
        }
      );
    });
  }

  /**
   * 获取用户的 Swap 交易数量
   */
  async getUserSwapCount(
    userAddress: string,
    chainId: number,
    swapType?: string
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT COUNT(*) as count FROM swap_transactions
        WHERE user_address = ? AND chain_id = ?
      `;
      const params: any[] = [userAddress.toLowerCase(), chainId];

      if (swapType) {
        query += ' AND swap_type = ?';
        params.push(swapType);
      }

      this.db.get(
        query,
        params,
        (err: Error | null, row: any) => {
          if (err) {
            logger.error('Failed to get user swap count', { error: err.message, userAddress });
            reject(err);
          } else {
            resolve(row.count || 0);
          }
        }
      );
    });
  }

  /**
   * 创建 TWAP 订单记录
   */
  async createTWAPOrder(order: TWAPOrder): Promise<number> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO twap_orders (
          order_id, user_address, token_in, token_out,
          total_amount, amount_per_trade, total_trades, executed_trades,
          trade_interval, max_duration, order_type, min_amount_out,
          status, created_tx_hash, created_at_timestamp, chain_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        query,
        [
          order.order_id,
          order.user_address.toLowerCase(),
          order.token_in.toLowerCase(),
          order.token_out.toLowerCase(),
          order.total_amount,
          order.amount_per_trade,
          order.total_trades,
          order.executed_trades,
          order.trade_interval,
          order.max_duration,
          order.order_type,
          order.min_amount_out || null,
          order.status,
          order.created_tx_hash || null,
          order.created_at_timestamp,
          order.chain_id,
        ],
        function (err: Error | null) {
          if (err) {
            logger.error('Failed to create TWAP order', { error: err.message, order });
            reject(err);
          } else {
            logger.info('TWAP order created', { id: this.lastID, order_id: order.order_id });
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * 获取用户的 TWAP 订单
   */
  async getUserTWAPOrders(
    userAddress: string,
    chainId: number,
    status?: string
  ): Promise<TWAPOrder[]> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT * FROM twap_orders
        WHERE user_address = ? AND chain_id = ?
      `;
      const params: any[] = [userAddress.toLowerCase(), chainId];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at_timestamp DESC';

      this.db.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
          logger.error('Failed to get user TWAP orders', { error: err.message, userAddress });
          reject(err);
        } else {
          resolve(rows as TWAPOrder[]);
        }
      });
    });
  }

  /**
   * 创建 Limit Order 记录
   */
  async createLimitOrder(order: LimitOrder): Promise<number> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO limit_orders (
          order_id, user_address, token_in, token_out,
          amount_in, min_amount_out, limit_price, expiry_time,
          status, created_tx_hash, created_at_timestamp, chain_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        query,
        [
          order.order_id,
          order.user_address.toLowerCase(),
          order.token_in.toLowerCase(),
          order.token_out.toLowerCase(),
          order.amount_in,
          order.min_amount_out,
          order.limit_price,
          order.expiry_time,
          order.status,
          order.created_tx_hash || null,
          order.created_at_timestamp,
          order.chain_id,
        ],
        function (err: Error | null) {
          if (err) {
            logger.error('Failed to create limit order', { error: err.message, order });
            reject(err);
          } else {
            logger.info('Limit order created', { id: this.lastID, order_id: order.order_id });
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * 获取用户的 Limit Orders
   */
  async getUserLimitOrders(
    userAddress: string,
    chainId: number,
    status?: string
  ): Promise<LimitOrder[]> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT * FROM limit_orders
        WHERE user_address = ? AND chain_id = ?
      `;
      const params: any[] = [userAddress.toLowerCase(), chainId];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at_timestamp DESC';

      this.db.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
          logger.error('Failed to get user limit orders', { error: err.message, userAddress });
          reject(err);
        } else {
          resolve(rows as LimitOrder[]);
        }
      });
    });
  }

  /**
   * 更新用户统计
   */
  async updateUserStats(
    userAddress: string,
    volumeUsd: number,
    feesPaidUsd: number,
    chainId: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO user_swap_stats (
          user_address, total_swaps, total_volume_usd, total_fees_paid_usd,
          first_swap_at, last_swap_at, chain_id
        ) VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(user_address) DO UPDATE SET
          total_swaps = total_swaps + 1,
          total_volume_usd = total_volume_usd + ?,
          total_fees_paid_usd = total_fees_paid_usd + ?,
          last_swap_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `;

      this.db.run(
        query,
        [
          userAddress.toLowerCase(),
          volumeUsd,
          feesPaidUsd,
          chainId,
          volumeUsd,
          feesPaidUsd,
        ],
        (err: Error | null) => {
          if (err) {
            logger.error('Failed to update user stats', { error: err.message, userAddress });
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * 获取用户统计
   */
  async getUserStats(userAddress: string, chainId: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM user_swap_stats
        WHERE user_address = ? AND chain_id = ?
      `;

      this.db.get(
        query,
        [userAddress.toLowerCase(), chainId],
        (err: Error | null, row: any) => {
          if (err) {
            logger.error('Failed to get user stats', { error: err.message, userAddress });
            reject(err);
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }
}

export const swapHistoryService = new SwapHistoryService();
