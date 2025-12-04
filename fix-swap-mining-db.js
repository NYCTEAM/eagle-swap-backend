const Database = require('better-sqlite3');
const path = require('path');

// 数据库路径 (根据容器内路径调整)
const DB_PATH = process.env.DATABASE_PATH || '/app/data/eagleswap.db';

console.log('🔧 Swap Mining 数据库修复脚本');
console.log('📁 数据库路径:', DB_PATH);
console.log('');

try {
  // 连接数据库
  const db = new Database(DB_PATH);
  console.log('✅ 数据库连接成功');
  
  // 1. 检查现有表
  console.log('\n📊 检查现有表...');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  console.log(`找到 ${tables.length} 个表:`);
  tables.forEach(t => console.log(`  - ${t.name}`));
  
  // 2. 创建 user_claim_nonce 表
  console.log('\n🔨 创建 user_claim_nonce 表...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_claim_nonce (
      user_address TEXT PRIMARY KEY,
      nonce INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_claim_nonce_address 
    ON user_claim_nonce(user_address);
  `);
  
  console.log('✅ user_claim_nonce 表创建成功');
  
  // 3. 检查 user_swap_stats 表
  console.log('\n🔨 检查 user_swap_stats 表...');
  const hasUserSwapStats = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='user_swap_stats'
  `).get();
  
  if (!hasUserSwapStats) {
    console.log('创建 user_swap_stats 表...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_swap_stats (
        user_address TEXT PRIMARY KEY,
        total_trades INTEGER DEFAULT 0,
        total_volume_usdt REAL DEFAULT 0,
        total_fee_paid REAL DEFAULT 0,
        total_eagle_earned REAL DEFAULT 0,
        total_eagle_claimed REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_user_swap_stats_address 
      ON user_swap_stats(user_address);
    `);
    
    console.log('✅ user_swap_stats 表创建成功');
  } else {
    console.log('✅ user_swap_stats 表已存在');
  }
  
  // 4. 检查 swap_transactions 表
  console.log('\n🔨 检查 swap_transactions 表...');
  const hasSwapTx = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='swap_transactions'
  `).get();
  
  if (!hasSwapTx) {
    console.log('创建 swap_transactions 表...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS swap_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_hash TEXT UNIQUE NOT NULL,
        user_address TEXT NOT NULL,
        from_token TEXT NOT NULL,
        to_token TEXT NOT NULL,
        from_amount TEXT,
        to_amount TEXT,
        trade_value_usdt REAL DEFAULT 0,
        eagle_reward REAL DEFAULT 0,
        chain_id INTEGER NOT NULL,
        route_info TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_swap_tx_user ON swap_transactions(user_address);
      CREATE INDEX IF NOT EXISTS idx_swap_tx_hash ON swap_transactions(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_swap_tx_chain ON swap_transactions(chain_id);
    `);
    
    console.log('✅ swap_transactions 表创建成功');
  } else {
    console.log('✅ swap_transactions 表已存在');
  }
  
  // 5. 验证表结构
  console.log('\n📋 验证 user_claim_nonce 表结构:');
  const schema = db.prepare(`PRAGMA table_info(user_claim_nonce)`).all();
  schema.forEach(col => {
    console.log(`  - ${col.name}: ${col.type} ${col.pk ? '(PRIMARY KEY)' : ''}`);
  });
  
  // 6. 测试插入和查询
  console.log('\n🧪 测试数据库操作...');
  const testAddress = '0x0000000000000000000000000000000000000001';
  
  // 插入测试数据
  db.prepare(`
    INSERT OR IGNORE INTO user_claim_nonce (user_address, nonce) 
    VALUES (?, 0)
  `).run(testAddress);
  
  // 查询测试数据
  const testRecord = db.prepare(`
    SELECT * FROM user_claim_nonce WHERE user_address = ?
  `).get(testAddress);
  
  if (testRecord) {
    console.log('✅ 数据库读写测试成功');
    console.log('  测试记录:', testRecord);
    
    // 清理测试数据
    db.prepare(`DELETE FROM user_claim_nonce WHERE user_address = ?`).run(testAddress);
    console.log('✅ 测试数据已清理');
  } else {
    console.log('❌ 数据库读写测试失败');
  }
  
  // 7. 统计信息
  console.log('\n📊 数据库统计:');
  const stats = {
    user_claim_nonce: db.prepare(`SELECT COUNT(*) as count FROM user_claim_nonce`).get(),
    user_swap_stats: db.prepare(`SELECT COUNT(*) as count FROM user_swap_stats`).get(),
    swap_transactions: db.prepare(`SELECT COUNT(*) as count FROM swap_transactions`).get()
  };
  
  console.log(`  - user_claim_nonce: ${stats.user_claim_nonce.count} 条记录`);
  console.log(`  - user_swap_stats: ${stats.user_swap_stats.count} 条记录`);
  console.log(`  - swap_transactions: ${stats.swap_transactions.count} 条记录`);
  
  db.close();
  console.log('\n✅ 数据库修复完成！');
  console.log('🚀 现在可以重启后端服务测试 Swap Mining 提取功能');
  
} catch (error) {
  console.error('\n❌ 错误:', error.message);
  console.error(error);
  process.exit(1);
}
