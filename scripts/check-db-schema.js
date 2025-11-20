const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');
const db = new Database(dbPath);

console.log('='.repeat(80));
console.log('DATABASE SCHEMA');
console.log('='.repeat(80));

// List all tables
console.log('\n📚 ALL TABLES:');
const tables = db.prepare(`
  SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
`).all();

tables.forEach(table => {
  console.log(`\n\n📋 Table: ${table.name}`);
  console.log('-'.repeat(80));
  
  // Get table schema
  const schema = db.prepare(`PRAGMA table_info(${table.name})`).all();
  console.log('Columns:');
  schema.forEach(col => {
    console.log(`  - ${col.name} (${col.type})${col.pk ? ' PRIMARY KEY' : ''}${col.notnull ? ' NOT NULL' : ''}`);
  });
  
  // Get row count
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
  console.log(`\nTotal rows: ${count.count}`);
  
  // Show sample data if exists
  if (count.count > 0 && count.count <= 20) {
    console.log('\nSample data:');
    const data = db.prepare(`SELECT * FROM ${table.name} LIMIT 10`).all();
    console.table(data);
  }
});

db.close();
console.log('\n' + '='.repeat(80));
