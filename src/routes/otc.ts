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
      query += ' AND status = ?';
      params.push(status);
    }

    if (network) {
      query += ' AND network = ?';
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
      query += ' AND network = ?';
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
  try {
    const { network = 'X Layer' } = req.query;

    const stats = db
      .prepare('SELECT * FROM otc_stats WHERE network = ?')
      .get(network) as OTCStats | undefined;

    if (!stats) {
      return res.json({
        success: true,
        data: {
          totalVolume24h: 0,
          totalOrders: 0,
          activeOrders: 0,
          totalTrades: 0,
          lastPrice: 0,
          priceChange24h: 0,
        },
      });
    }

    res.json({
      success: true,
      data: {
        totalVolume24h: stats.volume_24h || 0,
        totalOrders: stats.active_orders || 0,
        activeOrders: stats.active_orders || 0,
        totalTrades: stats.trades_24h || 0,
        lastPrice: stats.last_price || 0,
        priceChange24h: stats.price_change_24h || 0,
      },
    });
  } catch (error) {
    console.error('❌ 获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
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
