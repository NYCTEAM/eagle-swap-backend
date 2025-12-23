/**
 * 快速同步NFT - 手动触发
 * 用于立即同步新购买的NFT到数据库
 */

const { ethers } = require('ethers');
const Database = require('better-sqlite3');
const path = require('path');

// 合约配置
const CONTRACTS = {
  XLAYER: {
    name: 'X Layer',
    chainId: 196,
    rpc: process.env.XLAYER_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/',
    address: process.env.XLAYER_NFT_ADDRESS || '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7'
  },
  BSC: {
    name: 'BSC',
    chainId: 56,
    rpc: process.env.BSC_RPC_URL || 'https://rpc1.eagleswap.llc/bsc/',
    address: process.env.BSC_NFT_ADDRESS || '0x3c117d186C5055071EfF91d87f2600eaF88D591D'
  }
};

const NFT_ABI = [
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function nftData(uint256 tokenId) view returns (uint8 level, uint256 mintedAt, uint256 globalTokenId)'
];

// 等级配置
const LEVEL_CONFIG = {
  1: { name: 'Micro Node', weight: 0.1 },
  2: { name: 'Mini Node', weight: 0.2 },
  3: { name: 'Standard Node', weight: 0.5 },
  4: { name: 'Advanced Node', weight: 1.0 },
  5: { name: 'Elite Node', weight: 2.0 },
  6: { name: 'Master Node', weight: 5.0 },
  7: { name: 'Ultra Node', weight: 10.0 }
};

async function syncChain(chainConfig) {
  console.log(`\n🔄 同步 ${chainConfig.name}...`);
  
  try {
    const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
    const contract = new ethers.Contract(chainConfig.address, NFT_ABI, provider);
    const db = new Database(path.join(process.cwd(), 'data', 'eagle-swap.db'));
    
    const totalSupply = await contract.totalSupply();
    const count = Number(totalSupply);
    
    console.log(`📊 链上总供应: ${count}`);
    
    let synced = 0;
    let updated = 0;
    let skipped = 0;
    
    for (let i = 0; i < count; i++) {
      try {
        const tokenId = await contract.tokenByIndex(i);
        const owner = await contract.ownerOf(tokenId);
        const nftData = await contract.nftData(tokenId);
        
        const levelConfig = LEVEL_CONFIG[nftData.level];
        
        // 检查是否已存在
        const existing = db.prepare(`
          SELECT * FROM nft_holders 
          WHERE chain_id = ? AND token_id = ?
        `).get(chainConfig.chainId, tokenId.toString());
        
        if (existing) {
          // 更新所有者
          if (existing.owner_address.toLowerCase() !== owner.toLowerCase()) {
            db.prepare(`
              UPDATE nft_holders 
              SET owner_address = ?, updated_at = ?
              WHERE chain_id = ? AND token_id = ?
            `).run(
              owner.toLowerCase(),
              Math.floor(Date.now() / 1000),
              chainConfig.chainId,
              tokenId.toString()
            );
            updated++;
            console.log(`   ✅ 更新 Token ${tokenId}: ${owner.slice(0, 6)}...`);
          } else {
            skipped++;
          }
        } else {
          // 插入新记录
          db.prepare(`
            INSERT INTO nft_holders (
              chain_id, chain_name, contract_address, token_id, global_token_id,
              owner_address, level, weight, minted_at, payment_method
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            chainConfig.chainId,
            chainConfig.name,
            chainConfig.address.toLowerCase(),
            tokenId.toString(),
            nftData.globalTokenId.toString(),
            owner.toLowerCase(),
            nftData.level,
            levelConfig.weight,
            Number(nftData.mintedAt),
            'USDT'
          );
          synced++;
          console.log(`   🆕 新增 Token ${tokenId} (Global: ${nftData.globalTokenId}): ${owner.slice(0, 6)}...`);
        }
        
      } catch (e) {
        console.error(`   ❌ Token ${i} 失败:`, e.message);
      }
    }
    
    db.close();
    
    console.log(`\n✅ ${chainConfig.name} 同步完成:`);
    console.log(`   新增: ${synced}`);
    console.log(`   更新: ${updated}`);
    console.log(`   跳过: ${skipped}`);
    
    return { synced, updated, skipped };
    
  } catch (error) {
    console.error(`\n❌ ${chainConfig.name} 同步失败:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 快速同步NFT数据\n');
  
  const results = {};
  
  // 同步所有链
  for (const [key, chainConfig] of Object.entries(CONTRACTS)) {
    const result = await syncChain(chainConfig);
    results[key] = result;
  }
  
  // 汇总
  console.log('\n' + '='.repeat(60));
  console.log('📊 同步汇总');
  console.log('='.repeat(60));
  
  for (const [key, result] of Object.entries(results)) {
    if (result) {
      console.log(`\n${CONTRACTS[key].name}:`);
      console.log(`   新增: ${result.synced}`);
      console.log(`   更新: ${result.updated}`);
      console.log(`   跳过: ${result.skipped}`);
    } else {
      console.log(`\n${CONTRACTS[key].name}: ❌ 失败`);
    }
  }
  
  console.log('\n✅ 同步完成！刷新前端页面查看新的NFT。');
}

main().catch(console.error);
