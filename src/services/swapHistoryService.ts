import { db } from '../database';
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
  /**
   * 记录 Swap 交易
   */
  async recordSwapTransaction(swap: SwapTransaction): Promise<number> {
    try {
      const query = `
        INSERT INTO swap_transactions (
          tx_hash, user_address, token_in, token_out,
          amount_in, amount_out, dex_name, platform_fee,
          execution_price, slippage, status, block_number,
          timestamp, chain_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = db.prepare(query).run(
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
        swap.chain_id
      );

      logger.info('Swap transaction recorded', { id: result.lastInsertRowid, tx_hash: swap.tx_hash });
      return result.lastInsertRowid as number;
    } catch (err: any) {
      logger.error('Failed to record swap transaction', { error: err.message, swap });
      throw err;
    }
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
    try {
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

      const rows = db.prepare(query).all(...params);
      return rows as SwapTransaction[];
    } catch (err: any) {
      logger.error('Failed to get user swap history', { error: err.message, userAddress });
      throw err;
    }
  }

  /**
   * 获取用户的 Swap 交易数量
   */
  async getUserSwapCount(
    userAddress: string,
    chainId: number,
    swapType?: string
  ): Promise<number> {
    try {
      let query = `
        SELECT COUNT(*) as count FROM swap_transactions
        WHERE user_address = ? AND chain_id = ?
      `;
      const params: any[] = [userAddress.toLowerCase(), chainId];

      if (swapType) {
        query += ' AND swap_type = ?';
        params.push(swapType);
      }

      const row: any = db.prepare(query).get(...params);
      return row?.count || 0;
    } catch (err: any) {
      logger.error('Failed to get user swap count', { error: err.message, userAddress });
      throw err;
    }
  }

  /**
   * 创建 TWAP 订单记录
   */
  async createTWAPOrder(order: TWAPOrder): Promise<number> {
    try {
      const query = `
        INSERT INTO twap_orders (
          order_id, user_address, token_in, token_out,
          total_amount, amount_per_trade, total_trades, executed_trades,
          trade_interval, max_duration, order_type, min_amount_out,
          status, created_tx_hash, created_at_timestamp, chain_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = db.prepare(query).run(
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
        order.chain_id
      );

      logger.info('TWAP order created', { id: result.lastInsertRowid, order_id: order.order_id });
      return result.lastInsertRowid as number;
    } catch (err: any) {
      logger.error('Failed to create TWAP order', { error: err.message, order });
      throw err;
    }
  }

  /**
   * 获取用户的 TWAP 订单
   */
  async getUserTWAPOrders(
    userAddress: string,
    chainId: number,
    status?: string
  ): Promise<TWAPOrder[]> {
    try {
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

      const rows = db.prepare(query).all(...params);
      return rows as TWAPOrder[];
    } catch (err: any) {
      logger.error('Failed to get user TWAP orders', { error: err.message, userAddress });
      throw err;
    }
  }

  /**
   * 创建 Limit Order 记录
   */
  async createLimitOrder(order: LimitOrder): Promise<number> {
    try {
      const query = `
        INSERT INTO limit_orders (
          order_id, user_address, token_in, token_out,
          amount_in, min_amount_out, limit_price, expiry_time,
          status, created_tx_hash, created_at_timestamp, chain_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = db.prepare(query).run(
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
        order.chain_id
      );

      logger.info('Limit order created', { id: result.lastInsertRowid, order_id: order.order_id });
      return result.lastInsertRowid as number;
    } catch (err: any) {
      logger.error('Failed to create limit order', { error: err.message, order });
      throw err;
    }
  }

  /**
   * 获取用户的 Limit Orders
   */
  async getUserLimitOrders(
    userAddress: string,
    chainId: number,
    status?: string
  ): Promise<LimitOrder[]> {
    try {
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

      const rows = db.prepare(query).all(...params);
      return rows as LimitOrder[];
    } catch (err: any) {
      logger.error('Failed to get user limit orders', { error: err.message, userAddress });
      throw err;
    }
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
    try {
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

      db.prepare(query).run(
        userAddress.toLowerCase(),
        volumeUsd,
        feesPaidUsd,
        chainId,
        volumeUsd,
        feesPaidUsd
      );
    } catch (err: any) {
      logger.error('Failed to update user stats', { error: err.message, userAddress });
      throw err;
    }
  }

  /**
   * 获取用户统计
   */
  async getUserStats(userAddress: string, chainId: number): Promise<any> {
    try {
      const query = `
        SELECT * FROM user_swap_stats
        WHERE user_address = ? AND chain_id = ?
      `;

      const row: any = db.prepare(query).get(userAddress.toLowerCase(), chainId);
      return row || null;
    } catch (err: any) {
      logger.error('Failed to get user stats', { error: err.message, userAddress });
      throw err;
    }
  }
}

export const swapHistoryService = new SwapHistoryService();
