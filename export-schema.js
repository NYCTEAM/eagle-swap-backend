const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const db = new sqlite3.Database('./data/eagle-swap.db');

console.log('📤 导出数据库 schema...\n');

db.all("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name", (err, rows) => {
  if (err) {
    console.error('❌ 错误:', err);
    process.exit(1);
  }
  
  let schema = '-- Eagle Swap Database Schema\n';
  schema += '-- Generated: ' + new Date().toISOString() + '\n\n';
  
  rows.forEach(row => {
    schema += row.sql + ';\n\n';
  });
  
  fs.writeFileSync('./data/full-schema.sql', schema);
  console.log('✅ Schema 已导出到: ./data/full-schema.sql');
  console.log(`✅ 总共 ${rows.length} 个表的定义`);
  
  db.close();
});
