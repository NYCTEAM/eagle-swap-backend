import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { body, param, query } from 'express-validator';
import { checkValidation } from '../middleware/validation';
import { logger } from '../utils/logger';
import { db } from '../database/db';

const router = Router();

// Solana Base58 地址验证 (简化版)
const isSolanaAddress = (value: string) => {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
};

/**
 * POST /api/solana-swap/record
 * 记录 Solana Swap 交易
 */
router.post('/record',
  body('signature').isString().notEmpty().withMessage('Transaction signature is required'),
  body('userAddress').custom(isSolanaAddress).withMessage('Invalid Solana address'),
  body('tokenInMint').custom(isSolanaAddress).withMessage('Invalid input token mint'),
  body('tokenOutMint').custom(isSolanaAddress).withMessage('Invalid output token mint'),
  body('amountIn').isString().notEmpty().withMessage('Amount in is required'),
  body('amountOut').isString().notEmpty().withMessage('Amount out is required'),
  body('dexName').isString().notEmpty().withMessage('DEX name is required'),
  body('platformFee').isString().notEmpty().withMessage('Platform fee is required'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const {
      signature,
      userAddress,
      tokenInMint,
      tokenOutMint,
      tokenInSymbol,
      tokenOutSymbol,
      amountIn,
      amountOut,
      amountInUsd,
      amountOutUsd,
      dexName,
      routePath,
      platformFee,
      platformFeeUsd,
      slippageBps,
      priceImpactPct,
      executionPrice,
      status = 'success',
      slot,
      blockTime
    } = req.body;

    try {
      // 插入交易记录
      const result = await db.run(`
        INSERT INTO solana_swap_transactions (
          signature, user_address, token_in_mint, token_out_mint,
          token_in_symbol, token_out_symbol, amount_in, amount_out,
          amount_in_usd, amount_out_usd, dex_name, route_path,
          platform_fee, platform_fee_usd, slippage_bps, price_impact_pct,
          execution_price, status, slot, block_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        signature, userAddress, tokenInMint, tokenOutMint,
        tokenInSymbol || null, tokenOutSymbol || null, amountIn, amountOut,
        amountInUsd || null, amountOutUsd || null, dexName, routePath ? JSON.stringify(routePath) : null,
        platformFee, platformFeeUsd || null, slippageBps || null, priceImpactPct || null,
        executionPrice || null, status, slot || null, blockTime || null
      ]);

      // 更新用户统计
      await db.run(`
        INSERT INTO solana_user_stats (user_address, total_swaps, total_volume_usd, total_fees_paid_usd, first_swap_at, last_swap_at)
        VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_address) DO UPDATE SET
          total_swaps = total_swaps + 1,
          total_volume_usd = total_volume_usd + ?,
          total_fees_paid_usd = total_fees_paid_usd + ?,
          last_swap_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `, [
        userAddress, 
        amountInUsd || 0, 
        platformFeeUsd || 0,
        amountInUsd || 0,
        platformFeeUsd || 0
      ]);

      // 更新代币对统计
      await db.run(`
        INSERT INTO solana_token_pair_stats (
          token_in_mint, token_out_mint, token_in_symbol, token_out_symbol,
          total_swaps, total_volume_in, total_volume_out, total_volume_usd, last_swap_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(token_in_mint, token_out_mint) DO UPDATE SET
          total_swaps = total_swaps + 1,
          total_volume_in = CAST((CAST(total_volume_in AS REAL) + CAST(? AS REAL)) AS TEXT),
          total_volume_out = CAST((CAST(total_volume_out AS REAL) + CAST(? AS REAL)) AS TEXT),
          total_volume_usd = total_volume_usd + ?,
          last_swap_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `, [
        tokenInMint, tokenOutMint, tokenInSymbol || null, tokenOutSymbol || null,
        amountIn, amountOut, amountInUsd || 0,
        amountIn, amountOut, amountInUsd || 0
      ]);

      // 更新平台费用统计
      const today = new Date().toISOString().split('T')[0];
      await db.run(`
        INSERT INTO solana_platform_fees (date, total_fees_sol, total_fees_usdc, total_fees_usd, transaction_count)
        VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(date) DO UPDATE SET
          total_fees_sol = total_fees_sol + ?,
          total_fees_usdc = total_fees_usdc + ?,
          total_fees_usd = total_fees_usd + ?,
          transaction_count = transaction_count + 1,
          updated_at = CURRENT_TIMESTAMP
      `, [
        today,
        tokenOutSymbol === 'SOL' ? parseFloat(platformFee) : 0,
        tokenOutSymbol === 'USDC' ? parseFloat(platformFee) : 0,
        platformFeeUsd || 0,
        tokenOutSymbol === 'SOL' ? parseFloat(platformFee) : 0,
        tokenOutSymbol === 'USDC' ? parseFloat(platformFee) : 0,
        platformFeeUsd || 0
      ]);

      logger.info('Solana swap recorded', { signature, userAddress, dexName });

      res.json({
        success: true,
        data: { id: result.lastID, signature },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      // 处理重复签名
      if (error.message?.includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          success: false,
          error: 'Transaction already recorded',
          timestamp: new Date().toISOString()
        });
      }
      throw error;
    }
  })
);

/**
 * GET /api/solana-swap/history/:userAddress
 * 获取用户的 Solana Swap 历史
 */
router.get('/history/:userAddress',
  param('userAddress').custom(isSolanaAddress).withMessage('Invalid Solana address'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { userAddress } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = await db.all(`
      SELECT * FROM solana_swap_transactions
      WHERE user_address = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [userAddress, limit, offset]);

    const countResult = await db.get(`
      SELECT COUNT(*) as total FROM solana_swap_transactions
      WHERE user_address = ?
    `, [userAddress]);

    res.json({
      success: true,
      data: {
        transactions,
        total: countResult?.total || 0,
        page: Math.floor(offset / limit) + 1,
        limit,
        hasMore: offset + limit < (countResult?.total || 0)
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * GET /api/solana-swap/stats/:userAddress
 * 获取用户的 Solana Swap 统计
 */
router.get('/stats/:userAddress',
  param('userAddress').custom(isSolanaAddress).withMessage('Invalid Solana address'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { userAddress } = req.params;

    const stats = await db.get(`
      SELECT * FROM solana_user_stats
      WHERE user_address = ?
    `, [userAddress]);

    res.json({
      success: true,
      data: stats || {
        total_swaps: 0,
        total_volume_usd: 0,
        total_fees_paid_usd: 0,
        first_swap_at: null,
        last_swap_at: null
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * GET /api/solana-swap/platform-stats
 * 获取平台 Solana Swap 统计
 */
router.get('/platform-stats',
  asyncHandler(async (req, res) => {
    // 总体统计
    const totalStats = await db.get(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(amount_in_usd) as total_volume_usd,
        SUM(platform_fee_usd) as total_fees_usd
      FROM solana_swap_transactions
      WHERE status = 'success'
    `);

    // 今日统计
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await db.get(`
      SELECT * FROM solana_platform_fees WHERE date = ?
    `, [today]);

    // 最近7天统计
    const weeklyStats = await db.all(`
      SELECT * FROM solana_platform_fees
      ORDER BY date DESC
      LIMIT 7
    `);

    res.json({
      success: true,
      data: {
        total: totalStats || { total_transactions: 0, total_volume_usd: 0, total_fees_usd: 0 },
        today: todayStats || { transaction_count: 0, total_fees_usd: 0 },
        weekly: weeklyStats
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * GET /api/solana-swap/tx/:signature
 * 获取单笔交易详情
 */
router.get('/tx/:signature',
  param('signature').isString().notEmpty().withMessage('Transaction signature is required'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { signature } = req.params;

    const transaction = await db.get(`
      SELECT * FROM solana_swap_transactions
      WHERE signature = ?
    `, [signature]);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: transaction,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;
