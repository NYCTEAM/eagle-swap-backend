const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');
const schemaPath = path.join(__dirname, '..', 'src', 'database', 'schema.sql');

console.log('🔧 修复数据库 schema...');
console.log('数据库路径:', dbPath);
console.log('Schema 路径:', schemaPath);
console.log('');

try {
  const db = new Database(dbPath);
  
  // 读取 schema.sql
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  console.log('📝 执行 schema.sql...');
  
  // 执行 schema
  db.exec(schema);
  
  console.log('✅ Schema 执行成功！');
  console.log('');
  
  // 验证表是否创建
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  console.log('📊 数据库中的表 (' + tables.length + ' 个):');
  tables.forEach((table, index) => {
    console.log(`  ${index + 1}. ${table.name}`);
  });
  
  console.log('');
  
  // 检查关键表
  const requiredTables = [
    'users',
    'nodes',
    'node_mining_rewards',
    'referral_relationships',
    'referral_rewards',
    'swap_transactions',
    'swap_rewards'
  ];
  
  console.log('🔍 验证必需的表:');
  let allExist = true;
  requiredTables.forEach(tableName => {
    const exists = tables.some(t => t.name === tableName);
    if (exists) {
      console.log(`  ✅ ${tableName}`);
    } else {
      console.log(`  ❌ ${tableName} - 仍然缺失！`);
      allExist = false;
    }
  });
  
  console.log('');
  
  if (allExist) {
    console.log('🎉 所有必需的表都已创建！');
  } else {
    console.log('⚠️  某些表仍然缺失，请检查 schema.sql');
  }
  
  db.close();
  
} catch (error) {
  console.error('❌ 错误:', error.message);
  console.error(error);
}
