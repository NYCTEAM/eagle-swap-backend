import { Router } from 'express';
import { tokenService } from '../services/tokenService';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  validateToken, 
  validateTokenParam, 
  validatePagination,
  checkValidation 
} from '../middleware/validation';
import { query, param } from 'express-validator';
import { ApiResponse, Token, PaginatedResponse, PaginatedData } from '../types';

const router = Router();

// GET /api/tokens - Get all tokens with pagination
router.get('/', 
  validatePagination,
  query('chainId').optional().isInt({ min: 1 }).withMessage('Chain ID must be positive'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : undefined;

    const result = await tokenService.getTokens(page, limit, chainId);

    const response: ApiResponse<PaginatedResponse<Token>> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/tokens/search - Search tokens
router.get('/search',
  query('q').isString().isLength({ min: 1 }).withMessage('Search query is required'),
  query('chainId').optional().isInt({ min: 1 }).withMessage('Chain ID must be positive'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const query = req.query.q as string;
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 10;

    const tokens = await tokenService.searchTokens(query, chainId, limit);

    const response: ApiResponse<Token[]> = {
      success: true,
      data: tokens,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/tokens/popular - Get popular tokens
router.get('/popular',
  query('chainId').optional().isInt({ min: 1 }).withMessage('Chain ID must be positive'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 10;

    const tokens = await tokenService.getPopularTokens(chainId, limit);

    const response: ApiResponse<Token[]> = {
      success: true,
      data: tokens,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/tokens/:address - Get token by address
router.get('/:address',
  param('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid token address'),
  query('chainId').isInt({ min: 1 }).withMessage('Chain ID is required'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const address = req.params.address;
    const chainId = parseInt(req.query.chainId as string);

    const token = await tokenService.getTokenByAddress(address, chainId);

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        code: 'TOKEN_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    const response: ApiResponse<Token> = {
      success: true,
      data: token,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// POST /api/tokens - Add new token
router.post('/',
  validateToken,
  asyncHandler(async (req, res) => {
    const tokenData = req.body;

    const token = await tokenService.addToken(tokenData);

    const response: ApiResponse<Token> = {
      success: true,
      data: token,
      message: 'Token added successfully',
      timestamp: new Date().toISOString()
    };

    return res.status(201).json(response);
  })
);

// PUT /api/tokens/:address - Update token
router.put('/:address',
  param('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid token address'),
  query('chainId').isInt({ min: 1 }).withMessage('Chain ID is required'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const address = req.params.address;
    const chainId = parseInt(req.query.chainId as string);
    const updates = req.body;

    const token = await tokenService.updateToken(address, chainId, updates);

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        code: 'TOKEN_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    const response: ApiResponse<Token> = {
      success: true,
      data: token,
      message: 'Token updated successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// DELETE /api/tokens/:address - Delete token
router.delete('/:address',
  param('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid token address'),
  query('chainId').isInt({ min: 1 }).withMessage('Chain ID is required'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const address = req.params.address;
    const chainId = parseInt(req.query.chainId as string);

    const deleted = await tokenService.deleteToken(address, chainId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        code: 'TOKEN_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Token deleted successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/tokens/:address/balance/:userAddress - Get token balance for user
router.get('/:address/balance/:userAddress',
  param('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid token address'),
  param('userAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  query('chainId').isInt({ min: 1 }).withMessage('Chain ID is required'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const tokenAddress = req.params.address;
    const userAddress = req.params.userAddress;
    const chainId = parseInt(req.query.chainId as string);

    const balance = await tokenService.getTokenBalance(tokenAddress, userAddress, chainId);

    const response: ApiResponse<{ balance: string }> = {
      success: true,
      data: { balance },
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// GET /api/tokens/native/balance/:userAddress - Get native balance for user
router.get('/native/balance/:userAddress',
  param('userAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  query('chainId').isInt({ min: 1 }).withMessage('Chain ID is required'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const userAddress = req.params.userAddress;
    const chainId = parseInt(req.query.chainId as string);

    const balance = await tokenService.getNativeBalance(userAddress, chainId);

    const response: ApiResponse<{ balance: string }> = {
      success: true,
      data: { balance },
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

// POST /api/tokens/:address/sync - Sync token from blockchain
router.post('/:address/sync',
  param('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid token address'),
  query('chainId').isInt({ min: 1 }).withMessage('Chain ID is required'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const address = req.params.address;
    const chainId = parseInt(req.query.chainId as string);

    const token = await tokenService.syncTokenFromBlockchain(address, chainId);

    const response: ApiResponse<Token> = {
      success: true,
      data: token,
      message: 'Token synced successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  })
);

export default router;