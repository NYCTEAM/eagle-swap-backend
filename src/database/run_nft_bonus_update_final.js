const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');
const SQL_PATH = path.join(__dirname, 'update_nft_bonus_final.sql');

console.log('🔧 NFT Swap Mining 加成更新工具（最终版本）\n');
console.log('📂 数据库路径:', DB_PATH);
console.log('📄 SQL 脚本:', SQL_PATH);
console.log('─'.repeat(80));

// 检查文件
if (!fs.existsSync(DB_PATH)) {
  console.error('❌ 数据库文件不存在');
  process.exit(1);
}

if (!fs.existsSync(SQL_PATH)) {
  console.error('❌ SQL 脚本不存在');
  process.exit(1);
}

// 读取 SQL
const sql = fs.readFileSync(SQL_PATH, 'utf8');

// 打开数据库
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法打开数据库:', err.message);
    process.exit(1);
  }
  
  console.log('\n📋 更新前的配置:');
  console.log('─'.repeat(80));
  
  // 显示当前配置
  db.all('SELECT nft_level, nft_tier_name, bonus_percentage FROM nft_level_bonus ORDER BY nft_level', [], (err, rows) => {
    if (err) {
      console.error('❌ 查询失败:', err.message);
      db.close();
      return;
    }
    
    rows.forEach(row => {
      const pureBonus = row.bonus_percentage - 100;
      console.log(`${row.nft_tier_name.padEnd(15)} | ${row.bonus_percentage}% (${pureBonus >= 0 ? '+' : ''}${pureBonus}%)`);
    });
    
    console.log('\n🔄 执行更新...\n');
    
    // 执行更新
    db.exec(sql, (err) => {
      if (err) {
        console.error('❌ 更新失败:', err.message);
        db.close();
        return;
      }
      
      console.log('✅ 更新成功！\n');
      console.log('📋 更新后的配置:');
      console.log('─'.repeat(80));
      
      // 显示新配置
      db.all('SELECT nft_level, nft_tier_name, bonus_percentage FROM nft_level_bonus ORDER BY nft_level', [], (err, newRows) => {
        if (err) {
          console.error('❌ 查询失败:', err.message);
        } else {
          newRows.forEach(row => {
            const pureBonus = row.bonus_percentage - 100;
            console.log(`${row.nft_tier_name.padEnd(15)} | ${row.bonus_percentage}% (${pureBonus >= 0 ? '+' : ''}${pureBonus}%)`);
          });
          
          console.log('\n📈 最高组合加成:');
          console.log('─'.repeat(80));
          console.log('Diamond Tier (200%) + Diamond NFT (250%) = 450% 总加成 = 5.5x 总倍数');
          console.log('Platinum Tier (100%) + Diamond NFT (250%) = 350% 总加成 = 4.5x 总倍数');
          console.log('Diamond Tier (200%) + Platinum NFT (100%) = 300% 总加成 = 4.0x 总倍数');
          console.log('\n✅ 完成！请重启后端服务以应用更改。');
        }
        
        db.close();
      });
    });
  });
});
