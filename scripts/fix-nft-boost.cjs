const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../eagle_swap.db');
const db = new sqlite3.Database(dbPath);

console.log('修正 NFT 等级加成值...\n');

db.serialize(() => {
  // 更新加成值
  db.run("UPDATE nft_level_bonus SET bonus_percentage = 105 WHERE nft_level = 1");
  db.run("UPDATE nft_level_bonus SET bonus_percentage = 120 WHERE nft_level = 2");
  db.run("UPDATE nft_level_bonus SET bonus_percentage = 135 WHERE nft_level = 3");
  db.run("UPDATE nft_level_bonus SET bonus_percentage = 150 WHERE nft_level = 4");
  db.run("UPDATE nft_level_bonus SET bonus_percentage = 170 WHERE nft_level = 5");
  db.run("UPDATE nft_level_bonus SET bonus_percentage = 185 WHERE nft_level = 6");
  db.run("UPDATE nft_level_bonus SET bonus_percentage = 250 WHERE nft_level = 7");
  
  // 更新描述
  db.run("UPDATE nft_level_bonus SET description = 'NFT Level 1 - 105% boost multiplier' WHERE nft_level = 1");
  db.run("UPDATE nft_level_bonus SET description = 'NFT Level 2 - 120% boost multiplier' WHERE nft_level = 2");
  db.run("UPDATE nft_level_bonus SET description = 'NFT Level 3 - 135% boost multiplier' WHERE nft_level = 3");
  db.run("UPDATE nft_level_bonus SET description = 'NFT Level 4 - 150% boost multiplier' WHERE nft_level = 4");
  db.run("UPDATE nft_level_bonus SET description = 'NFT Level 5 - 170% boost multiplier' WHERE nft_level = 5");
  db.run("UPDATE nft_level_bonus SET description = 'NFT Level 6 - 185% boost multiplier' WHERE nft_level = 6");
  db.run("UPDATE nft_level_bonus SET description = 'NFT Level 7 - 250% boost multiplier' WHERE nft_level = 7", (err) => {
    if (err) {
      console.error('✗ 更新失败:', err);
      db.close();
      return;
    }
    
    console.log('✓ NFT 加成值更新成功\n');
    
    // 验证更新
    db.all('SELECT * FROM nft_level_bonus ORDER BY nft_level', (err, rows) => {
      if (err) {
        console.error('✗ 查询失败:', err);
      } else {
        console.log('='.repeat(80));
        console.log('NFT 等级加成（已更新）');
        console.log('='.repeat(80));
        console.log('Level | Tier      | Boost | Description');
        console.log('-'.repeat(80));
        rows.forEach(row => {
          console.log(`  ${row.nft_level}   | ${row.nft_tier_name.padEnd(9)} | ${row.bonus_percentage}%  | ${row.description}`);
        });
        console.log('='.repeat(80));
      }
      
      db.close(() => {
        console.log('\n✓ 数据库连接已关闭');
      });
    });
  });
});
