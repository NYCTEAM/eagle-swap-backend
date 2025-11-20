import { db } from '../database';

/**
 * 推荐人等级服务
 * 按直推节点总价值升级，享受 SWAP 挖矿加成
 */
export class ReferrerLevelService {
  
  /**
   * 计算直推节点总价值
   */
  calculateDirectReferralValue(userAddress: string): number {
    const result = db.prepare(`
      SELECT COALESCE(SUM(n.price), 0) as total_value
      FROM users u
      INNER JOIN nodes n ON u.wallet_address = n.owner_address
      WHERE u.referrer_address = ?
      AND n.status = 'active'
    `).get(userAddress) as any;
    
    return result?.total_value || 0;
  }
  
  /**
   * 计算推荐人等级
   */
  calculateReferrerLevel(totalValue: number): {
    level: number;
    levelName: string;
    bonus: number;
    icon: string;
  } {
    if (totalValue >= 100001) {
      return { level: 7, levelName: 'Diamond', bonus: 0.20, icon: '💠' };
    } else if (totalValue >= 50001) {
      return { level: 6, levelName: 'Platinum', bonus: 0.18, icon: '💎' };
    } else if (totalValue >= 10001) {
      return { level: 5, levelName: 'Gold', bonus: 0.15, icon: '🥇' };
    } else if (totalValue >= 2001) {
      return { level: 4, levelName: 'Silver', bonus: 0.12, icon: '🥈' };
    } else if (totalValue >= 501) {
      return { level: 3, levelName: 'Bronze', bonus: 0.10, icon: '🥉' };
    } else if (totalValue >= 101) {
      return { level: 2, levelName: 'Mini', bonus: 0.08, icon: '⚪' };
    } else {
      return { level: 1, levelName: 'Micro', bonus: 0.05, icon: '🪙' };
    }
  }
  
  /**
   * 更新推荐人等级
   */
  async updateReferrerLevel(userAddress: string) {
    try {
      // 1. 统计直推节点总价值
      const totalValue = this.calculateDirectReferralValue(userAddress);
      
      // 2. 计算等级
      const levelInfo = this.calculateReferrerLevel(totalValue);
      
      // 3. 更新用户等级
      db.prepare(`
        UPDATE users 
        SET 
          referral_value = ?,
          referrer_level = ?,
          swap_mining_bonus = ?
        WHERE wallet_address = ?
      `).run(
        totalValue,
        levelInfo.level,
        levelInfo.bonus,
        userAddress
      );
      
      console.log(`✅ 推荐人等级更新: ${levelInfo.levelName} (直推节点总价值: $${totalValue})`);
      
      return {
        success: true,
        data: {
          totalValue,
          level: levelInfo.level,
          levelName: levelInfo.levelName,
          bonus: levelInfo.bonus,
          icon: levelInfo.icon
        }
      };
    } catch (error) {
      console.error('❌ 更新推荐人等级失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取用户推荐人等级
   */
  getUserReferrerLevel(userAddress: string) {
    const result = db.prepare(`
      SELECT * FROM user_referrer_level WHERE wallet_address = ?
    `).get(userAddress);
    
    if (!result) {
      return {
        success: true,
        data: {
          wallet_address: userAddress,
          referral_value: 0,
          referrer_level: 1,
          level_name: 'Micro',
          swap_mining_bonus: 0.05,
          icon: '🪙',
          description: '$0 - $100'
        }
      };
    }
    
    return {
      success: true,
      data: result
    };
  }
  
  /**
   * 获取推荐人等级配置
   */
  getReferrerLevelConfig() {
    const levels = db.prepare(`
      SELECT * FROM referrer_level_config ORDER BY level
    `).all();
    
    return {
      success: true,
      data: levels
    };
  }
  
  /**
   * 获取直推列表
   */
  getDirectReferrals(userAddress: string) {
    const referrals = db.prepare(`
      SELECT 
        u.wallet_address,
        u.created_at,
        COALESCE(SUM(n.price), 0) as node_value,
        COUNT(n.id) as node_count
      FROM users u
      LEFT JOIN nodes n ON u.wallet_address = n.owner_address AND n.status = 'active'
      WHERE u.referrer_address = ?
      GROUP BY u.wallet_address
      ORDER BY node_value DESC
    `).all(userAddress);
    
    return {
      success: true,
      data: referrals
    };
  }
  
  /**
   * 计算 SWAP 挖矿奖励（含推荐人加成）
   */
  calculateSwapMiningWithBonus(userAddress: string, tradeValue: number): number {
    // 1. 基础奖励
    const baseReward = tradeValue * 0.0003;
    
    // 2. 获取用户推荐人等级加成
    const user = db.prepare(`
      SELECT swap_mining_bonus FROM users WHERE wallet_address = ?
    `).get(userAddress) as any;
    
    if (!user) {
      return baseReward;
    }
    
    // 3. 应用推荐人加成
    const bonus = baseReward * user.swap_mining_bonus;
    const totalReward = baseReward + bonus;
    
    console.log(`SWAP 挖矿: 基础 ${baseReward} + 推荐人加成 ${bonus} (${user.swap_mining_bonus * 100}%) = ${totalReward}`);
    
    return totalReward;
  }
}

export const referrerLevelService = new ReferrerLevelService();
