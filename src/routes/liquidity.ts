import { Router } from 'express';
import { liquidityService } from '../services/liquidityService';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  validateAddLiquidity,
  validateRemoveLiquidity,
  validatePagination,
  checkValidation 
} from '../middleware/validation';
import { query, param, body } from 'express-validator';
import { ApiResponse, LiquidityPosition, Transaction, PaginatedResponse } from '../types';

const router = Router();

// POST /api/liquidity/add - Add liquidity
router.post('/add',
  validateAddLiquidity,
  asyncHandler(async (req, res) => {
    const {
      tokenA,
      tokenB,
      amountA,
      amountB,
      amountAMin,
      amountBMin,
      userAddress,
      chainId,
      deadline
    } = req.body;

    const result = await liquidityService.addLiquidity(
      tokenA,
      tokenB,
      amountA,
      amountB,
      amountAMin,
      amountBMin,
      userAddress,
      chainId,
      deadline
    );

    const response: ApiResponse<{ transactionHash: string; transaction: Transaction }> = {
      success: true,
      data: result,
      message: 'Liquidity added successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// POST /api/liquidity/remove - Remove liquidity
router.post('/remove',
  validateRemoveLiquidity,
  asyncHandler(async (req, res) => {
    const {
      tokenA,
      tokenB,
      liquidity,
      amountAMin,
      amountBMin,
      userAddress,
      chainId,
      deadline
    } = req.body;

    const result = await liquidityService.removeLiquidity(
      tokenA,
      tokenB,
      liquidity,
      amountAMin,
      amountBMin,
      userAddress,
      chainId,
      deadline
    );

    const response: ApiResponse<{ transactionHash: string; transaction: Transaction }> = {
      success: true,
      data: result,
      message: 'Liquidity removed successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/liquidity/positions/:userAddress - Get user liquidity positions
router.get('/positions/:userAddress',
  param('userAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  validatePagination,
  query('chainId').optional().isInt({ min: 1 }).withMessage('Chain ID must be positive'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const userAddress = req.params.userAddress;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : undefined;

    const result = await liquidityService.getUserLiquidityPositions(userAddress, page, limit, chainId);

    const response: ApiResponse<PaginatedResponse<LiquidityPosition>> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/liquidity/position/:userAddress/:tokenA/:tokenB - Get specific liquidity position
router.get('/position/:userAddress/:tokenA/:tokenB',
  param('userAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  param('tokenA').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenA address'),
  param('tokenB').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenB address'),
  query('chainId').isInt({ min: 1 }).withMessage('Chain ID is required'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { userAddress, tokenA, tokenB } = req.params;
    const chainId = parseInt(req.query.chainId as string);

    const position = await liquidityService.getLiquidityPosition(tokenA, tokenB, userAddress, chainId);

    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Liquidity position not found',
        code: 'POSITION_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    const response: ApiResponse<LiquidityPosition> = {
      success: true,
      data: position,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/liquidity/reserves/:tokenA/:tokenB - Get pair reserves
router.get('/reserves/:tokenA/:tokenB',
  param('tokenA').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenA address'),
  param('tokenB').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid tokenB address'),
  query('chainId').isInt({ min: 1 }).withMessage('Chain ID is required'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { tokenA, tokenB } = req.params;
    const chainId = parseInt(req.query.chainId as string);

    const reserves = await liquidityService.getPairReserves(tokenA, tokenB, chainId);

    const response: ApiResponse<any> = {
      success: true,
      data: reserves,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/liquidity/history/:userAddress - Get liquidity history for user
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

    const result = await liquidityService.getLiquidityHistory(userAddress, page, limit, chainId);

    const response: ApiResponse<PaginatedResponse<Transaction>> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/liquidity/stats - Get liquidity statistics
router.get('/stats',
  query('chainId').optional().isInt({ min: 1 }).withMessage('Chain ID must be positive'),
  query('timeframe').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : undefined;
    const timeframe = (req.query.timeframe as string) || '24h';

    const stats = await liquidityService.getLiquidityStats(chainId, timeframe);

    const response: ApiResponse<any> = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

export default router;