const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'eagle-swap.db');
console.log('数据库路径:', dbPath);

const db = new Database(dbPath);

// 获取所有 swap 相关表
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%swap%'").all();
console.log('\nSwap 相关表:');
tables.forEach(t => console.log('  -', t.name));

// 检查 swap_mining_records 表
const hasSwapMiningRecords = tables.some(t => t.name === 'swap_mining_records');
console.log('\nswap_mining_records 表存在?', hasSwapMiningRecords);

// 检查 swap_mining_rewards 表
const hasSwapMiningRewards = tables.some(t => t.name === 'swap_mining_rewards');
console.log('swap_mining_rewards 表存在?', hasSwapMiningRewards);

if (hasSwapMiningRewards) {
  const info = db.prepare('PRAGMA table_info(swap_mining_rewards)').all();
  console.log('\nswap_mining_rewards 表结构:');
  info.forEach(col => console.log('  -', col.name, ':', col.type));
}

db.close();
