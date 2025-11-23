import { Router } from 'express';
import { getDatabase } from '../database/init';
import { logger } from '../utils/logger';

const router = Router();

// ============================================
// 获取用户仪表盘数据
// ============================================
router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const db = getDatabase();
    
    // Helper function to safely query
    const safeQuery = (query: string, params: any[]): Promise<any> => {
      return new Promise((resolve) => {
        db.get(query, params, (err: any, row: any) => {
          if (err) {
            logger.warn('Query error:', err.message);
            resolve(null);
          } else {
            resolve(row);
          }
        });
      });
    };

    const safeQueryAll = (query: string, params: any[]): Promise<any[]> => {
      return new Promise((resolve) => {
        db.all(query, params, (err: any, rows: any[]) => {
          if (err) {
            logger.warn('Query error:', err.message);
            resolve([]);
          } else {
            resolve(rows || []);
          }
        });
      });
    };

    // Execute all queries in parallel
    const [
      nodesData,
      miningData,
      referralData,
      referralRewards,
      swapData,
      swapRewards,
      communityData,
      recentActivity
    ] = await Promise.all([
      // 1. 获取节点数据
      safeQuery(`
        SELECT 
          COUNT(*) as total_nodes,
          COALESCE(SUM(nl.weight), 0) as total_power
        FROM nodes n
        LEFT JOIN node_levels nl ON n.level = nl.id
        WHERE n.owner_address = ?
      `, [address]),
      
      // 2. 获取挖矿数据
      safeQuery(`
        SELECT 
          COALESCE(SUM(CASE WHEN claimed = 1 THEN reward_amount ELSE 0 END), 0) as total_earned,
          COALESCE(SUM(CASE WHEN claimed = 0 THEN reward_amount ELSE 0 END), 0) as pending_rewards
        FROM node_mining_rewards
        WHERE owner_address = ?
      `, [address]),
      
      // 3. 获取推荐数据
      safeQuery(`
        SELECT 
          COALESCE(total_confirmed, 0) as total_referrals,
          COALESCE(referral_value, 0) as total_value
        FROM referral_statistics_detailed
        WHERE referrer_address = ?
      `, [address]),
      
      // 3b. 获取推荐奖励
      safeQuery(`
        SELECT 
          COALESCE(SUM(CASE WHEN claimed = 1 THEN reward_amount ELSE 0 END), 0) as total_earned,
          COALESCE(SUM(CASE WHEN claimed = 0 THEN reward_amount ELSE 0 END), 0) as pending_rewards
        FROM referral_rewards
        WHERE referrer_address = ?
      `, [address]),
      
      // 4. 获取 SWAP 数据
      safeQuery(`
        SELECT 
          COALESCE(SUM(amount_in), 0) as total_volume,
          COUNT(*) as total_trades
        FROM swap_transactions
        WHERE user_address = ?
      `, [address]),
      
      // 4b. 获取 SWAP 奖励
      safeQuery(`
        SELECT 
          COALESCE(SUM(CASE WHEN claimed = 1 THEN final_reward ELSE 0 END), 0) as total_earned,
          COALESCE(SUM(CASE WHEN claimed = 0 THEN final_reward ELSE 0 END), 0) as pending_rewards
        FROM swap_rewards
        WHERE user_address = ?
      `, [address]),
      
      // 5. 获取社区数据
      safeQuery(`
        SELECT 
          cm.community_id,
          cm.is_leader,
          c.community_name,
          c.total_members,
          c.community_level,
          cl.member_bonus_rate as bonus_rate
        FROM community_members cm
        JOIN communities c ON cm.community_id = c.id
        JOIN community_level_config cl ON c.community_level = cl.level
        WHERE cm.member_address = ?
      `, [address]),
      
      // 6. 获取最近活动
      safeQueryAll(`
        SELECT 
          'mining' as type,
          reward_amount as amount,
          created_at
        FROM node_mining_rewards
        WHERE owner_address = ?
        UNION ALL
        SELECT 
          'referral' as type,
          reward_amount as amount,
          created_at
        FROM referral_rewards
        WHERE referrer_address = ?
        UNION ALL
        SELECT 
          'swap' as type,
          final_reward as amount,
          created_at
        FROM swap_rewards
        WHERE user_address = ?
        ORDER BY created_at DESC
        LIMIT 10
      `, [address, address, address])
    ]);
    
    res.json({
      success: true,
      data: {
        nodes: {
          total_nodes: nodesData?.total_nodes || 0,
          total_power: nodesData?.total_power || 0
        },
        mining: {
          total_earned: miningData?.total_earned || 0,
          pending_rewards: miningData?.pending_rewards || 0
        },
        referral: {
          total_referrals: referralData?.total_referrals || 0,
          total_earned: referralRewards?.total_earned || 0,
          pending_rewards: referralRewards?.pending_rewards || 0,
          total_value: referralData?.total_value || 0
        },
        swap: {
          total_volume: swapData?.total_volume || 0,
          total_trades: swapData?.total_trades || 0,
          total_earned: swapRewards?.total_earned || 0,
          pending_rewards: swapRewards?.pending_rewards || 0
        },
        community: communityData || null,
        recent_activity: recentActivity || []
      }
    });
  } catch (error: any) {
    logger.error('获取仪表盘数据失败:', error);
    res.status(500).json({
      success: false,
      error: '获取仪表盘数据失败'
    });
  }
});

export default router;
