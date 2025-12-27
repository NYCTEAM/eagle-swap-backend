// 修复特定的 NFT 转账
const { ethers } = require('ethers');
const Database = require('better-sqlite3');
const path = require('path');

async function fixTransfer() {
  // BSC 配置
  const provider = new ethers.JsonRpcProvider('https://rpc1.eagleswap.llc/bsc/');
  const nftAddress = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';
  const abi = [
    "function nftData(uint256 tokenId) view returns (uint8 level, uint256 mintedAt, uint256 globalTokenId)"
  ];
  const contract = new ethers.Contract(nftAddress, abi, provider);
  
  // 转账信息
  const localTokenId = 1; // Yixiao
  const newOwner = '0x3e117d186c5055071eff91d87f2600eaf88d5910';
  const chainId = 56;
  
  console.log('🔍 查询 NFT 信息...\n');
  
  // 获取 globalTokenId
  const nftData = await contract.nftData(localTokenId);
  const globalTokenId = Number(nftData.globalTokenId);
  const level = Number(nftData.level);
  
  console.log(`Token ID (本地): ${localTokenId}`);
  console.log(`Global Token ID: ${globalTokenId}`);
  console.log(`等级: ${level}`);
  console.log(`新持有者: ${newOwner}\n`);
  
  // 更新数据库
  const dbPath = path.join(__dirname, '../database.sqlite');
  const db = new Database(dbPath);
  
  // 查询当前信息
  const current = db.prepare(`
    SELECT * FROM nft_holders 
    WHERE global_token_id = ? AND chain_id = ?
  `).get(globalTokenId, chainId);
  
  if (current) {
    console.log('当前持有者:', current.owner_address);
    
    // 更新
    const result = db.prepare(`
      UPDATE nft_holders 
      SET owner_address = ?, updated_at = ?
      WHERE global_token_id = ? AND chain_id = ?
    `).run(
      newOwner.toLowerCase(),
      new Date().toISOString(),
      globalTokenId,
      chainId
    );
    
    if (result.changes > 0) {
      console.log('\n✅ 成功更新！');
      
      // 显示更新后的统计
      console.log('\n📊 更新后的持有统计:');
      const stats = db.prepare(`
        SELECT owner_address, chain_name, COUNT(*) as count, SUM(weight) as total_weight
        FROM nft_holders
        WHERE chain_id = 56
        GROUP BY owner_address
        ORDER BY total_weight DESC
      `).all();
      console.table(stats);
    }
  } else {
    console.log('❌ 未找到该 NFT 记录');
  }
  
  db.close();
}

fixTransfer().catch(console.error);
