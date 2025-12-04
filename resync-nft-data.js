const { ethers } = require('ethers');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🔄 重新同步 NFT 数据\n');

// NFT 合约配置
const NFT_CONTRACT_ADDRESS = '0x8d3FBe540CBe8189333A1758cE3801067A023809';
const RPC_URL = 'https://rpc.xlayer.tech';
const CHAIN_ID = 196;

// NFT ABI (只需要必要的函数)
const NFT_ABI = [
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getLevelInfo(uint256 level) view returns (tuple(string name, uint256 priceUSDT, uint256 priceNative, uint256 weight, uint256 totalSupply, bool isActive))',
  'function tokenLevel(uint256 tokenId) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

const dbPath = '/app/data/eagleswap.db';

(async () => {
  try {
    console.log('📊 NFT 合约地址:', NFT_CONTRACT_ADDRESS);
    console.log('🌐 RPC URL:', RPC_URL);
    console.log('⛓️  Chain ID:', CHAIN_ID);
    console.log('');
    
    // 连接区块链
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
    
    // 连接数据库
    const db = new Database(dbPath);
    
    // 1. 清空旧的 NFT 数据
    console.log('🗑️  清空旧的 NFT 数据...');
    db.prepare('DELETE FROM user_nfts WHERE chain_id = ?').run(CHAIN_ID);
    console.log('✅ 已清空旧数据\n');
    
    // 2. 获取总供应量
    console.log('📊 获取 NFT 总供应量...');
    const totalSupply = await contract.totalSupply();
    console.log('总供应量:', totalSupply.toString(), 'NFTs\n');
    
    if (totalSupply === 0n) {
      console.log('⚠️  没有 NFT 需要同步');
      db.close();
      return;
    }
    
    // 3. 同步每个 NFT
    console.log('🔄 开始同步 NFT 数据...\n');
    
    let synced = 0;
    let errors = 0;
    
    for (let i = 0; i < Number(totalSupply); i++) {
      try {
        // 获取 token ID
        const tokenId = await contract.tokenByIndex(i);
        
        // 获取所有者
        const owner = await contract.ownerOf(tokenId);
        
        // 获取等级
        const level = await contract.tokenLevel(tokenId);
        
        // 获取等级信息
        const levelInfo = await contract.getLevelInfo(level);
        
        console.log(`NFT #${tokenId.toString()}:`);
        console.log(`  所有者: ${owner}`);
        console.log(`  等级: ${level.toString()} (${levelInfo.name})`);
        console.log(`  权重: ${ethers.formatUnits(levelInfo.weight, 18)}`);
        
        // 插入或更新数据库
        db.prepare(`
          INSERT INTO user_nfts (
            token_id, owner_address, level, weight, chain_id, created_at
          ) VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(token_id, chain_id) DO UPDATE SET
            owner_address = excluded.owner_address,
            level = excluded.level,
            weight = excluded.weight
        `).run(
          tokenId.toString(),
          owner.toLowerCase(),
          level.toString(),
          parseFloat(ethers.formatUnits(levelInfo.weight, 18)),
          CHAIN_ID
        );
        
        synced++;
        console.log(`  ✅ 已同步\n`);
        
      } catch (error) {
        console.error(`  ❌ 同步失败:`, error.message, '\n');
        errors++;
      }
    }
    
    // 4. 更新 nft_inventory 表
    console.log('📋 更新 NFT 等级库存...');
    
    for (let level = 1; level <= 7; level++) {
      try {
        const levelInfo = await contract.getLevelInfo(level);
        
        if (levelInfo.isActive) {
          console.log(`等级 ${level}: ${levelInfo.name}`);
          console.log(`  价格: $${ethers.formatUnits(levelInfo.priceUSDT, 6)} USDT`);
          console.log(`  权重: ${ethers.formatUnits(levelInfo.weight, 18)}`);
          console.log(`  总供应: ${levelInfo.totalSupply.toString()}`);
          
          db.prepare(`
            INSERT INTO nft_inventory (
              level, name, price_usdt, weight, total_supply, is_active
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(level) DO UPDATE SET
              name = excluded.name,
              price_usdt = excluded.price_usdt,
              weight = excluded.weight,
              total_supply = excluded.total_supply,
              is_active = excluded.is_active
          `).run(
            level,
            levelInfo.name,
            parseFloat(ethers.formatUnits(levelInfo.priceUSDT, 6)),
            parseFloat(ethers.formatUnits(levelInfo.weight, 18)),
            levelInfo.totalSupply.toString(),
            levelInfo.isActive ? 1 : 0
          );
          
          console.log(`  ✅ 已更新\n`);
        }
      } catch (error) {
        console.error(`  ❌ 更新失败:`, error.message, '\n');
      }
    }
    
    // 5. 统计
    console.log('📊 同步统计:');
    console.log('  成功:', synced);
    console.log('  失败:', errors);
    console.log('  总计:', Number(totalSupply));
    
    const userCount = db.prepare('SELECT COUNT(DISTINCT owner_address) as count FROM user_nfts WHERE chain_id = ?').get(CHAIN_ID);
    console.log('  持有者数量:', userCount.count);
    
    db.close();
    console.log('\n✅ 同步完成！');
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
