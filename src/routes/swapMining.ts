import express from 'express';
import { swapMiningService } from '../services/swapMiningService';

const router = express.Router();

/**
 * 记录 SWAP 交易
 * POST /api/swap-mining/record
 */
router.post('/record', async (req, res) => {
  try {
    const {
      txHash,
      userAddress,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      tradeValueUsdt,
      routeInfo
    } = req.body;
    
    // 验证必填字段
    if (!txHash || !userAddress || !fromToken || !toToken || !tradeValueUsdt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const result = await swapMiningService.recordSwap({
      txHash,
      userAddress,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      tradeValueUsdt,
      routeInfo
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('记录交易失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取用户统计
 * GET /api/swap-mining/stats/:address
 */
router.get('/stats/:address', (req, res) => {
  try {
    const { address } = req.params;
    const result = swapMiningService.getUserStats(address);
    res.json(result);
  } catch (error: any) {
    console.error('获取用户统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取用户统计（带 chainId 参数）
 * GET /api/swap-mining/user-stats/:address
 */
router.get('/user-stats/:address', (req, res) => {
  try {
    const { address } = req.params;
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : undefined;
    
    // 获取用户统计数据
    const result = swapMiningService.getUserStats(address);
    
    res.json(result);
  } catch (error: any) {
    console.error('获取用户统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取用户交易历史
 * GET /api/swap-mining/transactions/:address
 */
router.get('/transactions/:address', (req, res) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = swapMiningService.getUserTransactions(address, limit);
    res.json(result);
  } catch (error: any) {
    console.error('获取交易历史失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取待领取奖励
 * GET /api/swap-mining/pending/:address
 */
router.get('/pending/:address', (req, res) => {
  try {
    const { address } = req.params;
    const result = swapMiningService.getPendingRewards(address);
    res.json(result);
  } catch (error: any) {
    console.error('获取待领取奖励失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 领取奖励
 * POST /api/swap-mining/claim
 */
router.post('/claim', async (req, res) => {
  try {
    const { userAddress, rewardIds } = req.body;
    
    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing userAddress'
      });
    }
    
    const result = await swapMiningService.claimRewards(userAddress, rewardIds);
    res.json(result);
  } catch (error: any) {
    console.error('领取奖励失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取平台统计
 * GET /api/swap-mining/platform-stats
 */
router.get('/platform-stats', (req, res) => {
  try {
    const result = swapMiningService.getPlatformStats();
    res.json(result);
  } catch (error: any) {
    console.error('获取平台统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取排行榜
 * GET /api/swap-mining/leaderboard
 */
router.get('/leaderboard', (req, res) => {
  try {
    const type = (req.query.type as 'volume' | 'eagle') || 'volume';
    const limit = parseInt(req.query.limit as string) || 10;
    const result = swapMiningService.getLeaderboard(type, limit);
    res.json(result);
  } catch (error: any) {
    console.error('获取排行榜失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取用户完整的挖矿状态（包含 VIP 和 NFT 加成）
 * GET /api/swap-mining/status/:address
 */
router.get('/status/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const result = await swapMiningService.getUserMiningStatus(address);
    res.json(result);
  } catch (error: any) {
    console.error('获取用户挖矿状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取所有 VIP 等级
 * GET /api/swap-mining/vip-levels
 */
router.get('/vip-levels', (req, res) => {
  try {
    const result = swapMiningService.getVipLevels();
    res.json(result);
  } catch (error: any) {
    console.error('获取 VIP 等级失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取所有 NFT 等级加成
 * GET /api/swap-mining/nft-boosts
 */
router.get('/nft-boosts', (req, res) => {
  try {
    const result = swapMiningService.getNftBoosts();
    res.json(result);
  } catch (error: any) {
    console.error('获取 NFT 加成失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取奖励计算矩阵
 * GET /api/swap-mining/reward-matrix
 */
router.get('/reward-matrix', (req, res) => {
  try {
    const result = swapMiningService.getRewardMatrix();
    res.json(result);
  } catch (error: any) {
    console.error('获取奖励矩阵失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
