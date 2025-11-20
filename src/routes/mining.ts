import { Router } from 'express';
import { db } from '../database';

const router = Router();

/**
 * GET /api/mining/rewards/:address
 * 获取用户挖矿收益历史
 */
router.get('/rewards/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 30, offset = 0 } = req.query;
    
    if (!address || address.length !== 42) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address',
      });
    }
    
    const rewards = db.prepare(`
      SELECT 
        r.*,
        n.level,
        n.stage
      FROM node_mining_rewards r
      JOIN nodes n ON r.token_id = n.token_id
      WHERE r.owner_address = ?
      ORDER BY r.reward_date DESC
      LIMIT ? OFFSET ?
    `).all(address.toLowerCase(), limit, offset);
    
    // 获取总数
    const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM node_mining_rewards
      WHERE owner_address = ?
    `).get(address.toLowerCase()) as { total: number };
    
    res.json({
      success: true,
      data: {
        rewards,
        total: countResult.total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    console.error('Error fetching mining rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mining rewards',
    });
  }
});

/**
 * GET /api/mining/pending/:address
 * 获取待领取奖励
 */
router.get('/pending/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || address.length !== 42) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address',
      });
    }
    
    const result = db.prepare(`
      SELECT 
        COALESCE(SUM(reward_amount), 0) as total
      FROM node_mining_rewards
      WHERE owner_address = ? AND claimed = 0
    `).get(address.toLowerCase()) as { total: number };
    
    // 获取待领取记录详情
    const pendingRecords = db.prepare(`
      SELECT 
        r.*,
        n.level
      FROM node_mining_rewards r
      JOIN nodes n ON r.token_id = n.token_id
      WHERE r.owner_address = ? AND r.claimed = 0
      ORDER BY r.reward_date DESC
    `).all(address.toLowerCase());
    
    res.json({
      success: true,
      data: {
        pending: result.total,
        records: pendingRecords,
      },
    });
  } catch (error) {
    console.error('Error fetching pending rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending rewards',
    });
  }
});

/**
 * POST /api/mining/claim
 * 领取挖矿奖励
 */
router.post('/claim', async (req, res) => {
  try {
    const { address, signature } = req.body;
    
    if (!address || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }
    
    if (address.length !== 42) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address',
      });
    }
    
    // TODO: 验证签名
    
    // 获取待领取金额
    const result = db.prepare(`
      SELECT COALESCE(SUM(reward_amount), 0) as total
      FROM node_mining_rewards
      WHERE owner_address = ? AND claimed = 0
    `).get(address.toLowerCase()) as { total: number };
    
    if (!result.total || result.total === 0) {
      return res.status(400).json({
        success: false,
        error: 'No pending rewards',
      });
    }
    
    // TODO: 调用智能合约铸造 EAGLE
    // const txHash = await mintEAGLE(address, result.total);
    const txHash = '0x' + '0'.repeat(64); // 临时模拟
    
    // 标记为已领取
    db.prepare(`
      UPDATE node_mining_rewards
      SET claimed = 1, claimed_at = CURRENT_TIMESTAMP, tx_hash = ?
      WHERE owner_address = ? AND claimed = 0
    `).run(txHash, address.toLowerCase());
    
    res.json({
      success: true,
      data: {
        amount: result.total,
        txHash,
      },
    });
  } catch (error) {
    console.error('Error claiming rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim rewards',
    });
  }
});

/**
 * GET /api/mining/statistics/:address
 * 获取用户挖矿统计
 */
router.get('/statistics/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || address.length !== 42) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address',
      });
    }
    
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT token_id) as node_count,
        COALESCE(SUM(reward_amount), 0) as total_earned,
        COALESCE(SUM(CASE WHEN claimed = 1 THEN reward_amount ELSE 0 END), 0) as total_claimed,
        COALESCE(SUM(CASE WHEN claimed = 0 THEN reward_amount ELSE 0 END), 0) as total_pending
      FROM node_mining_rewards
      WHERE owner_address = ?
    `).get(address.toLowerCase());
    
    // 获取最近7天的收益
    const recentRewards = db.prepare(`
      SELECT 
        reward_date,
        SUM(reward_amount) as daily_reward
      FROM node_mining_rewards
      WHERE owner_address = ?
      GROUP BY reward_date
      ORDER BY reward_date DESC
      LIMIT 7
    `).all(address.toLowerCase());
    
    res.json({
      success: true,
      data: {
        ...stats,
        recentRewards,
      },
    });
  } catch (error) {
    console.error('Error fetching mining statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

/**
 * GET /api/mining/daily-pool
 * 获取每日奖励池信息
 */
router.get('/daily-pool', async (req, res) => {
  try {
    const { date } = req.query;
    
    // 如果没有指定日期，使用今天
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const poolInfo = db.prepare(`
      SELECT 
        reward_date,
        daily_pool,
        total_power,
        COUNT(DISTINCT token_id) as node_count,
        SUM(reward_amount) as total_distributed
      FROM node_mining_rewards
      WHERE reward_date = ?
      GROUP BY reward_date, daily_pool, total_power
    `).get(targetDate);
    
    res.json({
      success: true,
      data: poolInfo || {
        reward_date: targetDate,
        daily_pool: 0,
        total_power: 0,
        node_count: 0,
        total_distributed: 0,
      },
    });
  } catch (error) {
    console.error('Error fetching daily pool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch daily pool',
    });
  }
});

/**
 * GET /api/mining/calculator
 * 挖矿收益计算器
 */
router.get('/calculator', async (req, res) => {
  try {
    const { level, stage } = req.query;
    
    if (!level || !stage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }
    
    // 节点算力配置
    const powerMap: { [key: number]: number } = {
      1: 0.1,   // Micro
      2: 0.3,   // Mini
      3: 0.5,   // Bronze
      4: 1,     // Silver
      5: 3,     // Gold
      6: 7,     // Platinum
      7: 15,    // Diamond
    };
    
    // 难度系数配置
    const multiplierMap: { [key: number]: number } = {
      1: 1.0,   // Stage 1
      2: 0.9,   // Stage 2
      3: 0.8,   // Stage 3
      4: 0.7,   // Stage 4
      5: 0.6,   // Stage 5
    };
    
    const nodePower = powerMap[Number(level)] || 0;
    const multiplier = multiplierMap[Number(stage)] || 1.0;
    
    // 假设当前全网算力（从数据库获取）
    const totalPowerResult = db.prepare(`
      SELECT COALESCE(SUM(power), 0) as total_power
      FROM nodes
    `).get() as { total_power: number };
    
    const totalPower = totalPowerResult.total_power || 12500; // 默认全网算力
    
    // 假设每日奖励池（根据年份计算）
    const dailyPool = 32877; // 第1年每日奖励池
    
    // 计算每日收益
    const dailyReward = (nodePower / totalPower) * dailyPool * multiplier;
    const monthlyReward = dailyReward * 30;
    const yearlyReward = dailyReward * 365;
    
    res.json({
      success: true,
      data: {
        nodePower,
        multiplier,
        totalPower,
        dailyPool,
        dailyReward: parseFloat(dailyReward.toFixed(6)),
        monthlyReward: parseFloat(monthlyReward.toFixed(2)),
        yearlyReward: parseFloat(yearlyReward.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('Error calculating rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate rewards',
    });
  }
});

export default router;
