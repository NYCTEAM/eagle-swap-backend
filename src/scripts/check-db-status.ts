
import Database from 'better-sqlite3';
import * as path from 'path';

// 数据库路径
const dbPath = path.join(__dirname, '../database/eagle-swap.db');

console.log('Checking database at:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });

  // 1. 检查所有表
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name LIKE 'otc_%'
  `).all();

  console.log('\n📋 Found OTC Tables:', tables);

  // 2. 检查 otc_orders 表结构
  if (tables.some((t: any) => t.name === 'otc_orders')) {
    const columns = db.prepare(`PRAGMA table_info(otc_orders)`).all();
    console.log('\n🏗️ otc_orders Table Structure:');
    columns.forEach((col: any) => {
      console.log(`   - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PK' : ''}`);
    });
  } else {
    console.error('❌ Table otc_orders NOT FOUND!');
  }

  db.close();
} catch (error) {
  console.error('❌ Failed to check database:', error);
}
