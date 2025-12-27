// 手动更新 NFT 持有者
const Database = require('better-sqlite3');
const path = require('path');

// 配置
const dbPath = path.join(__dirname, '../database.sqlite');

// 从命令行参数获取信息
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('用法: node manual-update-nft-owner.js <globalTokenId> <newOwnerAddress> <chainId>');
  console.log('例如: node manual-update-nft-owner.js 123 0x6d8c62e5b4c24784f4bbac32af1ebe1f8508d22d 196');
  process.exit(1);
}

const globalTokenId = parseInt(args[0]);
const newOwner = args[1].toLowerCase();
const chainId = parseInt(args[2]);

const db = new Database(dbPath);

// 查询当前持有者
const current = db.prepare(`
  SELECT * FROM nft_holders 
  WHERE global_token_id = ? AND chain_id = ?
`).get(globalTokenId, chainId);

if (!current) {
  console.log(`❌ 未找到 NFT #${globalTokenId} (Chain: ${chainId})`);
  db.close();
  process.exit(1);
}

console.log('\n当前信息:');
console.log(`NFT #${globalTokenId}`);
console.log(`链: ${current.chain_name}`);
console.log(`等级: ${current.level}`);
console.log(`权重: ${current.weight}`);
console.log(`当前持有者: ${current.owner_address}`);
console.log(`新持有者: ${newOwner}`);

// 更新持有者
const result = db.prepare(`
  UPDATE nft_holders 
  SET owner_address = ?, updated_at = ?
  WHERE global_token_id = ? AND chain_id = ?
`).run(
  newOwner,
  new Date().toISOString(),
  globalTokenId,
  chainId
);

if (result.changes > 0) {
  console.log(`\n✅ 成功更新 NFT #${globalTokenId} 的持有者！`);
  
  // 显示更新后的信息
  const updated = db.prepare(`
    SELECT * FROM nft_holders 
    WHERE global_token_id = ? AND chain_id = ?
  `).get(globalTokenId, chainId);
  
  console.log('\n更新后信息:');
  console.table(updated);
} else {
  console.log('\n❌ 更新失败');
}

db.close();
