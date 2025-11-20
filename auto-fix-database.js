const db = require('better-sqlite3')('./data/eagle-swap.db');
const fs = require('fs');

console.log('=== 自动修复数据库 ===\n');

let hasErrors = false;

try {
  // 1. 检查并创建 swap_mining_rewards 表（如果不存在）
  console.log('1. 检查 swap_mining_rewards 表...');
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='swap_mining_rewards'
  `).get();
  
  if (!tableExists) {
    console.log('   ❌ 表不存在，创建中...');
    
    // 使用 swap_rewards 作为基础（已存在）
    db.exec(`
      CREATE TABLE IF NOT EXISTS swap_mining_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address TEXT NOT NULL,
        reward_date DATE NOT NULL,
        chain_id INTEGER DEFAULT 196,
        total_trade_volume REAL NOT NULL,
        total_fee_paid REAL NOT NULL,
        eagle_earned REAL NOT NULL,
        claimed BOOLEAN DEFAULT 0,
        claimed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_address) REFERENCES users(wallet_address),
        UNIQUE(user_address, reward_date, chain_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_swap_mining_rewards_user ON swap_mining_rewards(user_address);
      CREATE INDEX IF NOT EXISTS idx_swap_mining_rewards_date ON swap_mining_rewards(reward_date);
      CREATE INDEX IF NOT EXISTS idx_swap_mining_rewards_claimed ON swap_mining_rewards(claimed);
      CREATE INDEX IF NOT EXISTS idx_swap_mining_rewards_chain ON swap_mining_rewards(chain_id);
    `);
    
    console.log('   ✅ swap_mining_rewards 表已创建');
  } else {
    console.log('   ✅ 表已存在');
  }
  
  // 2. 检查 swap_transactions 表的字段
  console.log('\n2. 检查 swap_transactions 表字段...');
  const columns = db.prepare('PRAGMA table_info(swap_transactions)').all();
  const columnNames = columns.map(c => c.name);
  
  const requiredFields = [
    'chain_id',
    'trade_value_usdt',
    'fee_usdt',
    'eagle_reward'
  ];
  
  const missingFields = requiredFields.filter(f => !columnNames.includes(f));
  
  if (missingFields.length > 0) {
    console.log('   ❌ 缺少字段:', missingFields.join(', '));
    console.log('   正在添加...');
    
    // 添加缺失字段
    if (!columnNames.includes('trade_value_usdt')) {
      db.exec('ALTER TABLE swap_transactions ADD COLUMN trade_value_usdt REAL DEFAULT 0');
      console.log('   ✅ 添加 trade_value_usdt');
    }
    if (!columnNames.includes('fee_usdt')) {
      db.exec('ALTER TABLE swap_transactions ADD COLUMN fee_usdt REAL DEFAULT 0');
      console.log('   ✅ 添加 fee_usdt');
    }
    if (!columnNames.includes('eagle_reward')) {
      db.exec('ALTER TABLE swap_transactions ADD COLUMN eagle_reward REAL DEFAULT 0');
      console.log('   ✅ 添加 eagle_reward');
    }
  } else {
    console.log('   ✅ 所有必需字段都存在');
  }
  
  // 3. 创建索引
  console.log('\n3. 创建索引...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_swap_tx_chain ON swap_transactions(chain_id);
    CREATE INDEX IF NOT EXISTS idx_swap_tx_user_chain ON swap_transactions(user_address, chain_id);
  `);
  console.log('   ✅ 索引已创建');
  
  // 4. 创建视图
  console.log('\n4. 创建多链统计视图...');
  db.exec(`
    DROP VIEW IF EXISTS user_multichain_stats;
    
    CREATE VIEW user_multichain_stats AS
    SELECT 
        user_address,
        COALESCE(chain_id, 196) as chain_id,
        sc.chain_name,
        COUNT(*) as total_trades,
        SUM(COALESCE(trade_value_usdt, 0)) as total_volume_usdt,
        SUM(COALESCE(eagle_reward, 0)) as total_eagle_earned
    FROM swap_transactions st
    LEFT JOIN supported_chains sc ON COALESCE(st.chain_id, 196) = sc.chain_id
    GROUP BY user_address, COALESCE(chain_id, 196);
    
    DROP VIEW IF EXISTS user_total_stats;
    
    CREATE VIEW user_total_stats AS
    SELECT 
        user_address,
        COUNT(DISTINCT COALESCE(chain_id, 196)) as chains_used,
        COUNT(*) as total_trades,
        SUM(COALESCE(trade_value_usdt, 0)) as total_volume_usdt,
        SUM(COALESCE(eagle_reward, 0)) as total_eagle_earned
    FROM swap_transactions
    GROUP BY user_address;
    
    DROP VIEW IF EXISTS chain_platform_stats;
    
    CREATE VIEW chain_platform_stats AS
    SELECT 
        COALESCE(st.chain_id, 196) as chain_id,
        sc.chain_name,
        COUNT(DISTINCT st.user_address) as unique_users,
        COUNT(*) as total_trades,
        SUM(COALESCE(st.trade_value_usdt, 0)) as total_volume_usdt,
        SUM(COALESCE(st.eagle_reward, 0)) as total_eagle_distributed
    FROM swap_transactions st
    LEFT JOIN supported_chains sc ON COALESCE(st.chain_id, 196) = sc.chain_id
    GROUP BY COALESCE(st.chain_id, 196);
  `);
  console.log('   ✅ 视图已创建');
  
  // 5. 验证
  console.log('\n5. 验证修复结果...');
  const verification = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='swap_mining_rewards'
  `).get();
  
  if (verification) {
    console.log('   ✅ swap_mining_rewards 表验证通过');
  } else {
    console.log('   ❌ swap_mining_rewards 表验证失败');
    hasErrors = true;
  }
  
  const views = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='view' AND name IN ('user_multichain_stats', 'user_total_stats', 'chain_platform_stats')
  `).all();
  
  console.log(`   ✅ 创建了 ${views.length} 个视图`);
  
  console.log('\n=== ✅ 数据库修复完成 ===');
  
} catch (error) {
  console.error('\n❌ 错误:', error.message);
  hasErrors = true;
} finally {
  db.close();
}

if (hasErrors) {
  console.log('\n⚠️ 修复过程中遇到错误，请检查');
  process.exit(1);
} else {
  console.log('\n🎉 所有修复成功完成！');
  process.exit(0);
}
