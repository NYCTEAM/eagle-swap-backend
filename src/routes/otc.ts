import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { 
  getOTCContractByChainId, 
  getOTCContractByNetwork,
  isOTCContractDeployed,
  getDeployedOTCContracts,
  getSupportedNetworks 
} from '../config/otc-contracts';

const router = Router();
const db = new Database(path.join(__dirname, '../../data/eagleswap.db'));

// 类型定义
interface OTCStats {
  volume_24h: number;
  trades_24h: number;
  active_orders: number;
  last_price: number;
  price_change_24h: number;
}

interface OTCUserStats {
  orders_created: number;
  orders_filled: number;
  orders_cancelled: number;
  orders_taken: number;
  volume_as_maker: number;
  volume_as_taker: number;
  total_volume: number;
  total_trades: number;
  first_trade_at: number | null;
  last_trade_at: number | null;
}

/**
 * 获取 OTC 合约配置
 * GET /api/otc/contracts
 */
router.get('/contracts', (req: Request, res: Response) => {
  try {
    const deployedContracts = getDeployedOTCContracts();
    const supportedNetworks = getSupportedNetworks();

    res.json({
      success: true,
      data: {
        deployedContracts,
        supportedNetworks,
        totalNetworks: supportedNetworks.length,
        deployedCount: deployedContracts.length,
      },
    });
  } catch (error) {
    console.error('❌ 获取合约配置失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contract configuration',
    });
  }
});

/**
 * 根据网络获取合约地址
 * GET /api/otc/contract/:network
 */
router.get('/contract/:network', (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const contract = getOTCContractByNetwork(network);

    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Network not supported',
      });
    }

    res.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error('❌ 获取合约地址失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contract address',
    });
  }
});

/**
 * 获取活跃订单列表
 * GET /api/otc/orders?status=open&network=X Layer&limit=50
 */
router.get('/orders', (req: Request, res: Response) => {
  try {
    const { status = 'open', network, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM otc_orders WHERE 1=1';
    const params: any[] = [];

    if (status) {
      if (status === 'open') {
        // 'open' 状态包含 'open' 和 'partial' 状态的订单
        query += ' AND (status = ? OR status = ?)';
        params.push('open', 'partial');
      } else {
        query += ' AND status = ?';
        params.push(status);
      }
    }

    if (network) {
      query += ' AND LOWER(network) = LOWER(?)';
      params.push(network);
    }

    // 过滤过期订单
    if (status === 'open') {
      query += ' AND (expiry_ts = 0 OR expiry_ts > ?)';
      params.push(Math.floor(Date.now() / 1000));
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const orders = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('❌ 获取订单列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
    });
  }
});

/**
 * 获取用户的订单
 * GET /api/otc/orders/user/:address
 */
router.get('/orders/user/:address', (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { network, status } = req.query;

    let query = 'SELECT * FROM otc_orders WHERE maker_address = ?';
    const params: any[] = [address.toLowerCase()];

    if (network) {
      query += ' AND LOWER(network) = LOWER(?)';
      params.push(network);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const orders = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('❌ 获取用户订单失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user orders',
    });
  }
});

/**
 * 获取交易历史
 * GET /api/otc/history?limit=50&network=X Layer
 */
router.get('/history', (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0, network } = req.query;

    let query = 'SELECT * FROM otc_fills WHERE 1=1';
    const params: any[] = [];

    if (network) {
      query += ' AND network = ?';
      params.push(network);
    }

    query += ' ORDER BY filled_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const fills = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: fills,
      count: fills.length,
    });
  } catch (error) {
    console.error('❌ 获取交易历史失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trade history',
    });
  }
});

/**
 * 获取用户交易历史
 * GET /api/otc/history/user/:address
 */
router.get('/history/user/:address', (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { network, limit = 50 } = req.query;

    let query = `
      SELECT * FROM otc_fills 
      WHERE maker_address = ? OR taker_address = ?
    `;
    const params: any[] = [address.toLowerCase(), address.toLowerCase()];

    if (network) {
      query += ' AND network = ?';
      params.push(network);
    }

    query += ' ORDER BY filled_at DESC LIMIT ?';
    params.push(Number(limit));

    const fills = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: fills,
      count: fills.length,
    });
  } catch (error) {
    console.error('❌ 获取用户交易历史失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user trade history',
    });
  }
});

/**
 * 获取 OTC 统计数据
 * GET /api/otc/stats?network=X Layer
 */
router.get('/stats', (req: Request, res: Response) => {
  const { network = 'X Layer' } = req.query;
  try {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;

    // 计算总订单数
    const totalOrdersResult = db
      .prepare('SELECT COUNT(*) as count FROM otc_orders WHERE LOWER(network) = LOWER(?)')
      .get(network) as { count: number };
    const totalOrders = totalOrdersResult?.count || 0;

    // 计算活跃订单数（open 和 partial 状态）
    const activeOrdersResult = db
      .prepare('SELECT COUNT(*) as count FROM otc_orders WHERE LOWER(network) = LOWER(?) AND (status = ? OR status = ?) AND (expiry_ts = 0 OR expiry_ts > ?)')
      .get(network, 'open', 'partial', now) as { count: number };
    const activeOrders = activeOrdersResult?.count || 0;

    // 计算总成交数
    const totalTradesResult = db
      .prepare('SELECT COUNT(*) as count FROM otc_fills WHERE LOWER(network) = LOWER(?)')
      .get(network) as { count: number };
    const totalTrades = totalTradesResult?.count || 0;

    // 计算24小时成交数
    const trades24hResult = db
      .prepare('SELECT COUNT(*) as count FROM otc_fills WHERE LOWER(network) = LOWER(?) AND filled_at >= ?')
      .get(network, oneDayAgo) as { count: number };
    const trades24h = trades24hResult?.count || 0;

    // 计算24小时成交量（USDT）
    const volume24hResult = db
      .prepare('SELECT SUM(quote_amount) as volume FROM otc_fills WHERE LOWER(network) = LOWER(?) AND filled_at >= ?')
      .get(network, oneDayAgo) as { volume: number | null };
    const totalVolume24h = volume24hResult?.volume || 0;

    // 获取最新成交价格
    const lastFill = db
      .prepare('SELECT price FROM otc_fills WHERE LOWER(network) = LOWER(?) ORDER BY filled_at DESC LIMIT 1')
      .get(network) as { price: number } | undefined;
    const lastPrice = lastFill?.price || 0;

    // 计算24小时价格变化
    const firstFill24h = db
      .prepare('SELECT price FROM otc_fills WHERE LOWER(network) = LOWER(?) AND filled_at >= ? ORDER BY filled_at ASC LIMIT 1')
      .get(network, oneDayAgo) as { price: number } | undefined;
    const priceChange24h = firstFill24h && lastPrice 
      ? ((lastPrice - firstFill24h.price) / firstFill24h.price) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        totalVolume24h: totalVolume24h ? parseFloat(totalVolume24h.toFixed(2)) : 0,
        totalOrders,
        activeOrders,
        totalTrades,
        lastPrice: lastPrice ? parseFloat(lastPrice.toFixed(4)) : 0,
        priceChange24h: priceChange24h ? parseFloat(priceChange24h.toFixed(2)) : 0,
      },
    });
  } catch (error) {
    console.error('❌ 获取统计数据失败:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      network,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * 获取用户统计数据
 * GET /api/otc/stats/user/:address
 */
router.get('/stats/user/:address', (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { network = 'X Layer' } = req.query;

    const stats = db
      .prepare('SELECT * FROM otc_user_stats WHERE user_address = ? AND network = ?')
      .get(address.toLowerCase(), network) as OTCUserStats | undefined;

    if (!stats) {
      return res.json({
        success: true,
        data: {
          ordersCreated: 0,
          ordersFilled: 0,
          ordersCancelled: 0,
          ordersTaken: 0,
          totalVolume: 0,
          totalTrades: 0,
        },
      });
    }

    res.json({
      success: true,
      data: {
        ordersCreated: stats.orders_created || 0,
        ordersFilled: stats.orders_filled || 0,
        ordersCancelled: stats.orders_cancelled || 0,
        ordersTaken: stats.orders_taken || 0,
        volumeAsMaker: stats.volume_as_maker || 0,
        volumeAsTaker: stats.volume_as_taker || 0,
        totalVolume: stats.total_volume || 0,
        totalTrades: stats.total_trades || 0,
        firstTradeAt: stats.first_trade_at,
        lastTradeAt: stats.last_trade_at,
      },
    });
  } catch (error) {
    console.error('❌ 获取用户统计失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics',
    });
  }
});

/**
 * 记录订单创建（由前端在合约交易成功后调用）
 * POST /api/otc/orders
 */
router.post('/orders', (req: Request, res: Response) => {
  try {
    const {
      orderId,
      type, // 'buy' | 'sell'
      maker,
      baseToken,
      quoteToken,
      baseAmount,
      quoteAmount,
      price,
      network,
      chainId,
      txHash,
      blockNumber,
      expiryTs = 0,
    } = req.body;

    // 验证必填字段
    if (!orderId || !type || !maker || !baseToken || !quoteToken || !baseAmount || !quoteAmount || !network || !txHash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // 确定买卖方向和代币对应关系
    // 注意：前端传来的 amount 都是 Wei 单位
    // 为了数据库存储方便（类型为 REAL），我们直接存储 Wei 值
    // 虽然 REAL 可能有精度问题，但仅用于排序和显示，实际交易走链上
    let tokenSell, tokenBuy, amountSell, amountBuy;

    if (type === 'buy') {
      // 买入 EAGLE (Base)，支付 USDT (Quote)
      tokenSell = quoteToken;
      tokenBuy = baseToken;
      amountSell = quoteAmount;
      amountBuy = baseAmount;
    } else {
      // 卖出 EAGLE (Base)，获得 USDT (Quote)
      tokenSell = baseToken;
      tokenBuy = quoteToken;
      amountSell = baseAmount;
      amountBuy = quoteAmount;
    }

    // 插入订单记录
    const stmt = db.prepare(`
      INSERT INTO otc_orders (
        order_id, maker_address, side, 
        token_sell, token_buy,
        amount_sell, amount_buy, amount_remaining,
        price_usdt, status,
        created_at, expiry_ts, updated_at,
        network, chain_id, tx_hash, contract_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      orderId,
      maker.toLowerCase(),
      type,
      tokenSell.toLowerCase(),
      tokenBuy.toLowerCase(),
      amountSell,
      amountBuy,
      amountSell, // 初始剩余数量 = 出售数量
      price,
      'open',
      now,
      expiryTs,
      now,
      network,
      chainId,
      txHash,
      null // contract_address (可选)
    );

    // 更新用户统计
    updateUserStats(maker.toLowerCase(), network, 'order_created');

    res.json({
      success: true,
      data: { orderId, status: 'open' },
    });
  } catch (error) {
    console.error('❌ 记录订单失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record order',
    });
  }
});

/**
 * 记录订单成交（由前端在合约交易成功后调用）
 * POST /api/otc/fills
 */
router.post('/fills', (req: Request, res: Response) => {
  try {
    const {
      orderId,
      taker,
      baseAmount,
      quoteAmount,
      network,
      txHash,
      blockNumber,
    } = req.body;

    if (!orderId || !taker || !baseAmount || !quoteAmount || !network || !txHash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // 获取订单信息
    const order = db
      .prepare('SELECT * FROM otc_orders WHERE order_id = ?')
      .get(orderId) as any;

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // 插入成交记录
    const fillStmt = db.prepare(`
      INSERT INTO otc_fills (
        order_id, maker_address, taker_address,
        base_token, quote_token, base_amount, quote_amount,
        price, network, tx_hash, block_number, filled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    fillStmt.run(
      orderId,
      order.maker_address,
      taker.toLowerCase(),
      order.base_token,
      order.quote_token,
      baseAmount,
      quoteAmount,
      order.price,
      network,
      txHash,
      blockNumber || 0,
      now
    );

    // 计算新的剩余数量
    const currentRemaining = parseFloat(order.amount_remaining || order.amount_sell || order.amount_buy);
    const fillAmountFloat = parseFloat(baseAmount);
    const newRemaining = Math.max(0, currentRemaining - fillAmountFloat);
    
    // 根据剩余数量决定订单状态
    const newStatus = newRemaining <= 0.000001 ? 'filled' : 'partial'; // 考虑浮点精度
    
    console.log(`📊 [Fill Order] Updating order ${orderId}:`, {
      currentRemaining,
      fillAmount: fillAmountFloat,
      newRemaining,
      newStatus
    });

    // 更新订单状态和剩余数量
    db.prepare(`
      UPDATE otc_orders 
      SET status = ?, amount_remaining = ?, updated_at = ? 
      WHERE order_id = ?
    `).run(newStatus, newRemaining.toString(), now, orderId);

    // 更新用户统计
    updateUserStats(order.maker_address, network, 'order_filled');
    updateUserStats(taker.toLowerCase(), network, 'order_taken');

    res.json({
      success: true,
      data: { 
        orderId, 
        status: newStatus,
        remainingAmount: newRemaining.toString(),
        filledAmount: fillAmountFloat.toString()
      },
    });
  } catch (error) {
    console.error('❌ 记录成交失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record fill',
    });
  }
});

/**
 * 记录订单取消（由前端在合约交易成功后调用）
 * DELETE /api/otc/orders/:orderId
 */
router.delete('/orders/:orderId', (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { maker, network } = req.body;

    if (!maker || !network) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // 验证订单存在且属于该用户
    const order = db
      .prepare('SELECT * FROM otc_orders WHERE order_id = ? AND maker_address = ?')
      .get(orderId, maker.toLowerCase()) as any;

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or unauthorized',
      });
    }

    // 更新订单状态
    db.prepare('UPDATE otc_orders SET status = ?, updated_at = ? WHERE order_id = ?')
      .run('cancelled', now, orderId);

    // 更新用户统计
    updateUserStats(maker.toLowerCase(), network, 'order_cancelled');

    res.json({
      success: true,
      data: { orderId, status: 'cancelled' },
    });
  } catch (error) {
    console.error('❌ 取消订单失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order',
    });
  }
});

/**
 * 更新用户统计
 */
function updateUserStats(address: string, network: string, action: string) {
  try {
    const now = Math.floor(Date.now() / 1000);

    // 检查是否存在统计记录
    const existing = db
      .prepare('SELECT * FROM otc_user_stats WHERE user_address = ? AND network = ?')
      .get(address, network) as OTCUserStats | undefined;

    if (!existing) {
      // 创建新记录
      db.prepare(`
        INSERT INTO otc_user_stats (
          user_address, network, orders_created, orders_filled,
          orders_cancelled, orders_taken, volume_as_maker,
          volume_as_taker, total_volume, total_trades,
          first_trade_at, last_trade_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        address,
        network,
        action === 'order_created' ? 1 : 0,
        action === 'order_filled' ? 1 : 0,
        action === 'order_cancelled' ? 1 : 0,
        action === 'order_taken' ? 1 : 0,
        0, 0, 0, 0,
        now,
        now
      );
    } else {
      // 更新现有记录
      let updateQuery = 'UPDATE otc_user_stats SET last_trade_at = ?';
      const params: any[] = [now];

      if (action === 'order_created') {
        updateQuery += ', orders_created = orders_created + 1';
      } else if (action === 'order_filled') {
        updateQuery += ', orders_filled = orders_filled + 1';
      } else if (action === 'order_cancelled') {
        updateQuery += ', orders_cancelled = orders_cancelled + 1';
      } else if (action === 'order_taken') {
        updateQuery += ', orders_taken = orders_taken + 1';
      }

      updateQuery += ' WHERE user_address = ? AND network = ?';
      params.push(address, network);

      db.prepare(updateQuery).run(...params);
    }
  } catch (error) {
    console.error('❌ 更新用户统计失败:', error);
  }
}

/**
 * 健康检查
 * GET /api/otc/health
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const deployedContracts = getDeployedOTCContracts();
    
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      contractsDeployed: deployedContracts.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
