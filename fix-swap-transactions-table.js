/**
 * Fix swap_transactions table schema
 * Add missing columns: from_token, to_token, from_amount, to_amount
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'eagle-swap.db');
const db = new Database(dbPath);

console.log('🔧 Fixing swap_transactions table schema...');

try {
  // Check if table exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='swap_transactions'
  `).get();

  if (!tableExists) {
    console.log('❌ Table swap_transactions does not exist. Creating...');
    
    // Create table with correct schema
    db.exec(`
      CREATE TABLE swap_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_hash TEXT UNIQUE NOT NULL,
        user_address TEXT NOT NULL,
        from_token TEXT NOT NULL,
        to_token TEXT NOT NULL,
        from_amount REAL NOT NULL,
        to_amount REAL NOT NULL,
        trade_value_usdt REAL NOT NULL,
        fee_usdt REAL NOT NULL,
        eagle_reward REAL NOT NULL,
        route_info TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_swap_tx_user ON swap_transactions(user_address);
      CREATE INDEX idx_swap_tx_timestamp ON swap_transactions(timestamp);
      CREATE INDEX idx_swap_tx_hash ON swap_transactions(tx_hash);
    `);
    
    console.log('✅ Table created successfully');
  } else {
    console.log('✅ Table exists. Checking columns...');
    
    // Get current columns
    const columns = db.prepare(`PRAGMA table_info(swap_transactions)`).all();
    const columnNames = columns.map(col => col.name);
    
    console.log('📋 Current columns:', columnNames);
    
    // Check if we need to migrate
    const needsMigration = !columnNames.includes('from_token') || 
                          !columnNames.includes('to_token') ||
                          !columnNames.includes('from_amount') ||
                          !columnNames.includes('to_amount');
    
    if (needsMigration) {
      console.log('🔄 Migrating table to new schema...');
      
      // Backup old data
      db.exec(`
        CREATE TABLE IF NOT EXISTS swap_transactions_backup AS 
        SELECT * FROM swap_transactions;
      `);
      
      console.log('✅ Backup created');
      
      // Drop old table
      db.exec(`DROP TABLE swap_transactions;`);
      
      // Create new table with correct schema
      db.exec(`
        CREATE TABLE swap_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tx_hash TEXT UNIQUE NOT NULL,
          user_address TEXT NOT NULL,
          from_token TEXT NOT NULL,
          to_token TEXT NOT NULL,
          from_amount REAL NOT NULL,
          to_amount REAL NOT NULL,
          trade_value_usdt REAL NOT NULL,
          fee_usdt REAL NOT NULL,
          eagle_reward REAL NOT NULL,
          route_info TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_swap_tx_user ON swap_transactions(user_address);
        CREATE INDEX idx_swap_tx_timestamp ON swap_transactions(timestamp);
        CREATE INDEX idx_swap_tx_hash ON swap_transactions(tx_hash);
      `);
      
      console.log('✅ New table created');
      
      // Try to migrate old data if possible
      try {
        const oldColumns = db.prepare(`PRAGMA table_info(swap_transactions_backup)`).all();
        const oldColumnNames = oldColumns.map(col => col.name);
        
        if (oldColumnNames.includes('tx_hash') && oldColumnNames.includes('user_address')) {
          db.exec(`
            INSERT INTO swap_transactions 
            (tx_hash, user_address, from_token, to_token, from_amount, to_amount, 
             trade_value_usdt, fee_usdt, eagle_reward, route_info, timestamp)
            SELECT 
              tx_hash, 
              user_address, 
              COALESCE(fromToken, from_token, ''), 
              COALESCE(toToken, to_token, ''),
              COALESCE(fromAmount, from_amount, 0),
              COALESCE(toAmount, to_amount, 0),
              COALESCE(trade_value_usdt, tradeValueUsdt, 0),
              COALESCE(fee_usdt, 0),
              COALESCE(eagle_reward, 0),
              COALESCE(route_info, routeInfo, ''),
              COALESCE(timestamp, created_at, CURRENT_TIMESTAMP)
            FROM swap_transactions_backup;
          `);
          
          console.log('✅ Old data migrated');
        }
      } catch (migrateError) {
        console.log('⚠️ Could not migrate old data:', migrateError.message);
      }
      
      console.log('✅ Migration complete');
    } else {
      console.log('✅ Table schema is correct');
    }
  }
  
  // Verify final schema
  const finalColumns = db.prepare(`PRAGMA table_info(swap_transactions)`).all();
  console.log('\n📋 Final schema:');
  finalColumns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  console.log('\n✅ All done!');
  
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
} finally {
  db.close();
}
