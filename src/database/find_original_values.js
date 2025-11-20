const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');

console.log('\n' + '='.repeat(80));
console.log('🔍 查找原始 NFT 分配值');
console.log('='.repeat(80) + '\n');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法连接数据库:', err.message);
    process.exit(1);
  }
});

// 查找所有可能包含分配值的表和列
const queries = [
  {
    name: 'node_levels 表 - daily_reward_base',
    query: 'SELECT id, name, power, daily_reward_base, price_usdt FROM node_levels ORDER BY id'
  },
  {
    name: 'node_levels 表 - 所有列',
    query: 'PRAGMA table_info(node_levels)'
  },
  {
    name: 'yearly_rewards 表',
    query: 'SELECT * FROM yearly_rewards ORDER BY year, level_id LIMIT 10'
  },
  {
    name: 'node_level_stages 表',
    query: 'SELECT * FROM node_level_stages LIMIT 10'
  }
];

let completed = 0;

queries.forEach((item, index) => {
  db.all(item.query, [], (err, rows) => {
    completed++;
    
    console.log(`\n${index + 1}. ${item.name}`);
    console.log('-'.repeat(80));
    
    if (err) {
      console.log(`❌ 错误: ${err.message}`);
    } else if (rows.length === 0) {
      console.log('⚠️  无数据');
    } else {
      if (item.query.includes('PRAGMA')) {
        console.log('列名:');
        rows.forEach(col => {
          console.log(`   ${col.name} (${col.type})`);
        });
      } else {
        console.table(rows);
      }
    }
    
    if (completed === queries.length) {
      // 计算基于 Micro = 8 的所有等级值
      console.log('\n' + '='.repeat(80));
      console.log('📊 如果 Micro Node = 8 EAGLE/天，其他等级应该是：');
      console.log('='.repeat(80) + '\n');
      
      const microDaily = 8;
      const levels = [
        { name: 'Micro Node', power: 0.1, multiplier: 1 },
        { name: 'Mini Node', power: 0.3, multiplier: 3 },
        { name: 'Bronze Node', power: 0.5, multiplier: 5 },
        { name: 'Silver Node', power: 1, multiplier: 10 },
        { name: 'Gold Node', power: 3, multiplier: 30 },
        { name: 'Platinum Node', power: 7, multiplier: 70 },
        { name: 'Diamond Node', power: 15, multiplier: 150 }
      ];
      
      console.log('方案 A: 按权重比例计算');
      console.log('┌────────────────┬────────┬──────────┬──────────┬──────────┐');
      console.log('│ 等级           │ 权重   │ 每日     │ 每月     │ 每年     │');
      console.log('├────────────────┼────────┼──────────┼──────────┼──────────┤');
      
      levels.forEach(level => {
        const daily = (microDaily / 0.1) * level.power;
        const monthly = daily * 30;
        const yearly = daily * 365;
        
        console.log(
          `│ ${level.name.padEnd(14)} │ ${String(level.power).padEnd(6)} │ ` +
          `${String(daily.toFixed(1)).padEnd(8)} │ ${String(monthly.toFixed(0)).padEnd(8)} │ ` +
          `${String(yearly.toFixed(0)).padEnd(8)} │`
        );
      });
      console.log('└────────────────┴────────┴──────────┴──────────┴──────────┘');
      
      console.log('\n方案 B: 按倍数计算（如果 Micro = 8）');
      console.log('┌────────────────┬────────┬──────────┬──────────┬──────────┐');
      console.log('│ 等级           │ 倍数   │ 每日     │ 每月     │ 每年     │');
      console.log('├────────────────┼────────┼──────────┼──────────┼──────────┤');
      
      levels.forEach(level => {
        const daily = microDaily * level.multiplier;
        const monthly = daily * 30;
        const yearly = daily * 365;
        
        console.log(
          `│ ${level.name.padEnd(14)} │ ${String(level.multiplier + 'x').padEnd(6)} │ ` +
          `${String(daily.toFixed(0)).padEnd(8)} │ ${String(monthly.toFixed(0)).padEnd(8)} │ ` +
          `${String(yearly.toFixed(0)).padEnd(8)} │`
        );
      });
      console.log('└────────────────┴────────┴──────────┴──────────┴──────────┘');
      
      console.log('\n💡 提示：');
      console.log('   - 方案 A 更合理（基于权重比例）');
      console.log('   - Micro (0.1 权重) = 8 EAGLE/天');
      console.log('   - 意味着每权重 = 80 EAGLE/天');
      console.log('   - 这是一个相当高的分配率\n');
      
      console.log('🎯 推荐的合规固定值（基于原始 Micro = 8）：');
      console.log('┌────────────────┬──────────┬──────────────────────────┐');
      console.log('│ 等级           │ 每日分配 │ 合规表述                 │');
      console.log('├────────────────┼──────────┼──────────────────────────┤');
      levels.forEach(level => {
        const daily = (microDaily / 0.1) * level.power;
        console.log(
          `│ ${level.name.padEnd(14)} │ ${String(daily.toFixed(1)).padEnd(8)} │ ` +
          `"当前参数：${daily.toFixed(1)} EAGLE/天" │`
        );
      });
      console.log('└────────────────┴──────────┴──────────────────────────┘');
      
      console.log('\n⚠️  重要：添加免责声明');
      console.log('   "此参数可能根据网络条件和代币经济学调整"');
      console.log('   "不保证未来维持相同参数"\n');
      
      console.log('='.repeat(80) + '\n');
      
      db.close();
    }
  });
});
