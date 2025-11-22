const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/eagle-swap.db');

console.log('📊 本地数据库表格列表：\n');

db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
  if (err) {
    console.error('❌ 错误:', err);
    process.exit(1);
  }
  
  console.log(`总共 ${rows.length} 个表：\n`);
  rows.forEach((row, index) => {
    console.log(`${index + 1}. ${row.name}`);
  });
  
  db.close();
});
