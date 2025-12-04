const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🔍 检查用户奖励数据\n');

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
  const userAddress = '0x4af7f86c70a6fba4ed9d49074d0805a3c63b1e5b';
  
  console.log('📊 用户地址:', userAddress);
  console.log('\n1️⃣ swap_transactions 表:');
  
  const transactions = db.prepare(`
    SELECT tx_hash, trade_value_usdt, eagle_reward, created_at 
    FROM swap_transactions 
    WHERE user_address = ? 
    ORDER BY created_at DESC
  `).all(userAddress.toLowerCase());
  
  if (transactions.length > 0) {
    console.log('找到', transactions.length, '笔交易:');
    let totalReward = 0;
    transactions.forEach(tx => {
      console.log('  -', tx.tx_hash.substring(0, 10) + '...:', 
                  '$' + tx.trade_value_usdt, '→', tx.eagle_reward, 'EAGLE');
      totalReward += tx.eagle_reward || 0;
    });
    console.log('\n总奖励:', totalReward.toFixed(6), 'EAGLE');
  } else {
    console.log('❌ 没有找到交易记录');
  }
  
  console.log('\n2️⃣ user_swap_stats 表:');
  const stats = db.prepare(`
    SELECT * FROM user_swap_stats WHERE user_address = ?
  `).get(userAddress.toLowerCase());
  
  if (stats) {
    console.log('总交易:', stats.total_trades);
    console.log('总交易量:', stats.total_volume_usdt, 'USDT');
    console.log('总奖励:', stats.total_eagle_earned, 'EAGLE');
    console.log('已领取:', stats.total_eagle_claimed, 'EAGLE');
    console.log('待领取:', (stats.total_eagle_earned - stats.total_eagle_claimed).toFixed(6), 'EAGLE');
  } else {
    console.log('❌ 没有找到统计数据');
  }
  
  console.log('\n3️⃣ 计算待领取奖励:');
  const earnedFromTx = db.prepare(`
    SELECT COALESCE(SUM(eagle_reward), 0) as total_earned
    FROM swap_transactions 
    WHERE user_address = ?
  `).get(userAddress.toLowerCase());
  
  const claimedFromStats = db.prepare(`
    SELECT COALESCE(total_eagle_claimed, 0) as total_claimed
    FROM user_swap_stats 
    WHERE user_address = ?
  `).get(userAddress.toLowerCase());
  
  const totalEarned = earnedFromTx.total_earned || 0;
  const totalClaimed = claimedFromStats.total_claimed || 0;
  const pending = totalEarned - totalClaimed;
  
  console.log('从交易表计算的总奖励:', totalEarned.toFixed(6), 'EAGLE');
  console.log('从统计表读取的已领取:', totalClaimed.toFixed(6), 'EAGLE');
  console.log('待领取奖励:', Math.max(0, pending).toFixed(6), 'EAGLE');
  
  if (pending <= 0) {
    console.log('\n⚠️  问题: 待领取奖励 <= 0');
    console.log('可能原因:');
    console.log('  1. swap_transactions 表中没有记录');
    console.log('  2. total_eagle_claimed 值不正确');
    console.log('  3. 交易记录还没有同步到数据库');
  }
  
  db.close();
  console.log('\n✅ 检查完成');
  
} catch (error) {
  console.error('\n❌ 错误:', error.message);
  console.error(error);
  db.close();
  process.exit(1);
}
