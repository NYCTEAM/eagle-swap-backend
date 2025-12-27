// 检查 NFT 持有者信息的简单脚本
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new Database(dbPath);

console.log('📊 NFT 持有者统计:\n');

// 查询所有 NFT
const allNfts = db.prepare(`
  SELECT 
    global_token_id,
    chain_name,
    owner_address,
    level,
    weight,
    updated_at
  FROM nft_holders
  ORDER BY updated_at DESC
`).all();

console.log(`总共 ${allNfts.length} 个 NFT\n`);

// 按持有者分组
const byOwner = db.prepare(`
  SELECT 
    owner_address,
    chain_name,
    COUNT(*) as nft_count,
    SUM(weight) as total_weight
  FROM nft_holders
  GROUP BY owner_address, chain_name
  ORDER BY total_weight DESC
`).all();

console.log('按持有者统计:');
console.table(byOwner);

// 显示最近更新的 NFT
console.log('\n最近更新的 10 个 NFT:');
const recent = db.prepare(`
  SELECT 
    global_token_id,
    chain_name,
    owner_address,
    level,
    weight,
    updated_at
  FROM nft_holders
  ORDER BY updated_at DESC
  LIMIT 10
`).all();

console.table(recent);

db.close();
