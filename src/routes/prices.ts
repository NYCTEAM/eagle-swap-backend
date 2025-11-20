import { Router } from 'express';
import { priceService } from '../services/priceService';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  validateChainId,
  validateAddress,
  validatePriceQuery
} from '../middleware/validation';
import { validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// Get token price by address
router.get('/:tokenAddress',
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

    const { tokenAddress } = req.params;
    const { chainId } = req.query;

    if (!chainId) {
      return res.status(400).json({
        success: false,
        message: 'Chain ID is required'
      });
    }

    try {
      const price = await priceService.getTokenPrice(tokenAddress, parseInt(chainId as string));

      if (!price) {
        return res.status(404).json({
          success: false,
          message: 'Price not found for this token'
        });
      }

      return res.json({
        success: true,
        data: price
      });
    } catch (error: any) {
      logger.error('Failed to get token price', {
        tokenAddress,
        chainId,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to get token price'
      });
    }
  })
);

// Get multiple token prices
router.post('/batch',
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

    const { tokenAddresses, chainId } = req.body;

    if (!tokenAddresses || !Array.isArray(tokenAddresses)) {
      return res.status(400).json({
        success: false,
        message: 'Token addresses array is required'
      });
    }

    if (!chainId) {
      return res.status(400).json({
        success: false,
        message: 'Chain ID is required'
      });
    }

    try {
      const prices = await priceService.getTokenPrices(tokenAddresses, chainId);

      return res.json({
        success: true,
        data: prices
      });
    } catch (error: any) {
      logger.error('Failed to get token prices', {
        tokenAddresses,
        chainId,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to get token prices'
      });
    }
  })
);

// Update token price
router.post('/:tokenAddress',
  validateAddress,
  validatePriceQuery,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { tokenAddress } = req.params;
    const { chainId, priceUsd, priceChange24h, marketCap, volume24h } = req.body;

    try {
      const price = await priceService.updateTokenPrice({
        token_address: tokenAddress,
        chain_id: chainId,
        price_usd: priceUsd,
        price_change_24h: priceChange24h,
        market_cap: marketCap,
        volume_24h: volume24h
      });

      logger.info('Token price updated', {
        tokenAddress,
        chainId,
        priceUsd
      });

      return res.json({
        success: true,
        data: price
      });
    } catch (error: any) {
      logger.error('Failed to update token price', {
        tokenAddress,
        chainId,
        priceUsd,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update token price'
      });
    }
  })
);

// Get token price history
router.get('/:tokenAddress/history',
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

    const { tokenAddress } = req.params;
    const { chainId, timeframe = '24h', limit = 100 } = req.query;

    if (!chainId) {
      return res.status(400).json({
        success: false,
        message: 'Chain ID is required'
      });
    }

    try {
      const history = await priceService.getTokenPriceHistory(
        tokenAddress,
        parseInt(chainId as string),
        timeframe as string,
        parseInt(limit as string)
      );

      return res.json({
        success: true,
        data: history
      });
    } catch (error: any) {
      logger.error('Failed to get token price history', {
        tokenAddress,
        chainId,
        timeframe,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to get token price history'
      });
    }
  })
);

// Sync prices from external sources
router.post('/sync',
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

    const { tokenAddresses, chainId } = req.body;

    if (!tokenAddresses || !Array.isArray(tokenAddresses)) {
      return res.status(400).json({
        success: false,
        message: 'Token addresses array is required'
      });
    }

    if (!chainId) {
      return res.status(400).json({
        success: false,
        message: 'Chain ID is required'
      });
    }

    try {
      await priceService.syncPricesFromExternal(tokenAddresses, chainId);

      logger.info('Prices synced from external sources', {
        tokenCount: tokenAddresses.length,
        chainId
      });

      return res.json({
        success: true,
        message: 'Prices synced successfully'
      });
    } catch (error: any) {
      logger.error('Failed to sync prices', {
        tokenAddresses,
        chainId,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to sync prices'
      });
    }
  })
);

// Get trending tokens
router.get('/trending/tokens',
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

    const { chainId, timeframe = '24h', limit = 20 } = req.query;

    try {
      const trending = await priceService.getTrendingTokens(
        chainId ? parseInt(chainId as string) : undefined,
        timeframe as string,
        parseInt(limit as string)
      );

      return res.json({
        success: true,
        data: trending
      });
    } catch (error: any) {
      logger.error('Failed to get trending tokens', {
        chainId,
        timeframe,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to get trending tokens'
      });
    }
  })
);

// Get price statistics
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

    try {
      const stats = await priceService.getPriceStats(
        chainId ? parseInt(chainId as string) : undefined,
        timeframe as string
      );

      return res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('Failed to get price stats', {
        chainId,
        timeframe,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to get price stats'
      });
    }
  })
);

// Calculate price from DEX reserves
router.post('/calculate',
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

    const { tokenAddress, pairAddress, chainId } = req.body;

    if (!tokenAddress || !pairAddress || !chainId) {
      return res.status(400).json({
        success: false,
        message: 'Token address, pair address, and chain ID are required'
      });
    }

    try {
      const price = await priceService.calculatePriceFromReserves(
        tokenAddress,
        pairAddress,
        chainId
      );

      if (!price) {
        return res.status(404).json({
          success: false,
          message: 'Unable to calculate price from reserves'
        });
      }

      return res.json({
        success: true,
        data: {
          tokenAddress,
          pairAddress,
          chainId,
          calculatedPrice: price
        }
      });
    } catch (error: any) {
      logger.error('Failed to calculate price from reserves', {
        tokenAddress,
        pairAddress,
        chainId,
        error: error.message
      });

      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to calculate price'
      });
    }
  })
);

// Clear price cache
router.post('/cache/clear',
  asyncHandler(async (req, res) => {
    try {
      priceService.clearCache();

      logger.info('Price cache cleared');

      return res.json({
        success: true,
        message: 'Price cache cleared successfully'
      });
    } catch (error: any) {
      logger.error('Failed to clear price cache', { error: error.message });

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to clear cache'
      });
    }
  })
);

// Get cache statistics
router.get('/cache/stats',
  asyncHandler(async (req, res) => {
    try {
      const stats = priceService.getCacheStats();

      return res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('Failed to get cache stats', { error: error.message });

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get cache stats'
      });
    }
  })
);

export default router;