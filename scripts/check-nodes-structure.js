const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

try {
  const db = new Database(dbPath);
  
  console.log('📊 Checking nodes table structure...\n');
  
  const columns = db.prepare("PRAGMA table_info(nodes)").all();
  console.log('Nodes table columns:');
  columns.forEach(c => {
    console.log(`- ${c.name} (${c.type})`);
  });
  
  console.log('\n📊 Sample nodes data:');
  const nodes = db.prepare('SELECT * FROM nodes LIMIT 5').all();
  console.log(nodes);
  
  db.close();
} catch (error) {
  console.error('Error:', error.message);
}
