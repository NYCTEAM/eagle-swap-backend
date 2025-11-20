const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');

console.log('🔍 Inspecting database structure...\n');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.message);
    process.exit(1);
  }
});

// Get all tables
db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
  if (err) {
    console.error('Error getting tables:', err.message);
    db.close();
    return;
  }

  console.log('📋 Tables in database:\n');
  tables.forEach(table => console.log(`   - ${table.name}`));
  
  console.log('\n📊 Table structures:\n');
  
  let completed = 0;
  tables.forEach(table => {
    db.all(`PRAGMA table_info(${table.name})`, [], (err, columns) => {
      completed++;
      
      if (err) {
        console.log(`❌ Error getting info for ${table.name}: ${err.message}`);
      } else {
        console.log(`\n🔹 ${table.name}:`);
        columns.forEach(col => {
          console.log(`   ${col.name} (${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''})`);
        });
      }
      
      if (completed === tables.length) {
        console.log('\n✅ Inspection complete\n');
        db.close();
      }
    });
  });
});
