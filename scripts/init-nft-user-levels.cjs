const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../eagle_swap.db');
const migrationPath = path.join(__dirname, '../migrations/create_nft_user_levels.sql');

console.log('初始化 NFT 用户等级系统...');
console.log('数据库路径:', dbPath);
console.log('迁移文件:', migrationPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('无法打开数据库:', err);
    process.exit(1);
  }
  console.log('✓ 数据库连接成功\n');
});

// 读取并执行 SQL
const sql = fs.readFileSync(migrationPath, 'utf8');

db.exec(sql, (err) => {
  if (err) {
    console.error('✗ SQL 执行失败:', err);
    db.close();
    process.exit(1);
  }
  
  console.log('✓ SQL 执行成功\n');
  
  // 验证数据
  db.all('SELECT * FROM nft_user_levels ORDER BY level', (err, rows) => {
    if (err) {
      console.error('✗ 查询失败:', err);
    } else {
      console.log('✓ NFT 用户等级系统初始化成功！');
      console.log('\n' + '='.repeat(90));
      console.log('NFT 用户等级数据：');
      console.log('='.repeat(90));
      console.log('Level | NFT Tier   | Tier ID | Boost | Description');
      console.log('-'.repeat(90));
      rows.forEach(row => {
        console.log(
          `  ${row.level}   | ${row.nft_tier_name.padEnd(10)} |    ${row.nft_tier_id}    | ${row.boost_percentage}%  | ${row.description}`
        );
      });
      console.log('='.repeat(90));
      console.log('\n说明：');
      console.log('- 用户等级 = 持有的最高等级 NFT');
      console.log('- 不叠加，只看最高等级');
      console.log('- Boost 百分比用于 Swap 挖矿奖励加成');
      console.log('- Level 1 (Micro): 105% → Level 7 (Diamond): 200%\n');
    }
    
    db.close((err) => {
      if (err) {
        console.error('✗ 关闭数据库失败:', err);
      } else {
        console.log('✓ 数据库连接已关闭');
      }
    });
  });
});
