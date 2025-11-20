import cron from 'node-cron';
import { getDatabase } from '../database/init';
import { logger } from '../utils/logger';

/**
 * 每日结算服务
 * 纽约时间每天 00:00 执行
 * 将 pending 奖励转为 claimable
 */
export function startDailySettlement() {
  // 纽约时间每天 00:00 执行
  cron.schedule('0 0 * * *', async () => {
    logger.info('Starting daily settlement...');
    
    const db = getDatabase();
    
    try {
      // 1. 将 Swap 推荐奖励的 pending 转为 claimable
      await new Promise<void>((resolve, reject) => {
        db.run(`
          UPDATE user_referral_rewards
          SET 
            swap_claimable = swap_claimable + swap_pending,
            swap_pending = 0,
            updated_at = CURRENT_TIMESTAMP
          WHERE swap_pending > 0
        `, (err: Error | null) => {
          if (err) {
            logger.error('Failed to update user_referral_rewards', { error: err.message });
            reject(err);
          } else {
            logger.info('Updated user_referral_rewards: pending -> claimable');
            resolve();
          }
        });
      });
      
      // 2. 更新奖励明细状态
      await new Promise<void>((resolve, reject) => {
        db.run(`
          UPDATE referral_reward_details
          SET status = 'claimable'
          WHERE status = 'pending'
        `, (err: Error | null) => {
          if (err) {
            logger.error('Failed to update referral_reward_details', { error: err.message });
            reject(err);
          } else {
            logger.info('Updated referral_reward_details: pending -> claimable');
            resolve();
          }
        });
      });
      
      // 3. 获取结算统计
      const stats = await new Promise<any>((resolve, reject) => {
        db.get(`
          SELECT 
            COUNT(*) as user_count,
            SUM(swap_claimable) as total_claimable
          FROM user_referral_rewards
          WHERE swap_claimable > 0
        `, (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      logger.info('Daily settlement completed successfully', {
        users_affected: stats.user_count,
        total_claimable: stats.total_claimable,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      logger.error('Daily settlement failed', { error: error.message });
    }
  }, {
    timezone: 'America/New_York'
  });
  
  logger.info('Daily settlement cron job started (00:00 NY time)');
}
