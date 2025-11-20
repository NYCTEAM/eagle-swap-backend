const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');
const SQL_FILE = path.join(__dirname, 'set_actual_values.sql');

console.log('\n' + '='.repeat(80));
console.log('🔄 设置实际原始分配值（基于图片数据 + 合规表述）');
console.log('='.repeat(80) + '\n');

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
      power,
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

    console.log('┌────┬────────────────┬────────┬──────────┬──────────┬──────────┬────────┐');
    console.log('│ ID │ 等级           │ 权重   │ 每日分配 │ 每月分配 │ 每年分配 │ 可变   │');
    console.log('├────┼────────────────┼────────┼──────────┼──────────┼──────────┼────────┤');
    
    rows.forEach(row => {
      const monthly = (row.daily * 30).toFixed(1);
      const yearly = (row.daily * 365).toFixed(0);
      
      console.log(
        `│ ${String(row.id).padEnd(2)} │ ` +
        `${(row.name || '').padEnd(14)} │ ` +
        `${String(row.power).padEnd(6)} │ ` +
        `${String(row.daily).padEnd(8)} │ ` +
        `${monthly.padEnd(8)} │ ` +
        `${yearly.padEnd(8)} │ ` +
        `${(row.variable ? '是' : '否').padEnd(6)} │`
      );
    });
    
    console.log('└────┴────────────────┴────────┴──────────┴──────────┴──────────┴────────┘\n');

    console.log('='.repeat(80));
    console.log('✅ 实际原始分配值已设置！');
    console.log('='.repeat(80) + '\n');

    console.log('📌 设置的值（来自图片）:\n');
    rows.forEach(row => {
      const monthly = (row.daily * 30).toFixed(1);
      const yearly = (row.daily * 365).toFixed(0);
      console.log(`   ${row.name}:`);
      console.log(`      每日: ${row.daily} EAGLE`);
      console.log(`      每月: ~${monthly} EAGLE`);
      console.log(`      每年: ~${yearly} EAGLE\n`);
    });

    console.log('⚠️  合规说明:');
    console.log('   ✓ 所有值标记为"当前参数"（可变）');
    console.log('   ✓ 添加了免责声明');
    console.log('   ✓ 不承诺固定收益');
    console.log('   ✓ 明确说明参数可能调整\n');

    console.log('📋 前端显示建议:');
    console.log('   "当前分配参数：X.XX EAGLE/天"');
    console.log('   "此参数可能根据网络条件调整"');
    console.log('   "不保证未来维持相同参数"\n');

    console.log('🚀 下一步:');
    console.log('   1. 更新前端页面显示这些值');
    console.log('   2. 使用合规表述');
    console.log('   3. 显示免责声明');
    console.log('   4. 测试所有功能\n');

    console.log('='.repeat(80) + '\n');

    db.close();
  });
});
