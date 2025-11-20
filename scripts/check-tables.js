const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('📊 检查数据库表...');
console.log('数据库路径:', dbPath);
console.log('');

try {
  const db = new Database(dbPath);
  
  // 获取所有表
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  console.log('✅ 数据库中的表 (' + tables.length + ' 个):');
  tables.forEach((table, index) => {
    console.log(`  ${index + 1}. ${table.name}`);
  });
  
  console.log('');
  
  // 检查关键表是否存在
  const requiredTables = [
    'users',
    'nodes',
    'node_mining_rewards',
    'referral_relationships',
    'referral_rewards',
    'swap_transactions',
    'swap_rewards'
  ];
  
  console.log('🔍 检查必需的表:');
  requiredTables.forEach(tableName => {
    const exists = tables.some(t => t.name === tableName);
    if (exists) {
      console.log(`  ✅ ${tableName}`);
    } else {
      console.log(`  ❌ ${tableName} - 缺失！`);
    }
  });
  
  db.close();
  
} catch (error) {
  console.error('❌ 错误:', error.message);
}
