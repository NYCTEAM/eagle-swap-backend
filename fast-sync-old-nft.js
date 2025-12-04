const { ethers } = require('ethers');
const Database = require('better-sqlite3');

console.log('⚡ 快速同步旧 NFT 合约数据\n');

const OLD_NFT_CONTRACT = '0xc80088A4bc2C5d90b9747CFCe8841b4c2326aE82';
const RPC_URL = 'https://rpc.xlayer.tech';
const CHAIN_ID = 196;

const NFT_ABI = [
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getLevelInfo(uint256 level) view returns (tuple(string name, uint256 priceUSDT, uint256 priceNative, uint256 weight, uint256 totalSupply, bool isActive))',
  'function tokenLevel(uint256 tokenId) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

const dbPath = '/app/data/eagleswap.db';

(async () => {
  try {
    console.log('📊 旧合约地址:', OLD_NFT_CONTRACT);
    console.log('🌐 RPC URL:', RPC_URL);
    console.log('');
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(OLD_NFT_CONTRACT, NFT_ABI, provider);
    const db = new Database(dbPath);
    
    // 1. 清空旧数据
    console.log('🗑️  清空数据库中的旧 NFT 数据...');
    db.prepare('DELETE FROM user_nfts WHERE chain_id = ?').run(CHAIN_ID);
    console.log('✅ 已清空\n');
    
    // 2. 获取总供应量
    console.log('📊 获取 NFT 总供应量...');
    const totalSupply = await contract.totalSupply();
    console.log('总供应量: ' + totalSupply.toString() + ' NFTs\n');
    
    if (totalSupply === 0n) {
      console.log('⚠️  没有 NFT 数据');
      db.close();
      return;
    }
    
    // 3. 批量查询 NFT 数据
    console.log('⚡ 使用批量查询加速同步...\n');
    
    const batchSize = 100;
    let synced = 0;
    let errors = 0;
    
    // 准备批量插入语句
    const insertStmt = db.prepare(`
      INSERT INTO user_nfts (
        token_id, owner_address, level, weight, chain_id, created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(token_id, chain_id) DO UPDATE SET
        owner_address = excluded.owner_address,
        level = excluded.level,
        weight = excluded.weight
    `);
    
    // 开始事务以提高性能
    const insertMany = db.transaction((nfts) => {
      for (const nft of nfts) {
        insertStmt.run(
          nft.tokenId,
          nft.owner,
          nft.level,
          nft.weight,
          CHAIN_ID
        );
      }
    });
    
    // 批量处理
    for (let start = 0; start < Number(totalSupply); start += batchSize) {
      const end = Math.min(start + batchSize, Number(totalSupply));
      console.log('处理 NFT #' + start + ' - #' + (end - 1) + '...');
      
      const batch = [];
      const promises = [];
      
      for (let tokenId = start; tokenId < end; tokenId++) {
        promises.push(
          (async () => {
            try {
              const owner = await contract.ownerOf(tokenId);
              const level = await contract.tokenLevel(tokenId);
              const levelInfo = await contract.getLevelInfo(level);
              
              return {
                tokenId: tokenId.toString(),
                owner: owner.toLowerCase(),
                level: level.toString(),
                weight: parseFloat(ethers.formatUnits(levelInfo.weight, 18))
              };
            } catch (error) {
              console.error('  ❌ Token #' + tokenId + ' 失败: ' + error.message);
              errors++;
              return null;
            }
          })()
        );
      }
      
      const results = await Promise.all(promises);
      const validResults = results.filter(r => r !== null);
      
      if (validResults.length > 0) {
        insertMany(validResults);
        synced += validResults.length;
      }
      
      console.log('  ✅ 已同步 ' + validResults.length + ' 个 NFT\n');
    }
    
    // 4. 更新 NFT 等级库存
    console.log('📋 更新 NFT 等级库存配置...');
    
    for (let level = 1; level <= 7; level++) {
      try {
        const levelInfo = await contract.getLevelInfo(level);
        
        if (levelInfo.isActive) {
          console.log('等级 ' + level + ': ' + levelInfo.name);
          console.log('  价格: $' + ethers.formatUnits(levelInfo.priceUSDT, 6) + ' USDT');
          console.log('  权重: ' + ethers.formatUnits(levelInfo.weight, 18));
          console.log('  总供应: ' + levelInfo.totalSupply.toString());
          
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
          
          console.log('  ✅ 已更新\n');
        }
      } catch (error) {
        console.error('  ❌ 等级 ' + level + ' 更新失败: ' + error.message + '\n');
      }
    }
    
    // 5. 统计
    console.log('📊 同步统计:');
    console.log('  成功: ' + synced);
    console.log('  失败: ' + errors);
    console.log('  总计: ' + Number(totalSupply));
    
    const userCount = db.prepare('SELECT COUNT(DISTINCT owner_address) as count FROM user_nfts WHERE chain_id = ?').get(CHAIN_ID);
    console.log('  持有者数量: ' + userCount.count);
    
    const levelStats = db.prepare('SELECT level, COUNT(*) as count FROM user_nfts WHERE chain_id = ? GROUP BY level ORDER BY level').all(CHAIN_ID);
    console.log('\n📊 各等级分布:');
    levelStats.forEach(stat => {
      console.log('  Level ' + stat.level + ': ' + stat.count + ' NFTs');
    });
    
    db.close();
    console.log('\n✅ 同步完成！');
    console.log('💡 提示: 数据库已更新，刷新前端页面即可看到最新数据');
    
  } catch (error) {
    console.error('\n❌ 错误: ' + error.message);
    console.error(error);
    process.exit(1);
  }
})();
