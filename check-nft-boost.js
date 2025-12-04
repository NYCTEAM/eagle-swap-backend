const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🔍 检查 NFT Boost 数据\n');

const possibleDbPaths = [
  path.join(process.cwd(), 'data/eagleswap.db'),
  '/app/data/eagleswap.db',
  './data/eagleswap.db'
];

let dbPath = '';
for (const p of possibleDbPaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (dbPath === '') {
  console.error('❌ 数据库文件未找到！');
  process.exit(1);
}

console.log('✅ 使用数据库:', dbPath);
const db = new Database(dbPath);

try {
  // 1. 检查 user_nfts 表
  console.log('\n📊 用户 NFT 数据:');
  const userAddress = '0x4af7f86c70a6fba4ed9d49074d0805a3c63b1e5b';
  
  const userNFTs = db.prepare(`
    SELECT token_id, level, weight, is_mining, created_at 
    FROM user_nfts 
    WHERE owner_address = ? 
    ORDER BY token_id
  `).all(userAddress.toLowerCase());
  
  if (userNFTs.length > 0) {
    console.log(`找到 ${userNFTs.length} 个 NFT:`);
    userNFTs.forEach(nft => {
      console.log(`  - Token #${nft.token_id}: Level ${nft.level}, Weight ${nft.weight}, Mining: ${nft.is_mining ? '✅' : '❌'}`);
    });
    
    const totalWeight = userNFTs.reduce((sum, nft) => sum + (nft.weight || 0), 0);
    console.log(`\n总权重: ${totalWeight}`);
  } else {
    console.log('  未找到 NFT');
  }
  
  // 2. 检查 user_swap_stats 表
  console.log('\n📊 用户 Swap 统计:');
  const swapStats = db.prepare(`
    SELECT * FROM user_swap_stats WHERE user_address = ?
  `).get(userAddress.toLowerCase());
  
  if (swapStats) {
    console.log('  总交易:', swapStats.total_trades);
    console.log('  总交易量:', swapStats.total_volume_usdt, 'USDT');
    console.log('  总奖励:', swapStats.total_eagle_earned, 'EAGLE');
    console.log('  已领取:', swapStats.total_eagle_claimed, 'EAGLE');
    console.log('  待领取:', (swapStats.total_eagle_earned - swapStats.total_eagle_claimed).toFixed(6), 'EAGLE');
  } else {
    console.log('  未找到统计数据');
  }
  
  // 3. 检查 swap_transactions 表
  console.log('\n📊 最近的 Swap 交易:');
  const recentTxs = db.prepare(`
    SELECT tx_hash, trade_value_usdt, eagle_reward, created_at 
    FROM swap_transactions 
    WHERE user_address = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all(userAddress.toLowerCase());
  
  if (recentTxs.length > 0) {
    console.log(`找到 ${recentTxs.length} 笔交易:`);
    recentTxs.forEach(tx => {
      console.log(`  - ${tx.tx_hash.substring(0, 10)}...: $${tx.trade_value_usdt} → ${tx.eagle_reward} EAGLE`);
    });
  } else {
    console.log('  未找到交易记录');
  }
  
  // 4. 检查 NFT 加成日志表（如果存在）
  const hasNftBonusLog = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='swap_mining_nft_bonus_log'").get();
  
  if (hasNftBonusLog) {
    console.log('\n📊 NFT 加成日志:');
    const bonusLogs = db.prepare(`
      SELECT * FROM swap_mining_nft_bonus_log 
      WHERE user_address = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all(userAddress.toLowerCase());
    
    if (bonusLogs.length > 0) {
      console.log(`找到 ${bonusLogs.length} 条加成记录:`);
      bonusLogs.forEach(log => {
        console.log(`  - Base: ${log.base_reward}, NFT Boost: ${log.nft_boost_multiplier}x, Total: ${log.total_reward}`);
      });
    } else {
      console.log('  未找到加成记录');
    }
  } else {
    console.log('\n⚠️  swap_mining_nft_bonus_log 表不存在');
  }
  
  // 5. 计算 NFT Boost
  if (userNFTs.length > 0) {
    console.log('\n🧮 NFT Boost 计算:');
    const totalWeight = userNFTs.reduce((sum, nft) => sum + (nft.weight || 0), 0);
    
    // 根据代码逻辑，NFT boost = weight * 10
    const nftBoostMultiplier = totalWeight * 10;
    const nftBoostPercentage = nftBoostMultiplier * 100;
    
    console.log(`  总权重: ${totalWeight}`);
    console.log(`  NFT 倍数: ${nftBoostMultiplier}x`);
    console.log(`  NFT 加成: ${nftBoostPercentage}%`);
    console.log(`  显示问题: ${nftBoostPercentage.toFixed(2)}% (修正后)`);
  }
  
  db.close();
  console.log('\n✅ 检查完成');
  
} catch (error) {
  console.error('\n❌ 错误:', error.message);
  console.error(error);
  db.close();
  process.exit(1);
}
