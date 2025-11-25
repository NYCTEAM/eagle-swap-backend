import { Router } from 'express';
import { db } from '../database';
import { simpleNftSync } from '../services/simpleNftSync';

const router = Router();

// 从数据库获取节点等级配置
const getNodeLevels = () => {
  try {
    const levels = db.prepare(`
      SELECT 
        id,
        name,
        emoji,
        price_usdt as price,
        weight,
        max_supply as supply,
        minted,
        daily_reward_base as daily_reward
      FROM node_levels
      ORDER BY id
    `).all() as Array<{
      id: number;
      name: string;
      emoji: string;
      price: number;
      weight: number;
      supply: number;
      minted: number;
      daily_reward: number;
    }>;
    return levels;
  } catch (error) {
    console.error('Error fetching node levels:', error);
    // 返回默认配置作为后备
    return [
      { id: 1, name: 'Micro Node', price: 10, supply: 5000, weight: 0.1, daily_reward: 0.27, emoji: '🪙', minted: 0 },
      { id: 2, name: 'Mini Node', price: 25, supply: 3000, weight: 0.3, daily_reward: 0.82, emoji: '⚪', minted: 0 },
      { id: 3, name: 'Bronze Node', price: 50, supply: 2000, weight: 0.5, daily_reward: 1.36, emoji: '🥉', minted: 0 },
      { id: 4, name: 'Silver Node', price: 100, supply: 1500, weight: 1, daily_reward: 2.72, emoji: '🥈', minted: 0 },
      { id: 5, name: 'Gold Node', price: 250, supply: 1100, weight: 3, daily_reward: 8.15, emoji: '🥇', minted: 0 },
      { id: 6, name: 'Platinum Node', price: 500, supply: 700, weight: 7, daily_reward: 19.02, emoji: '💎', minted: 0 },
      { id: 7, name: 'Diamond Node', price: 1000, supply: 600, weight: 15, daily_reward: 40.76, emoji: '💠', minted: 0 },
    ];
  }
};

/**
 * GET /api/nodes/tiers
 * 获取所有节点等级信息（用于前端展示）
 */
router.get('/tiers', async (req, res) => {
  try {
    const NODE_LEVELS = getNodeLevels();
    const tiersWithStatus = NODE_LEVELS.map((level: any) => {
      // 查询已售数量
      const result = db.prepare(`
        SELECT COUNT(*) as minted 
        FROM nodes 
        WHERE level = ?
      `).get(level.id) as { minted: number } | undefined;
      
      const minted = result?.minted || 0;
      const available = level.supply - minted;
      const percentage = (minted / level.supply) * 100;
      
      // 获取对应的 Swap Mining 加成
      const swapBonus = db.prepare(`
        SELECT bonus_multiplier 
        FROM nft_level_bonus 
        WHERE nft_level = ?
      `).get(level.id) as { bonus_multiplier: number } | undefined;
      
      // 计算当前阶段（每20%一个阶段）
      let currentStage = 1;
      let stageMultiplier = 1.00;
      
      if (percentage >= 80) { 
        currentStage = 5; 
        stageMultiplier = 0.80;
      } else if (percentage >= 60) { 
        currentStage = 4; 
        stageMultiplier = 0.85;
      } else if (percentage >= 40) { 
        currentStage = 3; 
        stageMultiplier = 0.90;
      } else if (percentage >= 20) { 
        currentStage = 2; 
        stageMultiplier = 0.95;
      }
      
      // 获取所有阶段信息
      const stages = db.prepare(`
        SELECT stage, stage_supply, difficulty_multiplier
        FROM node_level_stages 
        WHERE level_id = ?
        ORDER BY stage
      `).all(level.id) as Array<{ stage: number; stage_supply: number; difficulty_multiplier: number }>;
      
      // 计算当前阶段剩余数量
      const stageSupply = level.supply / 5; // 每阶段20%
      const currentStageMinted = minted % stageSupply;
      const currentStageRemaining = stageSupply - currentStageMinted;
      
      // 计算每个阶段的奖励
      const stageRewards = stages.map(s => ({
        stage: s.stage,
        multiplier: s.difficulty_multiplier,
        daily_reward: level.daily_reward * s.difficulty_multiplier,
        percentage: (s.difficulty_multiplier * 100).toFixed(0) + '%'
      }));
      
      return {
        id: level.id,
        tier_name: level.name,
        level: level.id,
        price_usdt: level.price,
        daily_output: level.daily_reward * stageMultiplier, // 当前阶段的实际奖励
        base_daily_output: level.daily_reward, // 基础奖励（100%）
        total_supply: level.supply,
        available: available,
        hashpower: level.weight,
        weight: level.weight,
        swap_mining_boost: swapBonus?.bonus_multiplier || 0,
        description: `${level.emoji} ${level.name} tier - ${level.weight}x mining weight`,
        emoji: level.emoji,
        current_stage: currentStage,
        stage_multiplier: stageMultiplier,
        stage_remaining: Math.ceil(currentStageRemaining),
        stages: stageRewards,
      };
    });
    
    res.json({
      success: true,
      data: tiersWithStatus,
    });
  } catch (error) {
    console.error('Error fetching node tiers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node tiers',
    });
  }
});

/**
 * GET /api/nodes/levels
 * 获取所有节点等级信息（包含当前阶段和剩余数量）
 */
router.get('/levels', async (req, res) => {
  try {
    const NODE_LEVELS = getNodeLevels();
    const levelsWithStatus = NODE_LEVELS.map((level: any) => {
      // 查询已售数量
      const result = db.prepare(`
        SELECT COUNT(*) as minted 
        FROM nodes 
        WHERE level = ?
      `).get(level.id) as { minted: number } | undefined;
      
      const minted = result?.minted || 0;
      const percentage = (minted / level.supply) * 100;
      
      // 计算当前阶段和难度
      let stage = 1;
      let multiplier = 1.0;
      let stageLabel = 'Stage 1';
      
      if (percentage >= 80) { 
        stage = 5; 
        multiplier = 0.6; 
        stageLabel = 'Stage 5';
      } else if (percentage >= 60) { 
        stage = 4; 
        multiplier = 0.7; 
        stageLabel = 'Stage 4';
      } else if (percentage >= 40) { 
        stage = 3; 
        multiplier = 0.8; 
        stageLabel = 'Stage 3';
      } else if (percentage >= 20) { 
        stage = 2; 
        multiplier = 0.9; 
        stageLabel = 'Stage 2';
      }
      
      // 计算下一阶段还需售出多少
      let nextStageThreshold = 0;
      let remainingToNextStage = 0;
      
      if (stage < 5) {
        // 每个阶段是 20% 的供应量
        // Stage 1: 0-20%, Stage 2: 20-40%, Stage 3: 40-60%, Stage 4: 60-80%, Stage 5: 80-100%
        const thresholds = [0.2, 0.4, 0.6, 0.8, 1.0];
        nextStageThreshold = Math.ceil(level.supply * thresholds[stage - 1]);
        remainingToNextStage = nextStageThreshold - minted;
      }
      
      return {
        ...level,
        minted,
        remaining: level.supply - minted,
        percentage: parseFloat(percentage.toFixed(2)),
        stage,
        stageLabel,
        multiplier,
        soldOut: minted >= level.supply,
        nextStageThreshold,
        remainingToNextStage,
      };
    });
    
    res.json({
      success: true,
      data: levelsWithStatus,
    });
  } catch (error) {
    console.error('Error fetching node levels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node levels',
    });
  }
});

/**
 * GET /api/nodes/my-nodes/:address
 * GET /api/nodes/user/:address (别名)
 * 获取用户的所有节点
 */
router.get(['/my-nodes/:address', '/user/:address'], async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || address.length !== 42) {
      res.status(400).json({
        success: false,
        error: 'Invalid address',
      });
      return;
    }
    
    const nodes = db.prepare(`
      SELECT 
        n.*,
        COALESCE(SUM(r.final_reward), 0) as total_rewards,
        COALESCE(SUM(CASE WHEN r.claimed = 0 THEN r.final_reward ELSE 0 END), 0) as pending_rewards
      FROM nodes n
      LEFT JOIN node_mining_rewards r ON n.token_id = r.token_id
      WHERE n.owner_address = ?
      GROUP BY n.id
      ORDER BY n.mint_time DESC
    `).all(address.toLowerCase());
    
    // 添加节点等级信息
    const NODE_LEVELS = getNodeLevels();
    const nodesWithInfo = nodes.map((node: any) => {
      const levelInfo = NODE_LEVELS.find((l: any) => l.id === node.level);
      return {
        ...node,
        levelName: levelInfo?.name,
        levelEmoji: levelInfo?.emoji,
        weight: levelInfo?.weight,
      };
    });
    
    res.json({
      success: true,
      data: nodesWithInfo,
    });
  } catch (error) {
    console.error('Error fetching user nodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user nodes',
    });
  }
});

/**
 * GET /api/nodes/:tokenId
 * 获取节点详情
 */
router.get('/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    const node = db.prepare(`
      SELECT * FROM nodes WHERE token_id = ?
    `).get(tokenId);
    
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found',
      });
    }
    
    // 添加节点等级信息
    const NODE_LEVELS = getNodeLevels();
    const levelInfo = NODE_LEVELS.find((l: any) => l.id === (node as any).level);
    
    // 查询奖励统计
    const rewardStats = db.prepare(`
      SELECT 
        COUNT(*) as reward_count,
        COALESCE(SUM(final_reward), 0) as total_rewards,
        COALESCE(SUM(CASE WHEN claimed = 0 THEN final_reward ELSE 0 END), 0) as pending_rewards
      FROM node_mining_rewards
      WHERE token_id = ?
    `).get(tokenId);
    
    res.json({
      success: true,
      data: {
        ...node,
        levelName: levelInfo?.name,
        levelEmoji: levelInfo?.emoji,
        weight: levelInfo?.weight,
        ...rewardStats,
      },
    });
  } catch (error) {
    console.error('Error fetching node:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node',
    });
  }
});

/**
 * GET /api/nodes/statistics/overview
 * 获取节点统计概览
 */
router.get('/statistics/overview', async (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_nodes,
        COUNT(DISTINCT owner_address) as total_owners,
        SUM(power) as total_power
      FROM nodes
    `).get();
    
    // 按等级统计
    const levelStats = db.prepare(`
      SELECT 
        level,
        COUNT(*) as count
      FROM nodes
      GROUP BY level
      ORDER BY level
    `).all();
    
    res.json({
      success: true,
      data: {
        ...stats,
        levelStats,
      },
    });
  } catch (error) {
    console.error('Error fetching node statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

/**
 * GET /api/nodes/leaderboard
 * 获取节点持有排行榜
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const leaderboard = db.prepare(`
      SELECT 
        owner_address,
        COUNT(*) as node_count,
        SUM(weight) as total_weight,
        COALESCE(SUM(r.final_reward), 0) as total_rewards
      FROM nodes n
      LEFT JOIN node_mining_rewards r ON n.token_id = r.token_id
      GROUP BY owner_address
      ORDER BY total_weight DESC, node_count DESC
      LIMIT ?
    `).all(limit);
    
    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard',
    });
  }
});

/**
 * GET /api/nodes/user/:address
 * 获取用户拥有的NFT节点
 * 
 * 🔄 已更新：从简化NFT同步服务读取实时数据
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

    // 从简化NFT同步服务获取用户NFT数据
    const userNFTs = simpleNftSync.getUserNFTs(address);
    
    // 转换为前端期望的格式（兼容Manage页面）
    const nodes = userNFTs.map((nft: any) => ({
      token_id: nft.token_id,
      level: nft.level,
      level_name: nft.name,
      power: nft.weight,
      stage: 1, // 默认阶段
      difficulty_multiplier: 1.0, // 默认难度倍数
      purchase_time: nft.minted_at,
      total_earned: 0, // NFT挖矿奖励暂未实现
      pending_rewards: 0, // NFT挖矿奖励暂未实现
      owner_address: nft.owner_address,
      payment_method: nft.payment_method,
      price_usdt: nft.price_usdt
    }));

    res.json({
      success: true,
      data: nodes
    });
  } catch (error: any) {
    console.error('❌ Error fetching user nodes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user nodes'
    });
  }
});

export default router;
