import express from 'express';
import { db } from '../database';
import { simpleNftSync } from '../services/simpleNftSync';
import { NFTTokenManager } from '../services/nftTokenManager.js';
import { NFTSignatureService } from '../services/nftSignatureService.js';

const router = express.Router();

/**
 * 获取所有 NFT 等级信息
 * GET /api/nft/levels
 * 
 * 🔄 已更新：现在从简化NFT同步服务读取实时数据
 */
router.get('/levels', (req, res) => {
  try {
    // 从新的全局NFT表读取（多链共享）
    let inventory: any[];
    let globalStats: any = null;
    
    try {
      // 从 nft_level_stats 读取等级统计
      inventory = db.prepare(`
        SELECT * FROM nft_level_stats ORDER BY level
      `).all();
      
      // 从 nft_global_stats 读取全局统计
      globalStats = db.prepare(`
        SELECT * FROM nft_global_stats WHERE id = 1
      `).get();
    } catch (e) {
      console.error('Error reading from new NFT tables:', e);
      // 如果没有全局表，回退到旧的 simpleNftSync
      inventory = simpleNftSync.getInventory();
    }
    
    // 转换为前端期望的格式（兼容旧API）
    const levels = inventory.map((item: any) => ({
      level: item.level,
      name: item.level_name || item.name,
      weight: item.weight || item.mining_power,
      price_usdt: item.price_usdt / 1000000, // 转换为美元（6位小数）
      price_eth: 0, // 暂不支持ETH支付
      total_supply: item.total_supply,
      minted: item.minted || 0,
      available: item.total_supply - (item.minted || 0),
      description: `${item.level_name || item.name} - Mining Weight: ${item.weight || item.mining_power}x`,
      sold_percentage: item.total_supply > 0 
        ? Math.round(((item.minted || 0) * 100.0) / item.total_supply * 100) / 100 
        : 0
    }));

    res.json({
      success: true,
      data: levels,
      global_stats: globalStats // 添加全局统计
    });
  } catch (error: any) {
    console.error('❌ Error fetching NFT levels:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个等级信息
 * GET /api/nft/levels/:level
 */
router.get('/levels/:level', (req, res) => {
  try {
    const { level } = req.params;
    
    const levelInfo = db.prepare(`
      SELECT * FROM nft_levels WHERE level = ?
    `).get(level);

    if (!levelInfo) {
      return res.status(404).json({
        success: false,
        error: 'Level not found'
      });
    }

    res.json({
      success: true,
      data: levelInfo
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取用户拥有的 NFT
 * GET /api/nft/user/:address
 * 
 * 🔄 已更新：现在从简化NFT同步服务读取实时数据，并包含挖矿奖励
 */
router.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required'
      });
    }

    // 从新的 nft_holders 表读取用户NFT数据
    let userNFTs: any[];
    try {
      userNFTs = db.prepare(`
        SELECT h.*, l.level_name, l.price_usdt, l.weight
        FROM nft_holders h
        LEFT JOIN nft_level_stats l ON h.level = l.level
        WHERE LOWER(h.owner_address) = LOWER(?)
        ORDER BY h.minted_at DESC
      `).all(address);
    } catch (e) {
      console.error('Error reading from nft_holders, falling back to simpleNftSync:', e);
      userNFTs = simpleNftSync.getUserNFTs(address);
    }
    
    // 获取挖矿奖励数据
    const { nftMiningService } = await import('../services/nftMiningService');
    const miningStats = await nftMiningService.getUserStats(address);
    
    // 转换为前端期望的格式（兼容旧API）
    // weight 在数据库中存储为整数 (1 = 0.1x, 10 = 1.0x, 1000 = 100x 或者直接是 1000 = 1.0x)
    // 需要根据实际存储格式转换
    const nfts = userNFTs.map((nft: any) => {
      // 如果 weight >= 100，假设是以 1000 为基数存储的 (1000 = 1.0x)
      // 否则假设是以 10 为基数存储的 (1 = 0.1x, 10 = 1.0x)
      const rawWeight = nft.weight || nft.effective_weight || 1;
      const displayWeight = rawWeight >= 100 ? rawWeight / 1000 : rawWeight / 10;
      
      // 根据链的 USDT 小数位转换价格
      // X Layer (196): 6 decimals, BSC (56): 18 decimals
      const chainId = nft.chain_id || 196;
      const usdtDecimals = chainId === 56 ? 18 : 6;
      const listingPriceUSDT = nft.listing_price ? Number(nft.listing_price) / Math.pow(10, usdtDecimals) : 0;
      
      return {
        token_id: nft.global_token_id || nft.token_id,
        owner_address: nft.owner_address,
        level: nft.level,
        level_name: nft.level_name || nft.name,
        price_usdt: nft.price_usdt ? nft.price_usdt / 1000000 : 0, // 转换为美元（6位小数）
        effective_weight: displayWeight,
        weight: displayWeight,
        power: displayWeight, // 兼容前端字段名
        stage: nft.stage || 1,
        difficulty_multiplier: 1.0, // 默认值，稍后可以从 stage 计算
        total_earned: miningStats.totalClaimed, // 从挖矿服务获取
        pending_rewards: miningStats.pendingReward / userNFTs.length, // 平均分配到每个NFT
        minted_at: nft.minted_at,
        payment_method: nft.payment_method || 'USDT',
        purchase_time: new Date((nft.minted_at || 0) * 1000).toISOString(),
        created_at: nft.created_at,
        chain_id: chainId,
        chain_name: nft.chain_name,
        is_listed: nft.is_listed === 1, // 转换为布尔值
        listing_price: listingPriceUSDT
      };
    });

    // 计算总权重
    const totalWeight = nfts.reduce((sum: number, nft: any) => sum + (nft.effective_weight || 0), 0);

    res.json({
      success: true,
      data: {
        nfts,
        total_count: nfts.length,
        total_weight: totalWeight,
        total_claimed: miningStats.totalClaimed,
        pending_reward: miningStats.pendingReward
      }
    });
  } catch (error: any) {
    console.error('❌ Error fetching user NFTs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取 NFT 详情
 * GET /api/nft/token/:tokenId
 */
router.get('/token/:tokenId', (req, res) => {
  try {
    const { tokenId } = req.params;
    
    const nft = db.prepare(`
      SELECT 
        o.*,
        l.name as level_name,
        l.description,
        l.price_usdt
      FROM nft_ownership o
      JOIN nft_levels l ON o.level = l.level
      WHERE o.token_id = ?
    `).get(tokenId);

    if (!nft) {
      return res.status(404).json({
        success: false,
        error: 'NFT not found'
      });
    }

    res.json({
      success: true,
      data: nft
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取 NFT 交易历史
 * GET /api/nft/transactions/:tokenId
 */
router.get('/transactions/:tokenId', (req, res) => {
  try {
    const { tokenId } = req.params;
    
    const transactions = db.prepare(`
      SELECT * FROM nft_transactions
      WHERE token_id = ?
      ORDER BY timestamp DESC
    `).all(tokenId);

    res.json({
      success: true,
      data: transactions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取 NFT 统计数据
 * GET /api/nft/stats
 */
router.get('/stats', (req, res) => {
  try {
    // 总体统计
    const totalStats = db.prepare(`
      SELECT 
        SUM(supply) as total_supply,
        SUM(minted) as total_minted,
        SUM(available) as total_available,
        ROUND(SUM(minted) * 100.0 / SUM(supply), 2) as sold_percentage
      FROM nft_levels
    `).get();

    // 每个等级的统计
    const levelStats = db.prepare(`
      SELECT 
        level,
        name,
        minted,
        supply,
        ROUND(minted * 100.0 / supply, 2) as sold_percentage
      FROM nft_levels
      ORDER BY level
    `).all();

    // 持有者统计
    const holderStats = db.prepare(`
      SELECT 
        COUNT(DISTINCT owner_address) as total_holders,
        COUNT(*) as total_nfts,
        ROUND(AVG(effective_weight), 2) as avg_weight
      FROM nft_ownership
    `).get();

    res.json({
      success: true,
      data: {
        total: totalStats,
        levels: levelStats,
        holders: holderStats
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取排行榜 (按权重)
 * GET /api/nft/leaderboard
 */
router.get('/leaderboard', (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const leaderboard = db.prepare(`
      SELECT 
        owner_address,
        COUNT(*) as nft_count,
        SUM(effective_weight) as total_weight,
        GROUP_CONCAT(DISTINCT level) as levels_owned
      FROM nft_ownership
      GROUP BY owner_address
      ORDER BY total_weight DESC
      LIMIT ?
    `).all(limit);

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 请求铸造 NFT（新流程 - 签名铸造）
 * POST /api/nft/request-mint
 * 
 * 流程：
 * 1. 用户请求铸造
 * 2. 后端分配全局唯一 Token ID
 * 3. 后端生成签名
 * 4. 返回铸造参数给前端
 * 5. 前端调用合约 mintWithSignature
 */
router.post('/request-mint', async (req, res) => {
  try {
    const { userAddress, level, chainId = 196 } = req.body;

    // 参数验证
    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: 'User address is required'
      });
    }

    if (!level || level < 1 || level > 7) {
      return res.status(400).json({
        success: false,
        error: 'Invalid level (must be 1-7)'
      });
    }

    // 检查等级是否还有可用供应
    const isAvailable = NFTTokenManager.checkLevelAvailability(level);
    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        error: `Level ${level} is sold out`
      });
    }

    // 清理过期的预留
    NFTTokenManager.cleanExpiredReservations();

    // 获取下一个可用的全局 Token ID (按等级分配)
    const globalTokenId = NFTTokenManager.getNextAvailableTokenId(level);

    // 获取当前总铸造数量（用于计算阶段）
    const totalMinted = NFTTokenManager.getTotalMinted();

    // 生成签名过期时间（30分钟）
    const deadline = NFTSignatureService.generateDeadline(30);

    // 确定合约地址
    const contractAddress = chainId === 196 
      ? process.env.XLAYER_NFT_ADDRESS || '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7'
      : process.env.BSC_NFT_ADDRESS || '0x3c117d186C5055071EfF91d87f2600eaF88D591D';

    const chainName = chainId === 196 ? 'X Layer' : chainId === 56 ? 'BSC' : 'Solana';

    // 预留 Token ID
    NFTTokenManager.reserveTokenId({
      globalTokenId,
      userAddress: userAddress.toLowerCase(),
      level,
      chainId,
      chainName,
      contractAddress
    });

    // 生成签名
    const signature = await NFTSignatureService.generateMintSignature({
      userAddress,
      globalTokenId,
      level,
      totalMinted,
      deadline,
      contractAddress,
      chainId
    });

    // 计算当前阶段和效率
    const currentStage = NFTTokenManager.getCurrentStage(totalMinted);
    const stageEfficiency = NFTTokenManager.getStageEfficiency(currentStage);

    console.log(`✅ Mint request prepared for ${userAddress}`);
    console.log(`   Global Token ID: ${globalTokenId}`);
    console.log(`   Level: ${level}`);
    console.log(`   Chain: ${chainName} (${chainId})`);
    console.log(`   Total Minted: ${totalMinted}`);
    console.log(`   Stage: ${currentStage} (${stageEfficiency}%)`);

    // 返回铸造参数
    res.json({
      success: true,
      data: {
        globalTokenId,
        level,
        totalMinted,
        deadline,
        signature,
        contractAddress,
        chainId,
        chainName,
        currentStage,
        stageEfficiency,
        expiresAt: new Date(deadline * 1000).toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Request mint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 确认 NFT 已铸造（由前端在交易成功后调用）
 * POST /api/nft/confirm-mint
 */
router.post('/confirm-mint', (req, res) => {
  try {
    const { globalTokenId, txHash, signature, deadline } = req.body;

    if (!globalTokenId || !txHash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // 标记为已铸造
    NFTTokenManager.markAsMinted({
      globalTokenId,
      txHash,
      signature,
      deadline
    });

    console.log(`✅ NFT minted confirmed: Token ID ${globalTokenId}, TX: ${txHash}`);

    res.json({
      success: true,
      message: 'Mint confirmed successfully'
    });

  } catch (error: any) {
    console.error('❌ Confirm mint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取全局 NFT 统计
 * GET /api/nft/global-stats
 */
router.get('/global-stats', (req, res) => {
  try {
    const stats = NFTTokenManager.getGlobalStats();
    const levelStats = NFTTokenManager.getLevelStats();

    res.json({
      success: true,
      data: {
        global: stats,
        levels: levelStats
      }
    });
  } catch (error: any) {
    console.error('❌ Error fetching global stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取用户持有的 NFT（跨链）
 * GET /api/nft/user/:address
 */
router.get('/user/:address', (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required'
      });
    }

    const nfts = NFTTokenManager.getUserNFTs(address);

    res.json({
      success: true,
      data: nfts
    });
  } catch (error: any) {
    console.error('❌ Error fetching user NFTs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 标记铸造失败（立即清理 Token ID）
 * POST /api/nft/mark-failed
 * 
 * 用于：
 * - 交易被拒绝
 * - 交易失败
 * - 用户取消交易
 * 
 * 立即释放 Token ID，不等待 30 分钟过期
 */
router.post('/mark-failed', (req, res) => {
  try {
    const { globalTokenId, reason = 'Transaction failed' } = req.body;

    if (!globalTokenId) {
      return res.status(400).json({
        success: false,
        error: 'Global Token ID is required'
      });
    }

    // 立即清理
    NFTTokenManager.markAsFailed(globalTokenId, reason);

    console.log(`🧹 Immediate cleanup: Token ID ${globalTokenId} released`);

    res.json({
      success: true,
      message: `Token ID ${globalTokenId} released and available for next user`
    });

  } catch (error: any) {
    console.error('❌ Mark failed error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 取消预留（用户主动取消）
 * POST /api/nft/cancel-reservation
 * 
 * 用于用户主动取消购买，立即释放 Token ID
 */
router.post('/cancel-reservation', (req, res) => {
  try {
    const { globalTokenId, userAddress } = req.body;

    if (!globalTokenId || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Global Token ID and user address are required'
      });
    }

    // 取消预留
    const cancelled = NFTTokenManager.cancelReservation(globalTokenId, userAddress);

    if (cancelled) {
      console.log(`🧹 User cancelled: Token ID ${globalTokenId} released`);
      res.json({
        success: true,
        message: `Reservation cancelled, Token ID ${globalTokenId} is now available`
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Reservation not found or already processed'
      });
    }

  } catch (error: any) {
    console.error('❌ Cancel reservation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
