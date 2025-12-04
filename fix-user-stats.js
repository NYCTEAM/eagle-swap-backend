const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🔧 修复 user_swap_stats 表\n');

const dbPath = '/app/data/eagleswap.db';
const db = new Database(dbPath);

try {
  console.log('✅ 使用数据库:', dbPath);
  
  // 获取所有有交易记录的用户
  const users = db.prepare(`
    SELECT DISTINCT user_address FROM swap_transactions
  `).all();
  
  console.log('找到', users.length, '个用户需要同步\n');
  
  let fixed = 0;
  
  for (const user of users) {
    const userAddress = user.user_address;
    
    // 1. 从 swap_transactions 计算总奖励
    const txStats = db.prepare(`
      SELECT 
        COUNT(*) as total_trades,
        COALESCE(SUM(trade_value_usdt), 0) as total_volume_usdt,
        COALESCE(SUM(eagle_reward), 0) as total_eagle_earned
      FROM swap_transactions 
      WHERE user_address = ?
    `).get(userAddress);
    
    // 2. 获取当前的 user_swap_stats
    const currentStats = db.prepare(`
      SELECT * FROM user_swap_stats WHERE user_address = ?
    `).get(userAddress);
    
    if (currentStats) {
      // 更新现有记录
      if (currentStats.total_eagle_earned !== txStats.total_eagle_earned) {
        console.log('🔄 更新用户:', userAddress);
        console.log('  旧值: total_eagle_earned =', currentStats.total_eagle_earned);
        console.log('  新值: total_eagle_earned =', txStats.total_eagle_earned);
        console.log('  已领取:', currentStats.total_eagle_claimed);
        console.log('  待领取:', (txStats.total_eagle_earned - currentStats.total_eagle_claimed).toFixed(6));
        
        db.prepare(`
          UPDATE user_swap_stats 
          SET 
            total_trades = ?,
            total_volume_usdt = ?,
            total_eagle_earned = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_address = ?
        `).run(
          txStats.total_trades,
          txStats.total_volume_usdt,
          txStats.total_eagle_earned,
          userAddress
        );
        
        fixed++;
        console.log('  ✅ 已更新\n');
      }
    } else {
      // 创建新记录
      console.log('➕ 创建用户记录:', userAddress);
      console.log('  交易数:', txStats.total_trades);
      console.log('  交易量:', txStats.total_volume_usdt, 'USDT');
      console.log('  总奖励:', txStats.total_eagle_earned, 'EAGLE');
      
      db.prepare(`
        INSERT INTO user_swap_stats (
          user_address, 
          total_trades, 
          total_volume_usdt, 
          total_eagle_earned, 
          total_eagle_claimed
        ) VALUES (?, ?, ?, ?, 0)
      `).run(
        userAddress,
        txStats.total_trades,
        txStats.total_volume_usdt,
        txStats.total_eagle_earned
      );
      
      fixed++;
      console.log('  ✅ 已创建\n');
    }
  }
  
  db.close();
  console.log('✅ 修复完成！共修复', fixed, '个用户记录');
  
} catch (error) {
  console.error('\n❌ 错误:', error.message);
  console.error(error);
  db.close();
  process.exit(1);
}
