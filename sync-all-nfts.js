#!/usr/bin/env node

/**
 * 完整的NFT同步脚本
 * - 同步所有链上的NFT到数据库
 * - 更新所有者地址
 * - 支持X Layer和BSC
 */

const { ethers } = require("ethers");
const Database = require("better-sqlite3");
const path = require("path");

const CONTRACTS = {
  XLAYER: {
    chainId: 196,
    chainName: "X Layer",
    rpc: process.env.XLAYER_RPC_URL || "https://rpc1.eagleswap.llc/xlayer/",
    address: process.env.XLAYER_NFT_ADDRESS || "0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7"
  },
  BSC: {
    chainId: 56,
    chainName: "BSC",
    rpc: process.env.BSC_RPC_URL || "https://rpc1.eagleswap.llc/bsc/",
    address: process.env.BSC_NFT_ADDRESS || "0x3c117d186C5055071EfF91d87f2600eaF88D591D"
  }
};

const NFT_ABI = [
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function nftData(uint256 tokenId) view returns (uint8 level, uint256 mintedAt, uint256 globalTokenId)"
];

const LEVEL_WEIGHTS = {
  1: 1000,
  2: 3000,
  3: 5000,
  4: 10000,
  5: 20000,
  6: 50000,
  7: 100000
};

async function syncChain(config, db) {
  console.log(`\n🔄 同步 ${config.chainName}...`);
  
  const provider = new ethers.JsonRpcProvider(config.rpc);
  const contract = new ethers.Contract(config.address, NFT_ABI, provider);
  
  try {
    const totalSupply = await contract.totalSupply();
    const count = Number(totalSupply);
    console.log(`  链上总供应: ${count}`);
    
    let newCount = 0;
    let updateCount = 0;
    
    for (let i = 0; i < count; i++) {
      const localTokenId = await contract.tokenByIndex(i);
      const owner = await contract.ownerOf(localTokenId);
      const nftData = await contract.nftData(localTokenId);
      const globalId = Number(nftData.globalTokenId);
      const level = Number(nftData.level);
      const mintedAt = Number(nftData.mintedAt);
      
      // 检查是否存在
      const existing = db.prepare(`
        SELECT * FROM nft_holders 
        WHERE chain_id = ? AND global_token_id = ?
      `).get(config.chainId, globalId);
      
      if (!existing) {
        // 新增NFT
        const weight = LEVEL_WEIGHTS[level] || 1000;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO nft_holders 
          (global_token_id, chain_id, chain_name, contract_address, 
           owner_address, level, weight, effective_weight, stage, minted_at, 
           tx_hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        `).run(
          globalId,
          config.chainId,
          config.chainName,
          config.address.toLowerCase(),
          owner.toLowerCase(),
          level,
          weight,
          weight,
          mintedAt,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          now,
          now
        );
        
        console.log(`  ✅ 新增 Token ${globalId} (Level ${level}) -> ${owner.substring(0, 10)}...`);
        newCount++;
      } else if (existing.owner_address.toLowerCase() !== owner.toLowerCase()) {
        // 更新所有者
        const now = new Date().toISOString();
        
        db.prepare(`
          UPDATE nft_holders 
          SET owner_address = ?, updated_at = ?
          WHERE chain_id = ? AND global_token_id = ?
        `).run(
          owner.toLowerCase(),
          now,
          config.chainId,
          globalId
        );
        
        console.log(`  🔄 更新 Token ${globalId} 所有者: ${existing.owner_address.substring(0, 10)}... -> ${owner.substring(0, 10)}...`);
        updateCount++;
      }
    }
    
    console.log(`  📊 ${config.chainName} 完成: ${newCount} 新增, ${updateCount} 更新`);
    
  } catch (error) {
    console.error(`  ❌ ${config.chainName} 同步失败:`, error.message);
  }
}

async function main() {
  console.log("🚀 开始同步所有链的NFT...\n");
  
  const dbPath = path.join(process.cwd(), "data", "eagleswap.db");
  const db = new Database(dbPath);
  
  try {
    // 同步所有链
    for (const [key, config] of Object.entries(CONTRACTS)) {
      await syncChain(config, db);
    }
    
    // 显示最终统计
    console.log("\n📊 数据库统计:");
    const stats = db.prepare(`
      SELECT 
        chain_name,
        COUNT(*) as count,
        COUNT(DISTINCT owner_address) as unique_owners
      FROM nft_holders
      GROUP BY chain_name
    `).all();
    
    stats.forEach(s => {
      console.log(`  ${s.chain_name}: ${s.count} NFTs, ${s.unique_owners} 持有者`);
    });
    
    const total = db.prepare("SELECT COUNT(*) as count FROM nft_holders").get();
    console.log(`  总计: ${total.count} NFTs`);
    
  } finally {
    db.close();
  }
  
  console.log("\n✅ 同步完成！");
}

main().catch(error => {
  console.error("❌ 同步失败:", error);
  process.exit(1);
});
