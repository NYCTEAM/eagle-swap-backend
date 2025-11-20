const db = require('better-sqlite3')('./data/eagle-swap.db');

console.log('=== 数据库表检查 ===\n');

// 查询所有表
const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' 
  ORDER BY name
`).all();

console.log('数据库中的所有表:');
tables.forEach((t, i) => {
  console.log(`  ${i + 1}. ${t.name}`);
});

console.log(`\n总计: ${tables.length} 个表\n`);

// 检查关键表
const keyTables = [
  'users',
  'nodes',
  'node_levels',
  'swap_transactions',
  'swap_mining_rewards',
  'referral_relationships',
  'referral_rewards',
  'nft_multipliers',
  'supported_chains'
];

console.log('关键表检查:');
keyTables.forEach(tableName => {
  const exists = tables.some(t => t.name === tableName);
  console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
});

db.close();
console.log('\n=== 检查完成 ===');
