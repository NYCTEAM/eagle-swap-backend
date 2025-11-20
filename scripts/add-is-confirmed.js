const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('添加 is_confirmed 字段...\n');

try {
  const db = new Database(dbPath);
  
  try {
    db.exec('ALTER TABLE referral_relationships ADD COLUMN is_confirmed BOOLEAN DEFAULT 0');
    console.log('✅ is_confirmed 字段已添加');
  } catch (e) {
    if (e.message.includes('duplicate')) {
      console.log('⚠️  is_confirmed 字段已存在');
    } else {
      console.log('❌ 错误:', e.message);
    }
  }
  
  // 验证
  const columns = db.prepare(`PRAGMA table_info(referral_relationships)`).all();
  const hasField = columns.some(col => col.name === 'is_confirmed');
  
  console.log(`\n验证: ${hasField ? '✅' : '❌'} is_confirmed 字段存在`);
  
  db.close();
  console.log('\n完成！');
  
} catch (error) {
  console.error('错误:', error.message);
}
