import { Router, Request, Response } from 'express';
import { chartDataService } from '../services/chartDataService';
import { xlayerPriceService } from '../services/xlayerPriceService';
import { smartPriceService } from '../services/smartPriceService';
import { logger } from '../utils/logger';
import { hotPairsMonitor } from '../services/hotPairsMonitor';

const router = Router();

/**
 * 获取 K 线数据
 * GET /api/xlayer-chart/candles
 */
router.get('/candles', async (req: Request, res: Response) => {
  try {
    const {
      tokenPair,
      dex = 'quickswap',
      timeframe = '15m',
      from,
      to,
      limit = 1000,
    } = req.query;

    // 验证参数
    if (!tokenPair) {
      return res.status(400).json({
        success: false,
        message: 'tokenPair is required',
      });
    }

    const fromTimestamp = from ? parseInt(from as string) : Math.floor(Date.now() / 1000) - 24 * 3600;
    const toTimestamp = to ? parseInt(to as string) : Math.floor(Date.now() / 1000);

    // 获取 K 线数据
    const candles = await chartDataService.getCandles(
      tokenPair as string,
      dex as string,
      timeframe as string,
      fromTimestamp,
      toTimestamp,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: candles,
      meta: {
        tokenPair,
        dex,
        timeframe,
        from: fromTimestamp,
        to: toTimestamp,
        count: candles.length,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get candles', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get candles',
      error: error.message,
    });
  }
});

/**
 * 获取实时价格
 * GET /api/xlayer-chart/price
 */
router.get('/price', async (req: Request, res: Response) => {
  try {
    const { token0, token1, dex = 'quickswap' } = req.query;

    // 验证参数
    if (!token0 || !token1) {
      return res.status(400).json({
        success: false,
        message: 'token0 and token1 are required',
      });
    }

    // 从链上获取实时价格
    const priceData = await xlayerPriceService.getTokenPairPrice(
      token0 as string,
      token1 as string,
      dex as 'quickswap' | 'potato'
    );

    if (!priceData) {
      return res.status(404).json({
        success: false,
        message: 'Price not found',
      });
    }

    res.json({
      success: true,
      data: {
        price: priceData.price,
        reserve0: priceData.reserve0,
        reserve1: priceData.reserve1,
        token0Address: priceData.token0Address,
        token1Address: priceData.token1Address,
        timestamp: priceData.timestamp,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get price', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get price',
      error: error.message,
    });
  }
});

/**
 * 获取最新价格（从数据库）
 * GET /api/xlayer-chart/latest-price
 */
router.get('/latest-price', async (req: Request, res: Response) => {
  try {
    const { tokenPair, dex = 'quickswap' } = req.query;

    if (!tokenPair) {
      return res.status(400).json({
        success: false,
        message: 'tokenPair is required',
      });
    }

    const price = await chartDataService.getLatestPrice(
      tokenPair as string,
      dex as string
    );

    if (price === null) {
      return res.status(404).json({
        success: false,
        message: 'Price not found',
      });
    }

    res.json({
      success: true,
      data: {
        price,
        tokenPair,
        dex,
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get latest price', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get latest price',
      error: error.message,
    });
  }
});

/**
 * 手动触发价格快照（用于测试）
 * POST /api/xlayer-chart/snapshot
 */
router.post('/snapshot', async (req: Request, res: Response) => {
  try {
    const { token0, token1, dex = 'quickswap' } = req.body;

    if (!token0 || !token1) {
      return res.status(400).json({
        success: false,
        message: 'token0 and token1 are required',
      });
    }

    // 获取价格
    const priceData = await xlayerPriceService.getTokenPairPrice(
      token0,
      token1,
      dex
    );

    if (!priceData) {
      return res.status(404).json({
        success: false,
        message: 'Failed to get price from chain',
      });
    }

    // 记录快照
    const tokenPair = `${token0}/${token1}`;
    await chartDataService.recordPriceSnapshot(
      tokenPair,
      priceData.token0Address,
      priceData.token1Address,
      dex,
      priceData.price,
      priceData.reserve0,
      priceData.reserve1
    );

    res.json({
      success: true,
      message: 'Price snapshot recorded',
      data: priceData,
    });
  } catch (error: any) {
    logger.error('Failed to record snapshot', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to record snapshot',
      error: error.message,
    });
  }
});

/**
 * 手动触发 K 线聚合（用于测试）
 * POST /api/xlayer-chart/aggregate
 */
router.post('/aggregate', async (req: Request, res: Response) => {
  try {
    const {
      tokenPair,
      dex = 'quickswap',
      timeframe = '15m',
      from,
      to,
    } = req.body;

    if (!tokenPair) {
      return res.status(400).json({
        success: false,
        message: 'tokenPair is required',
      });
    }

    const fromTimestamp = from || Math.floor(Date.now() / 1000) - 24 * 3600;
    const toTimestamp = to || Math.floor(Date.now() / 1000);

    await chartDataService.aggregateCandles(
      tokenPair,
      dex,
      timeframe,
      fromTimestamp,
      toTimestamp
    );

    res.json({
      success: true,
      message: 'Candles aggregated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to aggregate candles', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to aggregate candles',
      error: error.message,
    });
  }
});

/**
 * 手动触发热门代币扫描
 * POST /api/xlayer-chart/scan-hot-pairs
 */
router.post('/scan-hot-pairs', async (req: Request, res: Response) => {
  try {
    await hotPairsMonitor.triggerScan();

    res.json({
      success: true,
      message: 'Hot pairs scan triggered successfully',
    });
  } catch (error: any) {
    logger.error('Failed to scan hot pairs', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to scan hot pairs',
      error: error.message,
    });
  }
});

/**
 * 手动触发清理归零代币
 * POST /api/xlayer-chart/cleanup
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    await hotPairsMonitor.triggerCleanup();

    res.json({
      success: true,
      message: 'Cleanup triggered successfully',
    });
  } catch (error: any) {
    logger.error('Failed to cleanup', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup',
      error: error.message,
    });
  }
});

/**
 * 智能获取代币价格（通过合约地址）
 * GET /api/xlayer-chart/smart-price?tokenIn=0x...&tokenOut=0x...
 * 自动识别合约地址，自动查找流动性池，统一转换为 USDT 价格
 */
router.get('/smart-price', async (req: Request, res: Response) => {
  try {
    const { tokenIn, tokenOut } = req.query;

    if (!tokenIn || !tokenOut) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: tokenIn, tokenOut',
      });
    }

    const result = await smartPriceService.getTokenPairPrice(
      tokenIn as string,
      tokenOut as string
    );

    if (!result) {
      return res.json({
        success: false,
        message: 'Could not find price for this token pair',
      });
    }

    res.json({
      success: true,
      data: {
        price: result.price,
        priceInUSDT: result.priceInUSDT,
        tokenIn: tokenIn as string,
        tokenOut: tokenOut as string,
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get smart price', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get smart price',
      error: error.message,
    });
  }
});

/**
 * 批量获取代币价格（以 USDT 计价）
 * POST /api/xlayer-chart/batch-prices
 * Body: { tokens: ["0x...", "0x..."] }
 */
router.post('/batch-prices', async (req: Request, res: Response) => {
  try {
    const { tokens } = req.body;

    if (!tokens || !Array.isArray(tokens)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: tokens (array)',
      });
    }

    const prices = await smartPriceService.getBatchPrices(tokens);

    const result: any = {};
    prices.forEach((price, address) => {
      result[address] = price;
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to get batch prices', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get batch prices',
      error: error.message,
    });
  }
});

export default router;
