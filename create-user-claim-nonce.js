const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🔧 [Swap Mining] 创建 user_claim_nonce 表\n');

const possibleDbPaths = [
  path.join(process.cwd(), 'data/eagleswap.db'),
  '/app/data/eagleswap.db',
  './data/eagleswap.db'
];

let dbPath = '';
for (const p of possibleDbPaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (dbPath === '') {
  console.error('❌ 数据库文件未找到！');
  process.exit(1);
}

console.log('✅ 使用数据库:', dbPath);
const db = new Database(dbPath);

try {
  // 检查 user_claim_nonce 表是否存在
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_claim_nonce'").get();
  
  if (exists) {
    console.log('✅ user_claim_nonce 表已存在');
    
    // 显示表结构
    const schema = db.prepare('PRAGMA table_info(user_claim_nonce)').all();
    console.log('\n表结构:');
    schema.forEach(col => {
      console.log(`  - ${col.name}: ${col.type}${col.pk ? ' [PRIMARY KEY]' : ''}`);
    });
    
    // 显示记录数
    const count = db.prepare('SELECT COUNT(*) as count FROM user_claim_nonce').get();
    console.log(`\n记录数: ${count.count}`);
    
  } else {
    console.log('❌ user_claim_nonce 表不存在，正在创建...');
    
    // 创建表
    db.exec(`
      CREATE TABLE user_claim_nonce (
        user_address TEXT PRIMARY KEY,
        nonce INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建索引
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_claim_nonce_address ON user_claim_nonce(user_address)');
    
    console.log('✅ user_claim_nonce 表创建成功');
    
    // 测试插入
    console.log('\n🧪 测试数据库操作...');
    const testAddress = '0x0000000000000000000000000000000000000001';
    db.prepare('INSERT OR IGNORE INTO user_claim_nonce (user_address, nonce) VALUES (?, 0)').run(testAddress);
    const testRecord = db.prepare('SELECT * FROM user_claim_nonce WHERE user_address = ?').get(testAddress);
    
    if (testRecord) {
      console.log('✅ 数据库读写测试成功');
      console.log('   测试记录:', testRecord);
      db.prepare('DELETE FROM user_claim_nonce WHERE user_address = ?').run(testAddress);
      console.log('✅ 测试数据已清理');
    }
  }
  
  // 检查其他表
  console.log('\n📊 检查其他 Swap Mining 表:');
  const tables = ['user_swap_stats', 'swap_transactions'];
  tables.forEach(tableName => {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
    if (exists) {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      console.log(`  ✅ ${tableName}: ${count.count} 条记录`);
    } else {
      console.log(`  ❌ ${tableName}: 不存在`);
    }
  });
  
  db.close();
  console.log('\n✅ 完成！');
  console.log('🚀 现在可以测试 Swap Mining 提取功能了');
  
} catch (error) {
  console.error('\n❌ 错误:', error.message);
  console.error(error);
  db.close();
  process.exit(1);
}
