const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');

console.log('📊 检查 NFT Swap Mining 加成配置\n');
console.log('📂 数据库路径:', DB_PATH);
console.log('─'.repeat(80));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法打开数据库:', err.message);
    process.exit(1);
  }
});

// 查询 nft_level_bonus 表
db.all('SELECT * FROM nft_level_bonus ORDER BY nft_level', [], (err, rows) => {
  if (err) {
    console.error('❌ 查询失败:', err.message);
    console.log('\n⚠️  nft_level_bonus 表可能不存在');
    
    // 尝试查看所有表
    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err2, tables) => {
      if (!err2) {
        console.log('\n📋 数据库中的所有表:');
        tables.forEach(t => console.log('  -', t.name));
      }
      db.close();
    });
    return;
  }
  
  if (rows.length === 0) {
    console.log('\n⚠️  nft_level_bonus 表为空');
  } else {
    console.log('\n✅ 当前 NFT Swap Mining 加成配置:\n');
    console.log('原始数据:');
    console.log(JSON.stringify(rows, null, 2));
    console.log('\n');
    console.log('等级 | 加成百分比');
    console.log('─'.repeat(50));
    
    rows.forEach(row => {
      console.log(`${row.nft_level || '?'}    | ${row.bonus_percentage || row.multiplier || '?'}%`);
    });
    
    console.log('\n📈 与交易等级组合示例:');
    console.log('─'.repeat(50));
    const diamondNFT = rows.find(r => r.nft_level === 7);
    if (diamondNFT) {
      const bonus = diamondNFT.bonus_percentage || diamondNFT.multiplier || 0;
      const pureBonus = bonus - 100;
      console.log(`Diamond Tier (200%) + Diamond NFT (${pureBonus}%) = ${200 + pureBonus}% 总加成`);
      console.log(`Platinum Tier (100%) + Diamond NFT (${pureBonus}%) = ${100 + pureBonus}% 总加成`);
    }
  }
  
  db.close();
});
