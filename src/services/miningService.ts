import { db } from '../database';
import cron from 'node-cron';

// 节点等级算力配置
const NODE_POWER_MAP: { [key: number]: number } = {
  1: 0.1,   // Micro
  2: 0.3,   // Mini
  3: 0.5,   // Bronze
  4: 1,     // Silver
  5: 3,     // Gold
  6: 7,     // Platinum
  7: 15,    // Diamond
};

// 10年释放计划 - 每日奖励池
const DAILY_POOL_BY_YEAR: { [key: number]: number } = {
  1: 32877,   // 第1年: 12,000,000 / 365
  2: 27397,   // 第2年: 10,000,000 / 365
  3: 21918,   // 第3年: 8,000,000 / 365
  4: 16438,   // 第4年: 6,000,000 / 365
  5: 13699,   // 第5年: 5,000,000 / 365
  6: 10959,   // 第6年: 4,000,000 / 365
  7: 8219,    // 第7年: 3,000,000 / 365
  8: 5479,    // 第8年: 2,000,000 / 365
  9: 4110,    // 第9年: 1,500,000 / 365
  10: 2740,   // 第10年: 1,000,000 / 365
};

/**
 * 挖矿服务
 */
export class MiningService {
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;
  
  /**
   * 启动挖矿服务
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Mining service is already running');
      return;
    }
    
    console.log('🚀 Starting mining service...');
    
    // 每天 00:00 执行一次
    this.cronJob = cron.schedule('0 0 * * *', async () => {
      await this.calculateDailyRewards();
    });
    
    this.isRunning = true;
    console.log('✅ Mining service started (runs daily at 00:00)');
    
    // 立即执行一次（用于测试）
    // this.calculateDailyRewards();
  }
  
  /**
   * 计算每日奖励
   */
  async calculateDailyRewards() {
    console.log('\n💰 Calculating daily mining rewards...');
    
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log('📅 Date:', today);
      
      // 检查今天是否已经计算过
      const existing = db.prepare(`
        SELECT COUNT(*) as count FROM node_mining_rewards WHERE reward_date = ?
      `).get(today) as { count: number };
      
      if (existing.count > 0) {
        console.log('⚠️ Rewards already calculated for today');
        return;
      }
      
      // 获取所有活跃节点
      const nodes = db.prepare(`
        SELECT * FROM nodes ORDER BY token_id
      `).all() as any[];
      
      if (nodes.length === 0) {
        console.log('⚠️ No nodes found');
        return;
      }
      
      console.log(`📊 Total nodes: ${nodes.length}`);
      
      // 获取当前年份
      const projectStartDate = new Date('2025-01-01'); // 项目启动日期
      const currentDate = new Date();
      const daysSinceStart = Math.floor((currentDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24));
      const currentYear = Math.min(Math.floor(daysSinceStart / 365) + 1, 10);
      
      console.log(`📆 Current year: ${currentYear}`);
      
      // 为每个节点计算奖励（使用固定奖励表）
      const rewards: any[] = [];
      let totalRewardAmount = 0;
      
      for (const node of nodes) {
        // 从 yearly_rewards 表查询该节点的固定奖励
        const yearlyReward = db.prepare(`
          SELECT daily_reward, year_multiplier 
          FROM yearly_rewards 
          WHERE year = ? AND level_id = ? AND stage = ?
        `).get(currentYear, node.level, node.stage) as { daily_reward: number; year_multiplier: number } | undefined;
        
        if (!yearlyReward) {
          console.warn(`⚠️ No reward data found for node #${node.token_id} (Year ${currentYear}, Level ${node.level}, Stage ${node.stage})`);
          continue;
        }
        
        // 应用节点个体难度系数
        const rewardAmount = yearlyReward.daily_reward * node.difficulty_multiplier;
        totalRewardAmount += rewardAmount;
        
        rewards.push({
          token_id: node.token_id,
          owner_address: node.owner_address,
          reward_date: today,
          daily_pool: 32877, // 固定显示理论最大值
          node_power: node.power,
          total_power: 0, // 不再使用算力分配模式
          difficulty_multiplier: node.difficulty_multiplier,
          reward_amount: rewardAmount,
        });
      }
      
      // 批量插入奖励记录
      const insertStmt = db.prepare(`
        INSERT INTO node_mining_rewards (
          token_id, owner_address, reward_date, daily_pool, 
          node_power, total_power, difficulty_multiplier, reward_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const insertMany = db.transaction((rewards: any[]) => {
        for (const reward of rewards) {
          insertStmt.run(
            reward.token_id,
            reward.owner_address,
            reward.reward_date,
            reward.daily_pool,
            reward.node_power,
            reward.total_power,
            reward.difficulty_multiplier,
            reward.reward_amount
          );
        }
      });
      
      insertMany(rewards);
      
      console.log(`✅ Rewards calculated for ${rewards.length} nodes`);
      console.log(`💎 Total distributed: ${totalRewardAmount.toFixed(2)} EAGLE`);
      console.log(`📊 Reward system: Fixed rewards (Year ${currentYear})`);
      
      // 按用户统计
      const userRewards = new Map<string, number>();
      for (const reward of rewards) {
        const current = userRewards.get(reward.owner_address) || 0;
        userRewards.set(reward.owner_address, current + reward.reward_amount);
      }
      
      console.log(`👥 Rewards distributed to ${userRewards.size} users`);
      
      // 显示前5名
      const topUsers = Array.from(userRewards.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      console.log('\n🏆 Top 5 users:');
      topUsers.forEach(([address, amount], index) => {
        console.log(`   ${index + 1}. ${address.substring(0, 10)}... : ${amount.toFixed(3)} EAGLE`);
      });
      
    } catch (error) {
      console.error('❌ Error calculating daily rewards:', error);
      throw error;
    }
  }
  
  /**
   * 手动触发计算（用于测试）
   */
  async triggerCalculation() {
    console.log('🔧 Manually triggering reward calculation...');
    await this.calculateDailyRewards();
  }
  
  /**
   * 获取挖矿统计
   */
  getMiningStats() {
    try {
      // 总节点数
      const totalNodes = db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
      
      // 全网算力
      const totalPower = db.prepare(`
        SELECT SUM(power * difficulty_multiplier) as total FROM nodes
      `).get() as { total: number };
      
      // 今日已分发奖励
      const today = new Date().toISOString().split('T')[0];
      const todayRewards = db.prepare(`
        SELECT COALESCE(SUM(reward_amount), 0) as total FROM node_mining_rewards WHERE reward_date = ?
      `).get(today) as { total: number };
      
      // 总已分发奖励
      const totalRewards = db.prepare(`
        SELECT COALESCE(SUM(reward_amount), 0) as total FROM node_mining_rewards
      `).get() as { total: number };
      
      // 待领取奖励
      const pendingRewards = db.prepare(`
        SELECT COALESCE(SUM(reward_amount), 0) as total FROM node_mining_rewards WHERE claimed = 0
      `).get() as { total: number };
      
      return {
        totalNodes: totalNodes.count,
        totalPower: totalPower.total || 0,
        todayRewards: todayRewards.total,
        totalRewards: totalRewards.total,
        pendingRewards: pendingRewards.total,
      };
    } catch (error) {
      console.error('Error getting mining stats:', error);
      return null;
    }
  }
  
  /**
   * 停止挖矿服务
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    console.log('🛑 Stopping mining service...');
    
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    
    this.isRunning = false;
    console.log('✅ Mining service stopped');
  }
  
  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      stats: this.getMiningStats(),
    };
  }
}

// 创建单例实例
export const miningService = new MiningService();
