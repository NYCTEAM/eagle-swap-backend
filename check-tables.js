const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/eagle-swap.db');

console.log('=== 检查数据库表 ===\n');

db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
  if (err) {
    console.error('查询表错误:', err);
    return;
  }
  
  console.log('数据库中的所有表:');
  tables.forEach((table, index) => {
    console.log(`${index + 1}. ${table.name}`);
  });
  
  console.log('\n总共:', tables.length, '个表');
  
  // 检查推荐相关的表
  console.log('\n=== 推荐相关的表 ===');
  const referralTables = tables.filter(t => t.name.toLowerCase().includes('referr'));
  if (referralTables.length > 0) {
    referralTables.forEach(t => console.log('✓', t.name));
  } else {
    console.log('❌ 没有找到推荐相关的表！');
  }
  
  db.close();
});
