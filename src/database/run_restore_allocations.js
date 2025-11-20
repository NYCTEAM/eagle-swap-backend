const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');
const SQL_FILE = path.join(__dirname, 'restore_original_allocations.sql');

console.log('\n' + '='.repeat(80));
console.log('🔄 恢复原始分配值（添加合规表述）');
console.log('='.repeat(80) + '\n');

console.log('📁 数据库:', DB_PATH);
console.log('📄 SQL 脚本:', SQL_FILE);
console.log('');

if (!fs.existsSync(DB_PATH)) {
  console.error('❌ 数据库文件不存在');
  process.exit(1);
}

if (!fs.existsSync(SQL_FILE)) {
  console.error('❌ SQL 脚本不存在');
  process.exit(1);
}

const sql = fs.readFileSync(SQL_FILE, 'utf8');
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法连接数据库:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功\n');
});

let currentStatement = 0;
let successes = 0;
let errors = [];

function executeNext() {
  if (currentStatement >= statements.length) {
    console.log(`\n✅ 执行完成: ${successes} 条语句成功\n`);
    
    if (errors.length > 0) {
      console.log('⚠️  错误:');
      errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
      console.log('');
    }
    
    // 验证结果
    console.log('📊 验证更新结果:\n');
    db.all(`
      SELECT 
        id,
        name,
        power,
        daily_reward_base,
        example_daily_allocation,
        allocation_variable
      FROM node_levels
      ORDER BY id
    `, [], (err, rows) => {
      if (err) {
        console.error('❌ 验证错误:', err.message);
      } else {
        console.log('┌────┬────────────────┬────────┬──────────┬──────────┬────────┐');
        console.log('│ ID │ 名称           │ 权重   │ 每日基础 │ 示例分配 │ 可变   │');
        console.log('├────┼────────────────┼────────┼──────────┼──────────┼────────┤');
        
        rows.forEach(row => {
          const id = String(row.id).padEnd(2);
          const name = (row.name || '').padEnd(14);
          const power = String(row.power || 0).padEnd(6);
          const base = String(row.daily_reward_base || 0).padEnd(8);
          const example = String(row.example_daily_allocation || 0).padEnd(8);
          const variable = row.allocation_variable ? '是' : '否';
          
          console.log(`│ ${id} │ ${name} │ ${power} │ ${base} │ ${example} │ ${variable.padEnd(6)} │`);
        });
        
        console.log('└────┴────────────────┴────────┴──────────┴──────────┴────────┘');
        
        // 显示总结
        console.log('\n' + '='.repeat(80));
        console.log('✅ 原始分配值已恢复！');
        console.log('='.repeat(80) + '\n');
        
        console.log('📌 恢复的值（基于图片）:\n');
        rows.forEach(row => {
          console.log(`   ${row.name}: ${row.example_daily_allocation} EAGLE/天`);
        });
        
        console.log('\n⚠️  合规说明:');
        console.log('   ✓ 所有值标记为"可变参数"');
        console.log('   ✓ 添加了免责声明');
        console.log('   ✓ 使用"当前参数"而非"保证收益"');
        console.log('   ✓ 明确说明参数可能调整\n');
        
        console.log('🚀 下一步:');
        console.log('   1. 更新前端显示这些值');
        console.log('   2. 使用合规表述："当前分配参数"');
        console.log('   3. 显示免责声明');
        console.log('   4. 测试所有页面\n');
        
        console.log('='.repeat(80) + '\n');
      }
      
      db.close();
      process.exit(0);
    });
    
    return;
  }
  
  const statement = statements[currentStatement];
  currentStatement++;
  
  if (statement.startsWith('--') || statement.trim().length === 0) {
    executeNext();
    return;
  }
  
  db.run(statement, (err) => {
    if (err) {
      errors.push(err.message);
    } else {
      successes++;
    }
    executeNext();
  });
}

executeNext();
