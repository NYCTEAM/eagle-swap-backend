const { ethers } = require('ethers');
const Database = require('better-sqlite3');

console.log('🔄 同步旧 NFT 合约数据到新合约\n');

// 旧 NFT 合约地址
const OLD_NFT_CONTRACT = '0xc80088A4bc2C5d90b9747CFCe8841b4c2326aE82';
// 新 NFT 合约地址
const NEW_NFT_CONTRACT = '0x8d3FBe540CBe8189333A1758cE3801067A023809';
const RPC_URL = 'https://rpc.xlayer.tech';
const CHAIN_ID = 196;

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
    console.log('📊 旧合约地址:', OLD_NFT_CONTRACT);
    console.log('📊 新合约地址:', NEW_NFT_CONTRACT);
    console.log('🌐 RPC URL:', RPC_URL);
    console.log('');
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const oldContract = new ethers.Contract(OLD_NFT_CONTRACT, NFT_ABI, provider);
    const db = new Database(dbPath);
    
    // 1. 清空新合约的旧数据
    console.log('🗑️  清空数据库中的旧 NFT 数据...');
    db.prepare('DELETE FROM user_nfts WHERE chain_id = ?').run(CHAIN_ID);
    console.log('✅ 已清空\n');
    
    // 2. 从旧合约读取 NFT 数据
    console.log('📊 从旧合约读取 NFT 总供应量...');
    const totalSupply = await oldContract.totalSupply();
    console.log('旧合约总供应量: ' + totalSupply.toString() + ' NFTs\n');
    
    if (totalSupply === 0n) {
      console.log('⚠️  旧合约没有 NFT 数据');
      db.close();
      return;
    }
    
    console.log('🔄 开始同步旧合约 NFT 数据...\n');
    
    let synced = 0;
    let errors = 0;
    
    for (let i = 0; i < Number(totalSupply); i++) {
      try {
        const tokenId = await oldContract.tokenByIndex(i);
        const owner = await oldContract.ownerOf(tokenId);
        const level = await oldContract.tokenLevel(tokenId);
        const levelInfo = await oldContract.getLevelInfo(level);
        
        console.log('NFT #' + tokenId.toString() + ':');
        console.log('  所有者: ' + owner);
        console.log('  等级: ' + level.toString() + ' (' + levelInfo.name + ')');
        console.log('  权重: ' + ethers.formatUnits(levelInfo.weight, 18));
        
        // 插入到数据库，标记为来自新合约
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
        console.log('  ✅ 已同步到数据库\n');
        
      } catch (error) {
        console.error('  ❌ 同步失败: ' + error.message + '\n');
        errors++;
      }
    }
    
    // 3. 更新 nft_inventory 表（从旧合约读取配置）
    console.log('📋 更新 NFT 等级库存配置...');
    
    for (let level = 1; level <= 7; level++) {
      try {
        const levelInfo = await oldContract.getLevelInfo(level);
        
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
        console.error('  ❌ 更新失败: ' + error.message + '\n');
      }
    }
    
    // 4. 统计
    console.log('📊 同步统计:');
    console.log('  成功: ' + synced);
    console.log('  失败: ' + errors);
    console.log('  总计: ' + Number(totalSupply));
    
    const userCount = db.prepare('SELECT COUNT(DISTINCT owner_address) as count FROM user_nfts WHERE chain_id = ?').get(CHAIN_ID);
    console.log('  持有者数量: ' + userCount.count);
    
    console.log('\n📋 数据库中的 NFT 记录:');
    const allNfts = db.prepare('SELECT token_id, owner_address, level, weight FROM user_nfts WHERE chain_id = ? ORDER BY token_id').all(CHAIN_ID);
    allNfts.forEach(nft => {
      console.log('  Token #' + nft.token_id + ': ' + nft.owner_address + ' (Level ' + nft.level + ', Weight ' + nft.weight + ')');
    });
    
    db.close();
    console.log('\n✅ 同步完成！');
    console.log('💡 提示: 数据库现在包含旧合约的 NFT 数据，后端会使用这些数据计算 boost');
    
  } catch (error) {
    console.error('\n❌ 错误: ' + error.message);
    console.error(error);
    process.exit(1);
  }
})();
