import { Router } from 'express';
import { swapService } from '../services/swapService';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  validateSwap, 
  validatePagination,
  checkValidation 
} from '../middleware/validation';
import { query, param, body } from 'express-validator';
import { ApiResponse, SwapQuote, Transaction, PaginatedResponse } from '../types';

const router = Router();

// POST /api/swap/quote - Get swap quote
router.post('/quote',
  body('tokenIn').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenIn address'),
  body('tokenOut').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenOut address'),
  body('amountIn').isString().matches(/^\d+$/).withMessage('Invalid amountIn'),
  body('chainId').optional().isInt({ min: 1 }).withMessage('Chain ID must be positive'),
  body('slippage').optional().isFloat({ min: 0, max: 50 }).withMessage('Slippage must be between 0 and 50'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { tokenIn, tokenOut, amountIn, chainId = 56, slippage = 0.5 } = req.body;

    const quote = await swapService.getSwapQuote(tokenIn, tokenOut, amountIn, chainId, slippage);

    const response: ApiResponse<SwapQuote> = {
      success: true,
      data: quote,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// POST /api/swap/execute - Execute swap
router.post('/execute',
  validateSwap,
  asyncHandler(async (req, res) => {
    const {
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMin,
      userAddress,
      chainId,
      deadline,
      slippage = 0.5
    } = req.body;

    const result = await swapService.executeSwap(
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMin,
      userAddress,
      chainId,
      deadline,
      slippage
    );

    const response: ApiResponse<{ transactionHash: string; transaction: Transaction }> = {
      success: true,
      data: result,
      message: 'Swap executed successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/swap/history/:userAddress - Get swap history for user
router.get('/history/:userAddress',
  param('userAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  validatePagination,
  query('chainId').optional().isInt({ min: 1 }).withMessage('Chain ID must be positive'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const userAddress = req.params.userAddress;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : undefined;

    const result = await swapService.getSwapHistory(userAddress, page, limit, chainId);

    const response: ApiResponse<PaginatedResponse<Transaction>> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/swap/transaction/:hash - Get transaction by hash
router.get('/transaction/:hash',
  param('hash').isString().matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Invalid transaction hash'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const hash = req.params.hash;

    const transaction = await swapService.getTransactionByHash(hash);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    const response: ApiResponse<Transaction> = {
      success: true,
      data: transaction,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// PUT /api/swap/transaction/:hash/status - Update transaction status
router.put('/transaction/:hash/status',
  param('hash').isString().matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Invalid transaction hash'),
  body('status').isIn(['pending', 'completed', 'failed']).withMessage('Invalid status'),
  body('blockNumber').optional().isInt({ min: 0 }).withMessage('Block number must be positive'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const hash = req.params.hash;
    const { status, blockNumber } = req.body;

    const updated = await swapService.updateTransactionStatus(hash, status, blockNumber);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Transaction status updated successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// POST /api/swap/route - Get best route for swap
router.post('/route',
  body('tokenIn').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenIn address'),
  body('tokenOut').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenOut address'),
  body('amountIn').isString().matches(/^\d+$/).withMessage('Invalid amountIn'),
  body('chainId').isInt({ min: 1 }).withMessage('Chain ID must be positive'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { tokenIn, tokenOut, amountIn, chainId } = req.body;

    const routes = await swapService.getBestRoute(tokenIn, tokenOut, amountIn, chainId);

    const response: ApiResponse<any[]> = {
      success: true,
      data: routes,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/swap/stats - Get swap statistics
router.get('/stats',
  query('chainId').optional().isInt({ min: 1 }).withMessage('Chain ID must be positive'),
  query('timeframe').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : undefined;
    const timeframe = (req.query.timeframe as string) || '24h';

    const stats = await swapService.getSwapStats(chainId, timeframe);

    const response: ApiResponse<any> = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

export default router;