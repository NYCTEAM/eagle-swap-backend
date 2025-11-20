const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../eagle_swap.db');
const migrationPath = path.join(__dirname, '../migrations/create_user_level_system.sql');

console.log('初始化用户等级系统...');
console.log('数据库路径:', dbPath);
console.log('迁移文件:', migrationPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('无法打开数据库:', err);
    process.exit(1);
  }
  console.log('✓ 数据库连接成功');
});

// 读取 SQL 文件
const sql = fs.readFileSync(migrationPath, 'utf8');

// 分割 SQL 语句（按分号分割）
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`\n找到 ${statements.length} 条 SQL 语句\n`);

// 执行每条 SQL 语句
db.serialize(() => {
  statements.forEach((statement, index) => {
    db.run(statement, (err) => {
      if (err) {
        console.error(`✗ 语句 ${index + 1} 执行失败:`, err.message);
        console.error('SQL:', statement.substring(0, 100) + '...');
      } else {
        const action = statement.substring(0, 50).replace(/\s+/g, ' ');
        console.log(`✓ 语句 ${index + 1} 执行成功: ${action}...`);
      }
    });
  });
});

// 验证数据
db.all('SELECT * FROM user_levels ORDER BY level', (err, rows) => {
  if (err) {
    console.error('\n✗ 查询用户等级失败:', err);
  } else {
    console.log('\n✓ 用户等级系统初始化成功！');
    console.log('\n用户等级数据：');
    console.log('='.repeat(80));
    rows.forEach(row => {
      console.log(`Level ${row.level}: ${row.level_name.padEnd(10)} | NFT数量: ${row.min_nft_count} | 总权重: ${row.min_total_weight.toString().padEnd(5)} | 加成: ${row.boost_percentage}%`);
    });
    console.log('='.repeat(80));
  }
  
  db.close((err) => {
    if (err) {
      console.error('\n✗ 关闭数据库失败:', err);
    } else {
      console.log('\n✓ 数据库连接已关闭');
    }
  });
});
