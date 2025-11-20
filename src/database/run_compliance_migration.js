const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Database path
const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');
const MIGRATION_SQL = path.join(__dirname, 'compliance_migration_nft_terminology_sqlite.sql');

console.log('🔄 Starting compliance migration...');
console.log(`📁 Database: ${DB_PATH}`);
console.log(`📄 Migration script: ${MIGRATION_SQL}`);

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Database file not found:', DB_PATH);
  process.exit(1);
}

// Check if migration script exists
if (!fs.existsSync(MIGRATION_SQL)) {
  console.error('❌ Migration script not found:', MIGRATION_SQL);
  process.exit(1);
}

// Read migration SQL
const migrationSQL = fs.readFileSync(MIGRATION_SQL, 'utf8');

// Connect to database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Execute migration
console.log('\n🚀 Executing migration...\n');

db.exec(migrationSQL, (err) => {
  if (err) {
    console.error('❌ Migration failed:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('✅ Migration executed successfully!');
  
  // Verify migration by checking new tables
  console.log('\n📊 Verifying migration...\n');
  
  const verificationQueries = [
    "SELECT name FROM sqlite_master WHERE type='table' AND name='node_participation_allocations'",
    "SELECT name FROM sqlite_master WHERE type='table' AND name='participation_statistics'",
    "SELECT name FROM sqlite_master WHERE type='table' AND name='yearly_allocation_schedule'",
    "SELECT name FROM sqlite_master WHERE type='table' AND name='swap_participation_transactions'",
    "SELECT name FROM sqlite_master WHERE type='table' AND name='compliance_audit_log'",
    "SELECT COUNT(*) as count FROM user_nodes",
    "SELECT COUNT(*) as count FROM node_levels",
  ];

  let completed = 0;
  const results = [];

  verificationQueries.forEach((query, index) => {
    db.all(query, [], (err, rows) => {
      completed++;
      
      if (err) {
        results.push(`❌ Query ${index + 1} failed: ${err.message}`);
      } else {
        if (query.includes('COUNT')) {
          results.push(`✅ ${query.split('FROM')[1].trim()}: ${rows[0].count} records`);
        } else {
          results.push(`✅ Table exists: ${rows[0]?.name || 'Not found'}`);
        }
      }

      if (completed === verificationQueries.length) {
        console.log('\n📋 Verification Results:\n');
        results.forEach(result => console.log(result));
        
        // Check audit log
        db.all("SELECT * FROM compliance_audit_log ORDER BY created_at DESC LIMIT 1", [], (err, rows) => {
          if (!err && rows.length > 0) {
            console.log('\n📝 Latest audit log entry:');
            console.log(`   Event: ${rows[0].event_type}`);
            console.log(`   Description: ${rows[0].description}`);
            console.log(`   Time: ${rows[0].created_at}`);
          }
          
          console.log('\n✅ Compliance migration completed successfully!');
          console.log('\n⚠️  Next steps:');
          console.log('   1. Update backend API code to use new table/column names');
          console.log('   2. Test all API endpoints');
          console.log('   3. Restart backend server');
          console.log('   4. Test frontend functionality\n');
          
          db.close((err) => {
            if (err) {
              console.error('Error closing database:', err.message);
            }
            process.exit(0);
          });
        });
      }
    });
  });
});
