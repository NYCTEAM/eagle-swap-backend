const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 尝试定位数据库文件
const possiblePaths = [
  path.join(__dirname, '../database/eagle-swap.db'),
  path.join(__dirname, './database/eagle-swap.db'),
  path.join(process.cwd(), 'database/eagle-swap.db'),
  path.join(process.cwd(), 'src/database/eagle-swap.db')
];

let dbPath = '';
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  console.error('❌ Could not find database file in common locations.');
  console.log('Searched:', possiblePaths);
  process.exit(1);
}

console.log('✅ Found database at:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });

  // 1. 检查所有表
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name LIKE 'otc_%'
  `).all();

  console.log('\n📋 Found OTC Tables:', tables.map(t => t.name));

  // 2. 检查 otc_orders 表结构
  if (tables.some(t => t.name === 'otc_orders')) {
    const columns = db.prepare(`PRAGMA table_info(otc_orders)`).all();
    console.log('\n🏗️ otc_orders Table Structure:');
    columns.forEach(col => {
      console.log(`   - ${col.name.padEnd(20)} | ${col.type.padEnd(10)} | ${col.notnull ? 'NOT NULL' : 'NULL'}`);
    });
  } else {
    console.error('\n❌ Table otc_orders NOT FOUND! You need to run init-otc-db script.');
  }

  db.close();
} catch (error) {
  console.error('❌ Failed to check database:', error.message);
}
