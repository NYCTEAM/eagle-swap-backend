import { Router } from 'express';
import { swapHistoryService } from '../services/swapHistoryService';
import { asyncHandler } from '../middleware/errorHandler';
import { param, query } from 'express-validator';
import { checkValidation } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/swap-history/:userAddress
 * 获取用户的 Swap 历史记录
 */
router.get('/:userAddress',
  param('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
  query('chainId').optional().isInt({ min: 1 }).withMessage('Invalid chain ID'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('swapType').optional().isIn(['instant', 'twap', 'limit']).withMessage('Invalid swap type'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { userAddress } = req.params;
    const chainId = parseInt(req.query.chainId as string) || 0; // 0 = all chains
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const swapType = req.query.swapType as string | undefined;

    const history = await swapHistoryService.getUserSwapHistory(
      userAddress,
      chainId,
      limit,
      offset,
      swapType
    );

    const total = await swapHistoryService.getUserSwapCount(userAddress, chainId, swapType);

    res.json({
      success: true,
      data: {
        transactions: history,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        hasMore: offset + limit < total
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * GET /api/swap-history/:userAddress/stats
 * 获取用户的 Swap 统计数据
 */
router.get('/:userAddress/stats',
  param('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
  query('chainId').optional().isInt({ min: 1 }).withMessage('Invalid chain ID'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { userAddress } = req.params;
    const chainId = parseInt(req.query.chainId as string) || 196;

    const stats = await swapHistoryService.getUserStats(userAddress, chainId);

    res.json({
      success: true,
      data: stats || {
        total_swaps: 0,
        total_instant_swaps: 0,
        total_twap_orders: 0,
        total_limit_orders: 0,
        total_volume_usd: 0,
        total_fees_paid_usd: 0,
        total_referral_earnings_usd: 0,
        first_swap_at: null,
        last_swap_at: null
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * GET /api/swap-history/twap/:userAddress
 * 获取用户的 TWAP 订单
 */
router.get('/twap/:userAddress',
  param('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
  query('chainId').optional().isInt({ min: 1 }).withMessage('Invalid chain ID'),
  query('status').optional().isIn(['active', 'completed', 'cancelled', 'expired']).withMessage('Invalid status'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { userAddress } = req.params;
    const chainId = parseInt(req.query.chainId as string) || 196;
    const status = req.query.status as string | undefined;

    const orders = await swapHistoryService.getUserTWAPOrders(userAddress, chainId, status);

    res.json({
      success: true,
      data: {
        orders,
        total: orders.length
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * GET /api/swap-history/limit/:userAddress
 * 获取用户的 Limit Orders
 */
router.get('/limit/:userAddress',
  param('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
  query('chainId').optional().isInt({ min: 1 }).withMessage('Invalid chain ID'),
  query('status').optional().isIn(['active', 'filled', 'cancelled', 'expired']).withMessage('Invalid status'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { userAddress } = req.params;
    const chainId = parseInt(req.query.chainId as string) || 196;
    const status = req.query.status as string | undefined;

    const orders = await swapHistoryService.getUserLimitOrders(userAddress, chainId, status);

    res.json({
      success: true,
      data: {
        orders,
        total: orders.length
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * POST /api/swap-history/record
 * 记录 Swap 交易（内部使用）
 */
router.post('/record',
  asyncHandler(async (req, res) => {
    const swapData = req.body;

    // 记录交易
    const id = await swapHistoryService.recordSwapTransaction(swapData);

    // 更新用户统计
    if (swapData.platform_fee_usd) {
      await swapHistoryService.updateUserStats(
        swapData.user_address,
        parseFloat(swapData.amount_in) || 0,
        swapData.platform_fee_usd,
        swapData.chain_id
      );
    }

    logger.info('Swap transaction recorded', { id, tx_hash: swapData.tx_hash });

    res.json({
      success: true,
      data: { id },
      timestamp: new Date().toISOString()
    });
  })
);

export default router;
