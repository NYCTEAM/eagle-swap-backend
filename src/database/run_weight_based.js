const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');
const SQL_FILE = path.join(__dirname, 'set_weight_based_allocation.sql');

console.log('\n' + '='.repeat(80));
console.log('🔄 设置基于权重的分配系统');
console.log('='.repeat(80) + '\n');
console.log('📐 核心公式：每日分配 = 权重 × 2.72 EAGLE\n');

const sql = fs.readFileSync(SQL_FILE, 'utf8');
const db = new sqlite3.Database(DB_PATH);

db.exec(sql, (err) => {
  if (err) {
    console.error('❌ 错误:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('✅ 更新成功！\n');
  console.log('📊 验证结果:\n');

  db.all(`
    SELECT 
      id,
      name,
      power as weight,
      example_daily_allocation as daily,
      allocation_variable as variable
    FROM node_levels
    ORDER BY id
  `, [], (err, rows) => {
    if (err) {
      console.error('错误:', err.message);
      db.close();
      return;
    }

    console.log('┌────┬────────────────┬────────┬──────────┬────────────┬──────────┬──────────┐');
    console.log('│ ID │ 等级           │ 权重   │ 每日分配 │ 每权重分配 │ 每月     │ 每年     │');
    console.log('├────┼────────────────┼────────┼──────────┼────────────┼──────────┼──────────┤');
    
    rows.forEach(row => {
      const perWeight = row.weight > 0 ? (row.daily / row.weight).toFixed(2) : 0;
      const monthly = (row.daily * 30).toFixed(1);
      const yearly = (row.daily * 365).toFixed(0);
      
      console.log(
        `│ ${String(row.id).padEnd(2)} │ ` +
        `${(row.name || '').padEnd(14)} │ ` +
        `${String(row.weight).padEnd(6)} │ ` +
        `${String(row.daily.toFixed(2)).padEnd(8)} │ ` +
        `${String(perWeight).padEnd(10)} │ ` +
        `${monthly.padEnd(8)} │ ` +
        `${yearly.padEnd(8)} │`
      );
    });
    
    console.log('└────┴────────────────┴────────┴──────────┴────────────┴──────────┴──────────┘\n');

    // 验证每权重是否一致
    const perWeightValues = rows.map(r => r.weight > 0 ? (r.daily / r.weight).toFixed(2) : 0);
    const allSame = perWeightValues.every(v => v === perWeightValues[0]);

    if (allSame) {
      console.log('✅ 验证通过：所有等级的每权重分配一致 = ' + perWeightValues[0] + ' EAGLE/权重/天\n');
    } else {
      console.log('⚠️  警告：每权重分配不一致\n');
    }

    console.log('='.repeat(80));
    console.log('✅ 基于权重的分配系统已设置！');
    console.log('='.repeat(80) + '\n');

    console.log('📐 分配公式:\n');
    console.log('   每日分配 = 权重 × 2.72 EAGLE\n');

    console.log('📌 示例计算:\n');
    rows.slice(0, 3).forEach(row => {
      console.log(`   ${row.name}:`);
      console.log(`      权重: ${row.weight}`);
      console.log(`      计算: ${row.weight} × 2.72 = ${row.daily.toFixed(2)} EAGLE/天`);
      console.log(`      每月: ~${(row.daily * 30).toFixed(1)} EAGLE`);
      console.log(`      每年: ~${(row.daily * 365).toFixed(0)} EAGLE\n`);
    });

    console.log('⚠️  合规说明:');
    console.log('   ✓ 当前参数：每权重 2.72 EAGLE/天');
    console.log('   ✓ 此参数可能根据网络条件调整');
    console.log('   ✓ 不保证未来维持相同参数');
    console.log('   ✓ 早期和后期持有者完全公平\n');

    console.log('🎯 优势:');
    console.log('   ✓ 按权重比例分配，完全公平');
    console.log('   ✓ 避免早期参与者获得过多代币');
    console.log('   ✓ 简单透明，易于理解');
    console.log('   ✓ 符合合规要求\n');

    console.log('📋 前端显示建议:');
    console.log('   "当前分配参数：每权重 2.72 EAGLE/天"');
    console.log('   "您的 Diamond Node (15 权重) = 15 × 2.72 = 40.8 EAGLE/天"');
    console.log('   "此参数可能调整"\n');

    console.log('='.repeat(80) + '\n');

    db.close();
  });
});
