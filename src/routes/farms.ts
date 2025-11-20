import { Router } from 'express';
import { farmService } from '../services/farmService';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  validatePagination,
  validateChainId,
  validateAddress,
  validateAmount,
  validateStake,
  validateUnstake
} from '../middleware/validation';
import { validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// Get all farms with pagination
router.get('/', 
  validatePagination,
  validateChainId,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { page = 1, limit = 20, chainId } = req.query;
    
    const result = await farmService.getFarms(
      parseInt(page as string),
      parseInt(limit as string),
      chainId ? parseInt(chainId as string) : undefined
    );

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  })
);

// Get farm by ID
router.get('/:id',
  validateAddress,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const farm = await farmService.getFarmById(parseInt(id));

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: 'Farm not found'
      });
    }

    return res.json({
      success: true,
      data: farm
    });
  })
);

// Stake tokens in farm
router.post('/:id/stake',
  validateAddress,
  validateStake,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { amount, userAddress, chainId } = req.body;

    try {
      const result = await farmService.stake(
        parseInt(id),
        amount,
        userAddress,
        chainId
      );

      logger.info('Farm stake successful', {
        farmId: id,
        amount,
        userAddress,
        chainId,
        transactionHash: result.transactionHash
      });

      return res.json({
        success: true,
        data: {
          transactionHash: result.transactionHash,
          transaction: result.transaction
        }
      });
    } catch (error: any) {
      logger.error('Farm stake failed', {
        farmId: id,
        amount,
        userAddress,
        chainId,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Stake failed'
      });
    }
  })
);

// Unstake tokens from farm
router.post('/:id/unstake',
  validateAddress,
  validateUnstake,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { amount, userAddress, chainId } = req.body;

    try {
      const result = await farmService.unstake(
        parseInt(id),
        amount,
        userAddress,
        chainId
      );

      logger.info('Farm unstake successful', {
        farmId: id,
        amount,
        userAddress,
        chainId,
        transactionHash: result.transactionHash
      });

      return res.json({
        success: true,
        data: {
          transactionHash: result.transactionHash,
          transaction: result.transaction
        }
      });
    } catch (error: any) {
      logger.error('Farm unstake failed', {
        farmId: id,
        amount,
        userAddress,
        chainId,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Unstake failed'
      });
    }
  })
);

// Harvest rewards from farm
router.post('/:id/harvest',
  validateAddress,
  validateStake,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { userAddress, chainId } = req.body;

    try {
      const result = await farmService.harvest(
        parseInt(id),
        userAddress,
        chainId
      );

      logger.info('Farm harvest successful', {
        farmId: id,
        userAddress,
        chainId,
        transactionHash: result.transactionHash,
        rewards: result.rewards
      });

      return res.json({
        success: true,
        data: {
          transactionHash: result.transactionHash,
          transaction: result.transaction,
          rewards: result.rewards
        }
      });
    } catch (error: any) {
      logger.error('Farm harvest failed', {
        farmId: id,
        userAddress,
        chainId,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Harvest failed'
      });
    }
  })
);

// Get user staking positions
router.get('/positions/:userAddress',
  validateAddress,
  validatePagination,
  validateChainId,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userAddress } = req.params;
    const { page = 1, limit = 20, chainId } = req.query;

    const result = await farmService.getUserStakingPositions(
      userAddress,
      parseInt(page as string),
      parseInt(limit as string),
      chainId ? parseInt(chainId as string) : undefined
    );

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  })
);

// Get specific staking position
router.get('/:id/positions/:userAddress',
  validateAddress,
  validateAddress,
  validateChainId,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id, userAddress } = req.params;
    const { chainId } = req.query;

    if (!chainId) {
      return res.status(400).json({
        success: false,
        message: 'Chain ID is required'
      });
    }

    const position = await farmService.getStakingPosition(
      parseInt(id),
      userAddress,
      parseInt(chainId as string)
    );

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Staking position not found'
      });
    }

    return res.json({
      success: true,
      data: position
    });
  })
);

// Get pending rewards
router.get('/:id/rewards/:userAddress',
  validateAddress,
  validateAddress,
  validateChainId,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id, userAddress } = req.params;
    const { chainId } = req.query;

    if (!chainId) {
      return res.status(400).json({
        success: false,
        message: 'Chain ID is required'
      });
    }

    try {
      const pendingRewards = await farmService.getPendingRewards(
        parseInt(id),
        userAddress,
        parseInt(chainId as string)
      );

      return res.json({
        success: true,
        data: {
          pendingRewards
        }
      });
    } catch (error: any) {
      logger.error('Failed to get pending rewards', {
        farmId: id,
        userAddress,
        chainId,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to get pending rewards'
      });
    }
  })
);

// Get farm history for user
router.get('/history/:userAddress',
  validateAddress,
  validatePagination,
  validateChainId,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userAddress } = req.params;
    const { page = 1, limit = 20, chainId } = req.query;

    const result = await farmService.getFarmHistory(
      userAddress,
      parseInt(page as string),
      parseInt(limit as string),
      chainId ? parseInt(chainId as string) : undefined
    );

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  })
);

// Get farm statistics
router.get('/stats/overview',
  validateChainId,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { chainId, timeframe = '24h' } = req.query;

    const stats = await farmService.getFarmStats(
      chainId ? parseInt(chainId as string) : undefined,
      timeframe as string
    );

    return res.json({
      success: true,
      data: stats
    });
  })
);

export default router;