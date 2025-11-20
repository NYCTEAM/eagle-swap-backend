const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Database path
const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');
const MIGRATION_SQL = path.join(__dirname, 'compliance_migration_adaptive.sql');

console.log('🔄 Starting adaptive compliance migration...');
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

// Split SQL into individual statements (SQLite exec doesn't handle some complex statements well)
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

// Connect to database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Execute migration statements one by one
console.log('\n🚀 Executing migration statements...\n');

let currentStatement = 0;
let errors = [];
let successes = 0;

function executeNext() {
  if (currentStatement >= statements.length) {
    // All done
    console.log(`\n✅ Migration completed: ${successes} statements succeeded, ${errors.length} errors\n`);
    
    if (errors.length > 0) {
      console.log('⚠️  Errors encountered (may be expected for columns that already exist):');
      errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
      console.log('');
    }
    
    // Verify migration
    verifyMigration();
    return;
  }
  
  const statement = statements[currentStatement];
  currentStatement++;
  
  // Skip comments and empty statements
  if (statement.startsWith('--') || statement.trim().length === 0) {
    executeNext();
    return;
  }
  
  db.run(statement, (err) => {
    if (err) {
      // Some errors are expected (e.g., column already exists)
      if (err.message.includes('duplicate column name') || 
          err.message.includes('already exists')) {
        // Expected error, continue
        successes++;
      } else {
        errors.push(err.message);
      }
    } else {
      successes++;
    }
    executeNext();
  });
}

function verifyMigration() {
  console.log('📊 Verifying migration...\n');
  
  const verificationQueries = [
    {
      query: "SELECT COUNT(*) as count FROM compliance_audit_log",
      label: "Compliance audit log entries"
    },
    {
      query: "SELECT COUNT(*) as count FROM user_nodes WHERE participation_active = 1",
      label: "Active participation nodes"
    },
    {
      query: "SELECT COUNT(*) as count FROM node_levels WHERE allocation_variable = 1",
      label: "Node levels with variable allocations"
    },
    {
      query: "SELECT name FROM sqlite_master WHERE type='view' AND name='user_participation_summary'",
      label: "User participation summary view"
    },
    {
      query: "SELECT name FROM sqlite_master WHERE type='view' AND name='node_allocation_summary'",
      label: "Node allocation summary view"
    }
  ];

  let completed = 0;
  const results = [];

  verificationQueries.forEach((item) => {
    db.all(item.query, [], (err, rows) => {
      completed++;
      
      if (err) {
        results.push(`❌ ${item.label}: ${err.message}`);
      } else {
        if (item.query.includes('COUNT')) {
          results.push(`✅ ${item.label}: ${rows[0].count}`);
        } else {
          results.push(`✅ ${item.label}: ${rows[0]?.name ? 'Created' : 'Not found'}`);
        }
      }

      if (completed === verificationQueries.length) {
        console.log('📋 Verification Results:\n');
        results.forEach(result => console.log(`   ${result}`));
        
        // Check latest audit log entry
        db.all("SELECT * FROM compliance_audit_log ORDER BY created_at DESC LIMIT 1", [], (err, rows) => {
          if (!err && rows.length > 0) {
            console.log('\n📝 Latest audit log entry:');
            console.log(`   Event: ${rows[0].event_type}`);
            console.log(`   Description: ${rows[0].description}`);
            console.log(`   Time: ${rows[0].created_at}`);
          }
          
          console.log('\n✅ Adaptive compliance migration completed!');
          console.log('\n📌 What was done:');
          console.log('   ✓ Added compliant terminology columns to existing tables');
          console.log('   ✓ Preserved original columns for backward compatibility');
          console.log('   ✓ Created compliance audit log');
          console.log('   ✓ Created views with compliant terminology');
          console.log('\n⚠️  Next steps:');
          console.log('   1. Update backend API code to use new column names');
          console.log('   2. Test all API endpoints');
          console.log('   3. Gradually phase out old column names');
          console.log('   4. Restart backend server');
          console.log('   5. Test frontend functionality\n');
          
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
}

// Start execution
executeNext();
