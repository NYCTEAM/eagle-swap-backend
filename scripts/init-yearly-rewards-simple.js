const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');
const sqlPath = path.join(__dirname, '..', 'src', 'database', 'init_yearly_rewards.sql');

console.log('📊 初始化年度奖励递减配置...\n');
console.log('数据库路径:', dbPath);
console.log('SQL 文件路径:', sqlPath);
console.log('');

try {
  const db = new Database(dbPath);
  
  // 读取并执行 SQL
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  db.exec(sql);
  
  console.log('✅ 年度奖励配置表创建成功！\n');
  
  // 验证数据
  console.log('📈 年度奖励系数配置:');
  console.log('='.repeat(80));
  
  const multipliers = db.prepare(`
    SELECT year, multiplier, decay_rate, description 
    FROM yearly_reward_multipliers 
    ORDER BY year
  `).all();
  
  console.table(multipliers.map(m => ({
    '年份': `第${m.year}年`,
    '奖励系数': m.multiplier,
    '递减率': m.decay_rate ? `${(m.decay_rate * 100).toFixed(0)}%` : '-',
    '说明': m.description
  })));
  
  // 测试查询：Micro Node 各年度奖励
  console.log('\n💰 Micro Node 各年度奖励示例:');
  console.log('='.repeat(80));
  
  const microRewards = db.prepare(`
    SELECT year, daily_reward, yearly_reward, year_description
    FROM node_yearly_rewards 
    WHERE node_name = 'Micro Node'
    ORDER BY year
  `).all();
  
  console.table(microRewards.map(r => ({
    '年份': `第${r.year}年`,
    '日奖励': r.daily_reward.toFixed(4) + ' EAGLE',
    '年奖励': r.yearly_reward.toFixed(2) + ' EAGLE',
    '年收益': '$' + (r.yearly_reward * 0.1).toFixed(2),
    '说明': r.year_description
  })));
  
  // 计算10年总收益
  const total = db.prepare(`
    SELECT 
      node_name,
      price_usdt,
      SUM(yearly_reward) as total_reward,
      (SUM(yearly_reward) * 0.1) as total_usd,
      (SUM(yearly_reward) / price_usdt * 100) as roi
    FROM node_yearly_rewards 
    WHERE node_name = 'Micro Node'
    GROUP BY node_name, price_usdt
  `).get();
  
  console.log('\n📊 Micro Node 10年总收益:');
  console.log('='.repeat(80));
  console.log(`投资: $${total.price_usdt}`);
  console.log(`10年总奖励: ${total.total_reward.toFixed(2)} EAGLE`);
  console.log(`10年总收益: $${total.total_usd.toFixed(2)} (假设 EAGLE = $0.1)`);
  console.log(`10年 ROI: ${total.roi.toFixed(2)}%`);
  console.log(`年化 ROI: ${(total.roi / 10).toFixed(2)}%`);
  
  // 显示所有节点第1年奖励
  console.log('\n🏆 所有节点第1年奖励对比:');
  console.log('='.repeat(80));
  
  const year1Rewards = db.prepare(`
    SELECT node_name, price_usdt, daily_reward, yearly_reward
    FROM node_yearly_rewards 
    WHERE year = 1 
    ORDER BY node_level_id
  `).all();
  
  console.table(year1Rewards.map(r => ({
    '节点': r.node_name,
    '价格': '$' + r.price_usdt,
    '日奖励': r.daily_reward.toFixed(4) + ' EAGLE',
    '年奖励': r.yearly_reward.toFixed(2) + ' EAGLE',
    '年收益': '$' + (r.yearly_reward * 0.1).toFixed(2),
    'ROI': ((r.yearly_reward * 0.1 / r.price_usdt) * 100).toFixed(2) + '%'
  })));
  
  db.close();
  
  console.log('\n🎉 年度奖励递减系统初始化完成！');
  
} catch (error) {
  console.error('❌ 错误:', error.message);
  console.error(error);
  process.exit(1);
}
