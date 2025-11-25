import express from 'express';
import { db } from '../database';

const router = express.Router();

/**
 * 获取所有 NFT 等级信息
 * GET /api/nft/levels
 */
router.get('/levels', (req, res) => {
  try {
    const levels = db.prepare(`
      SELECT 
        level,
        name,
        weight,
        price_usdt,
        price_eth,
        supply,
        minted,
        available,
        description,
        ROUND((minted * 100.0 / supply), 2) as sold_percentage
      FROM nft_levels
      ORDER BY level
    `).all();

    res.json({
      success: true,
      data: levels
    });
  } catch (error: any) {
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
 */
router.get('/user/:address', (req, res) => {
  try {
    const { address } = req.params;
    
    const nfts = db.prepare(`
      SELECT 
        o.*,
        l.name as level_name,
        l.price_usdt
      FROM nft_ownership o
      JOIN nft_levels l ON o.level = l.level
      WHERE o.owner_address = ?
      ORDER BY o.token_id
    `).all(address.toLowerCase());

    // 计算总权重
    const totalWeight = nfts.reduce((sum: number, nft: any) => sum + nft.effective_weight, 0);

    res.json({
      success: true,
      data: {
        nfts,
        total_count: nfts.length,
        total_weight: totalWeight
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

export default router;
