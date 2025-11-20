const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'eagle-swap.db');
console.log('数据库路径:', dbPath);

const db = new Database(dbPath);

// 获取所有表
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('\n现有表:');
tables.forEach(t => console.log('  -', t.name));

// 检查 NFT 相关表
console.log('\nNFT 相关表:');
const nftTables = tables.filter(t => t.name.toLowerCase().includes('nft'));
nftTables.forEach(t => console.log('  -', t.name));

// 检查 vip_levels 表
const hasVipLevels = tables.some(t => t.name === 'vip_levels');
console.log('\nvip_levels 表存在?', hasVipLevels);

if (hasVipLevels) {
  const count = db.prepare('SELECT COUNT(*) as count FROM vip_levels').get();
  console.log('vip_levels 记录数:', count.count);
}

// 检查 nft_level_bonus 表
const hasNftBonus = tables.some(t => t.name === 'nft_level_bonus');
console.log('nft_level_bonus 表存在?', hasNftBonus);

if (hasNftBonus) {
  const count = db.prepare('SELECT COUNT(*) as count FROM nft_level_bonus').get();
  console.log('nft_level_bonus 记录数:', count.count);
}

// 检查 user_nfts 表
const hasUserNfts = tables.some(t => t.name === 'user_nfts');
console.log('user_nfts 表存在?', hasUserNfts);

// 检查 user_nft_holdings 表
const hasUserNftHoldings = tables.some(t => t.name === 'user_nft_holdings');
console.log('user_nft_holdings 表存在?', hasUserNftHoldings);

if (hasUserNftHoldings) {
  const count = db.prepare('SELECT COUNT(*) as count FROM user_nft_holdings').get();
  console.log('user_nft_holdings 记录数:', count.count);
}

db.close();
