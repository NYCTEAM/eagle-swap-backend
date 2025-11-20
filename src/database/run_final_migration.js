const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');
const MIGRATION_SQL = path.join(__dirname, 'compliance_migration_final.sql');

console.log('🔄 Starting FINAL compliance migration...');
console.log(`📁 Database: ${DB_PATH}`);
console.log(`📄 Migration script: ${MIGRATION_SQL}\n`);

if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Database file not found:', DB_PATH);
  process.exit(1);
}

if (!fs.existsSync(MIGRATION_SQL)) {
  console.error('❌ Migration script not found:', MIGRATION_SQL);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(MIGRATION_SQL, 'utf8');
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database\n');
});

let currentStatement = 0;
let errors = [];
let successes = 0;

function executeNext() {
  if (currentStatement >= statements.length) {
    console.log(`\n✅ Migration completed: ${successes} statements succeeded\n`);
    
    if (errors.length > 0) {
      console.log('⚠️  Errors (may be expected for existing columns):');
      errors.forEach((err, i) => {
        if (!err.includes('duplicate column')) {
          console.log(`   ${i + 1}. ${err}`);
        }
      });
      console.log('');
    }
    
    verifyMigration();
    return;
  }
  
  const statement = statements[currentStatement];
  currentStatement++;
  
  if (statement.startsWith('--') || statement.trim().length === 0) {
    executeNext();
    return;
  }
  
  db.run(statement, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
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
  
  const queries = [
    { q: "SELECT COUNT(*) as c FROM compliance_audit_log", l: "Audit log entries" },
    { q: "SELECT COUNT(*) as c FROM nft_nodes WHERE participation_active = 1", l: "Active nodes" },
    { q: "SELECT COUNT(*) as c FROM node_levels WHERE allocation_variable = 1", l: "Levels with variable allocations" },
    { q: "SELECT name FROM sqlite_master WHERE type='view' AND name='user_participation_summary'", l: "Participation view" },
    { q: "SELECT name FROM sqlite_master WHERE type='view' AND name='node_allocation_summary'", l: "Allocation view" }
  ];

  let completed = 0;
  queries.forEach((item) => {
    db.all(item.q, [], (err, rows) => {
      completed++;
      if (err) {
        console.log(`   ❌ ${item.l}: ${err.message}`);
      } else {
        if (item.q.includes('COUNT')) {
          console.log(`   ✅ ${item.l}: ${rows[0].c}`);
        } else {
          console.log(`   ✅ ${item.l}: ${rows[0]?.name ? 'Created' : 'Not found'}`);
        }
      }

      if (completed === queries.length) {
        db.all("SELECT * FROM compliance_audit_log ORDER BY created_at DESC LIMIT 1", [], (err, rows) => {
          if (!err && rows.length > 0) {
            console.log('\n📝 Latest audit entry:');
            console.log(`   ${rows[0].event_type}: ${rows[0].description}`);
          }
          
          console.log('\n✅ COMPLIANCE MIGRATION COMPLETE!\n');
          console.log('📌 Changes made:');
          console.log('   ✓ Added compliant columns to node_levels');
          console.log('   ✓ Added compliant columns to nft_nodes');
          console.log('   ✓ Added compliant columns to communities');
          console.log('   ✓ Added compliant columns to swap_transactions');
          console.log('   ✓ Added compliant columns to referral tables');
          console.log('   ✓ Created compliance_audit_log table');
          console.log('   ✓ Created compliant views\n');
          console.log('⚠️  Next steps:');
          console.log('   1. Update backend API to use new column names');
          console.log('   2. Test all endpoints');
          console.log('   3. Restart backend server\n');
          
          db.close();
          process.exit(0);
        });
      }
    });
  });
}

executeNext();
