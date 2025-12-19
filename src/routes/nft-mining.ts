import { Router, Request, Response } from 'express';
import { nftMiningService } from '../services/nftMiningService';

const router = Router();

/**
 * NFT 持有挖矿 API
 * 完全链下计算，零 Gas 同步成本
 */

/**
 * GET /api/nft-mining/pending/:address
 * 获取用户待领取奖励
 */
router.get('/pending/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: '缺少地址参数'
      });
    }
    
    const reward = await nftMiningService.calculatePendingReward(address);
    
    res.json({
      success: true,
      data: {
        baseReward: reward.baseReward.toFixed(6),
        communityBonus: reward.communityBonus.toFixed(6),
        totalReward: reward.totalReward.toFixed(6),
        breakdown: reward.breakdown
      }
    });
    
  } catch (error: any) {
    console.error('获取待领取奖励失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/nft-mining/stats/:address
 * 获取用户挖矿统计
 */
router.get('/stats/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: '缺少地址参数'
      });
    }
    
    const stats = await nftMiningService.getUserStats(address);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error: any) {
    console.error('获取挖矿统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/nft-mining/claim-signature
 * 生成领取奖励的签名
 */
router.post('/claim-signature', async (req: Request, res: Response) => {
  try {
    const { userAddress } = req.body;
    
    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: '缺少用户地址'
      });
    }
    
    const result = await nftMiningService.generateClaimSignature(userAddress);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
    
  } catch (error: any) {
    console.error('生成签名失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/nft-mining/record-claim
 * 记录领取成功 (前端调用，合约交易成功后)
 */
router.post('/record-claim', async (req: Request, res: Response) => {
  try {
    const { userAddress, amount, nonce, txHash } = req.body;
    
    if (!userAddress || !amount || !nonce || !txHash) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }
    
    await nftMiningService.recordClaim({
      userAddress,
      amount,
      nonce,
      txHash
    });
    
    res.json({
      success: true,
      message: '领取记录已保存'
    });
    
  } catch (error: any) {
    console.error('记录领取失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/nft-mining/config
 * 获取挖矿配置
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        // NFT 等级每日奖励
        dailyRewards: {
          1: { name: 'Micro Node', reward: 0.5 },
          2: { name: 'Mini Node', reward: 1 },
          3: { name: 'Bronze Node', reward: 2 },
          4: { name: 'Silver Node', reward: 5 },
          5: { name: 'Gold Node', reward: 10 },
          6: { name: 'Platinum Node', reward: 25 },
          7: { name: 'Diamond Node', reward: 50 },
        },
        // NFT 等级加成
        nftBonusRates: {
          1: 5,
          2: 10,
          3: 20,
          4: 35,
          5: 55,
          6: 80,
          7: 105,
        },
        // 社区加成 (示例)
        communityBonusRates: {
          1: { member: 5, leader: 10 },
          2: { member: 10, leader: 15 },
          3: { member: 15, leader: 25 },
          4: { member: 20, leader: 35 },
          5: { member: 25, leader: 50 },
        },
        // 合约地址
        contractAddress: process.env.NFT_MINING_CONTRACT_ADDRESS || '',
        chainId: parseInt(process.env.CHAIN_ID || '196'),
      }
    });
    
  } catch (error: any) {
    console.error('获取配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
