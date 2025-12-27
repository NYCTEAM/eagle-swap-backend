/**
 * 强制同步特定用户的 NFT
 * 用法: node force-sync-nft.js <user_address>
 */

const { ethers } = require('ethers');
const Database = require('better-sqlite3');
const path = require('path');

const USER_ADDRESS = process.argv[2] || '0x4af7f86c70a6fba4ed9d49074d0805a3c63b1e5b';
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS || '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7';
const RPC_URL = process.env.X_LAYER_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/';

const NFT_ABI = [
  'function tokensOfOwner(address owner) view returns (uint256[])',
  'function getLevel(uint256 tokenId) view returns (uint8)',
  'function getCurrentStage(uint256 tokenId) view returns (uint8)',
  'function getEffectiveWeight(uint256 tokenId) view returns (uint256)',
];

async function syncUserNFTs() {
  console.log('🔄 强制同步用户 NFT...');
  console.log('用户地址:', USER_ADDRESS);
  console.log('NFT 合约:', NFT_CONTRACT_ADDRESS);
  console.log('');

  // 连接到区块链
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);

  // 连接到数据库
  const db = new Database(path.join(__dirname, 'data/eagleswap.db'));

  try {
    // 1. 从链上获取用户的所有 NFT
    console.log('📡 从链上查询 NFT...');
    const tokenIds = await contract.tokensOfOwner(USER_ADDRESS);
    console.log(`✅ 链上找到 ${tokenIds.length} 个 NFT:`, tokenIds.map(id => id.toString()));
    console.log('');

    // 2. 检查数据库中的记录
    const dbNFTs = db.prepare(`
      SELECT token_id FROM nft_ownership 
      WHERE LOWER(owner_address) = LOWER(?)
    `).all(USER_ADDRESS);
    console.log(`📊 数据库中有 ${dbNFTs.length} 个 NFT`);
    console.log('');

    // 3. 同步每个 NFT
    for (const tokenId of tokenIds) {
      const id = Number(tokenId);
      console.log(`🔄 同步 NFT #${id}...`);

      try {
        // 从链上获取 NFT 信息
        const level = await contract.getLevel(tokenId);
        const stage = await contract.getCurrentStage(tokenId);
        const effectiveWeight = await contract.getEffectiveWeight(tokenId);

        // 插入或更新数据库
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO nft_ownership
          (token_id, owner_address, level, stage, effective_weight, minted_at, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);

        stmt.run(
          id,
          USER_ADDRESS.toLowerCase(),
          Number(level),
          Number(stage),
          Number(effectiveWeight) / 10
        );

        console.log(`✅ NFT #${id} 已同步 (Level: ${level}, Stage: ${stage}, Weight: ${Number(effectiveWeight) / 10})`);
      } catch (error) {
        console.error(`❌ NFT #${id} 同步失败:`, error.message);
      }
    }

    console.log('');
    console.log('🎉 同步完成！');

    // 4. 验证结果
    const finalCount = db.prepare(`
      SELECT COUNT(*) as count FROM nft_ownership 
      WHERE LOWER(owner_address) = LOWER(?)
    `).get(USER_ADDRESS);

    console.log(`✅ 数据库中现在有 ${finalCount.count} 个 NFT`);

  } catch (error) {
    console.error('❌ 同步失败:', error);
  } finally {
    db.close();
  }
}

syncUserNFTs();
