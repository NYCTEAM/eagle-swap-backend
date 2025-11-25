import { Router } from 'express';
import { simpleNftSync } from '../services/simpleNftSync';

const router = Router();

// 获取NFT库存信息 (替代 /api/nft/levels)
router.get('/levels', (req, res) => {
  try {
    const inventory = simpleNftSync.getInventory();
    
    // 转换为前端期望的格式
    const levels = inventory.map(item => ({
      level: item.level,
      name: item.name,
      weight: item.weight,
      price_usdt: item.price_usdt,
      available: item.available,
      minted: item.minted,
      total_supply: item.total_supply
    }));

    res.json({
      success: true,
      data: levels
    });
  } catch (error) {
    console.error('❌ Error fetching NFT levels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NFT levels'
    });
  }
});

// 获取用户NFT列表
router.get('/user/:address', (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required'
      });
    }

    const userNFTs = simpleNftSync.getUserNFTs(address);
    
    res.json({
      success: true,
      data: userNFTs
    });
  } catch (error) {
    console.error('❌ Error fetching user NFTs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user NFTs'
    });
  }
});

// 获取用户总权重
router.get('/user/:address/weight', (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required'
      });
    }

    const userNFTs = simpleNftSync.getUserNFTs(address);
    const totalWeight = userNFTs.reduce((sum: number, nft: any) => sum + (nft.weight || 0), 0);
    
    res.json({
      success: true,
      data: {
        address: address.toLowerCase(),
        totalWeight,
        nftCount: userNFTs.length,
        nfts: userNFTs
      }
    });
  } catch (error) {
    console.error('❌ Error calculating user weight:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate user weight'
    });
  }
});

// 手动同步NFT数据 (调试用)
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 Manual NFT sync requested');
    
    // 重新启动同步服务
    await simpleNftSync.start();
    
    res.json({
      success: true,
      message: 'NFT sync completed'
    });
  } catch (error) {
    console.error('❌ Error during manual sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync NFT data'
    });
  }
});

export default router;
