const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');

console.log('📊 查看 NFT 每日奖励配置\n');
console.log('📂 数据库:', DB_PATH);
console.log('─'.repeat(80));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法打开数据库:', err.message);
    process.exit(1);
  }
});

// 查询 node_levels 表
db.all('SELECT * FROM node_levels ORDER BY id', [], (err, rows) => {
  if (err) {
    console.error('❌ 查询失败:', err.message);
    db.close();
    return;
  }
  
  console.log('\n✅ NFT 等级配置:\n');
  console.log('等级 | 名称           | 权重  | 日产基础 | 供应量 | 每权重日产');
  console.log('─'.repeat(80));
  
  let totalDailyReward = 0;
  let totalWeight = 0;
  
  rows.forEach(row => {
    const perWeightReward = row.daily_reward_base / row.power;
    const tierTotalDaily = row.daily_reward_base * row.max_supply;
    const tierTotalWeight = row.power * row.max_supply;
    
    totalDailyReward += tierTotalDaily;
    totalWeight += tierTotalWeight;
    
    console.log(
      `${row.id}    | ${row.name.padEnd(14)} | ${row.power.toFixed(1).padStart(5)} | ` +
      `${row.daily_reward_base.toFixed(2).padStart(8)} | ${row.max_supply.toString().padStart(6)} | ` +
      `${perWeightReward.toFixed(4)}`
    );
  });
  
  console.log('─'.repeat(80));
  console.log(`总计 | 13,900 个 NFT  | ${totalWeight.toFixed(0).padStart(5)} | ${totalDailyReward.toFixed(2).padStart(8)} |`);
  
  console.log('\n📈 年度产出计算（假设全部铸造）:\n');
  console.log('─'.repeat(80));
  
  let cumulativeTotal = 0;
  for (let year = 1; year <= 15; year++) {
    const multiplier = Math.pow(0.9, year - 1);
    const yearlyReward = totalDailyReward * 365 * multiplier;
    cumulativeTotal += yearlyReward;
    
    const dailyAvg = yearlyReward / 365;
    const percentage = (multiplier * 100).toFixed(1);
    
    if (year <= 10) {
      console.log(
        `第 ${year.toString().padStart(2)} 年: ${yearlyReward.toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(15)} EAGLE ` +
        `(日均 ${dailyAvg.toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(6)}) - ${percentage}%`
      );
    }
  }
  
  console.log(`第 11-15 年: ${(400000000 - cumulativeTotal).toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(15)} EAGLE 剩余`);
  console.log('─'.repeat(80));
  console.log(`累计 10 年: ${cumulativeTotal.toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(15)} EAGLE`);
  console.log(`总分配池:   ${(400000000).toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(15)} EAGLE`);
  
  console.log('\n💡 单个 Diamond NFT 示例:');
  console.log('─'.repeat(80));
  const diamondNFT = rows.find(r => r.id === 7);
  if (diamondNFT) {
    console.log(`第 1 年日产: ${diamondNFT.daily_reward_base.toFixed(2)} EAGLE/天`);
    console.log(`第 1 年年产: ${(diamondNFT.daily_reward_base * 365).toFixed(2)} EAGLE/年`);
    console.log(`每权重日产: ${(diamondNFT.daily_reward_base / diamondNFT.power).toFixed(4)} EAGLE/权重/天`);
  }
  
  db.close();
});
