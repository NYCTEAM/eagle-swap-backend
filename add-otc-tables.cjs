const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🚀 [OTC] Adding OTC tables to existing database...\n');

// 尝试定位数据库文件
const possibleDbPaths = [
  path.join(__dirname, 'src/database/eagle-swap.db'),
  path.join(__dirname, 'database/eagle-swap.db'),
  path.join(__dirname, 'dist/database/eagle-swap.db'),
  path.join(process.cwd(), 'src/database/eagle-swap.db'),
  path.join(process.cwd(), 'database/eagle-swap.db'),
  '/app/src/database/eagle-swap.db',
  '/app/database/eagle-swap.db'
];

let dbPath = '';
for (const p of possibleDbPaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  console.error('❌ [OTC] ERROR: Could not find database file!');
  console.log('Searched paths:', possibleDbPaths);
  process.exit(1);
}

console.log('✅ [OTC] Found database at:', dbPath);

try {
  const db = new Database(dbPath);
  
  // 1. 检查现有表
  console.log('\n📋 [OTC] Checking existing tables...');
  const allTables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table'
    ORDER BY name
  `).all();
  
  console.log('✅ [OTC] Found', allTables.length, 'tables in database');
  
  // 2. 检查 OTC 表是否已存在
  const otcTables = allTables.filter(t => t.name.startsWith('otc_'));
  
  if (otcTables.length > 0) {
    console.log('\n⚠️  [OTC] OTC tables already exist:', otcTables.map(t => t.name).join(', '));
    
    // 检查 otc_orders 表结构
    const hasOtcOrders = otcTables.some(t => t.name === 'otc_orders');
    if (hasOtcOrders) {
      const columns = db.prepare(`PRAGMA table_info(otc_orders)`).all();
      const hasSide = columns.some(c => c.name === 'side');
      const hasTokenSell = columns.some(c => c.name === 'token_sell');
      
      if (!hasSide || !hasTokenSell) {
        console.log('\n⚠️  [OTC] WARNING: otc_orders table has old schema!');
        console.log('   Current columns:', columns.map(c => c.name).join(', '));
        console.log('\n   You need to migrate the table. Options:');
        console.log('   1. Drop old table: DROP TABLE otc_orders;');
        console.log('   2. Then re-run this script to create new table');
      } else {
        console.log('\n✅ [OTC] otc_orders table schema is correct!');
        
        const count = db.prepare('SELECT COUNT(*) as count FROM otc_orders').get();
        console.log(`📊 [OTC] Current records: ${count.count}`);
      }
    }
    
  } else {
    console.log('\n⚠️  [OTC] No OTC tables found. Creating...');
    
    // 3. 只创建 OTC 相关表（不影响其他数据）
    console.log('\n⚙️  [OTC] Creating OTC tables...');
    
    // OTC 订单表
    db.exec(`
      CREATE TABLE IF NOT EXISTS otc_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id TEXT UNIQUE NOT NULL,
          maker_address TEXT NOT NULL,
          side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
          
          token_sell TEXT NOT NULL,
          token_buy TEXT NOT NULL,
          amount_sell REAL NOT NULL,
          amount_buy REAL NOT NULL,
          amount_remaining REAL NOT NULL,
          
          price_usdt REAL NOT NULL,
          
          status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'filled', 'partial', 'cancelled', 'expired')),
          
          created_at INTEGER NOT NULL,
          expiry_ts INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          
          network TEXT NOT NULL,
          chain_id INTEGER NOT NULL,
          tx_hash TEXT,
          contract_address TEXT,
          
          UNIQUE(order_id, network)
      );
    `);
    console.log('✅ [OTC] Created table: otc_orders');
    
    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_otc_orders_maker ON otc_orders(maker_address);
      CREATE INDEX IF NOT EXISTS idx_otc_orders_status ON otc_orders(status);
      CREATE INDEX IF NOT EXISTS idx_otc_orders_network ON otc_orders(network);
      CREATE INDEX IF NOT EXISTS idx_otc_orders_side ON otc_orders(side);
      CREATE INDEX IF NOT EXISTS idx_otc_orders_created ON otc_orders(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_otc_orders_price ON otc_orders(price_usdt);
    `);
    console.log('✅ [OTC] Created indexes for otc_orders');
    
    // OTC 成交记录表
    db.exec(`
      CREATE TABLE IF NOT EXISTS otc_fills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id TEXT NOT NULL,
          maker_address TEXT NOT NULL,
          taker_address TEXT NOT NULL,
          
          fill_amount REAL NOT NULL,
          fill_price_usdt REAL NOT NULL,
          gross_usdt REAL NOT NULL,
          fee_usdt REAL NOT NULL,
          net_to_maker REAL NOT NULL,
          
          side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
          
          filled_at INTEGER NOT NULL,
          
          network TEXT NOT NULL,
          chain_id INTEGER NOT NULL,
          tx_hash TEXT NOT NULL,
          block_number INTEGER,
          
          FOREIGN KEY (order_id) REFERENCES otc_orders(order_id)
      );
    `);
    console.log('✅ [OTC] Created table: otc_fills');
    
    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_otc_fills_order ON otc_fills(order_id);
      CREATE INDEX IF NOT EXISTS idx_otc_fills_maker ON otc_fills(maker_address);
      CREATE INDEX IF NOT EXISTS idx_otc_fills_taker ON otc_fills(taker_address);
      CREATE INDEX IF NOT EXISTS idx_otc_fills_time ON otc_fills(filled_at DESC);
      CREATE INDEX IF NOT EXISTS idx_otc_fills_network ON otc_fills(network);
      CREATE INDEX IF NOT EXISTS idx_otc_fills_tx ON otc_fills(tx_hash);
    `);
    console.log('✅ [OTC] Created indexes for otc_fills');
    
    // OTC 统计表
    db.exec(`
      CREATE TABLE IF NOT EXISTS otc_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          network TEXT NOT NULL,
          
          volume_24h REAL DEFAULT 0,
          trades_24h INTEGER DEFAULT 0,
          active_orders INTEGER DEFAULT 0,
          
          last_price REAL DEFAULT 0,
          price_change_24h REAL DEFAULT 0,
          
          updated_at INTEGER NOT NULL,
          
          UNIQUE(network)
      );
    `);
    console.log('✅ [OTC] Created table: otc_stats');
    
    // 插入初始统计数据
    db.exec(`
      INSERT OR IGNORE INTO otc_stats (network, volume_24h, trades_24h, active_orders, last_price, price_change_24h, updated_at)
      VALUES 
          ('X Layer', 0, 0, 0, 0, 0, strftime('%s', 'now')),
          ('Ethereum', 0, 0, 0, 0, 0, strftime('%s', 'now')),
          ('BSC', 0, 0, 0, 0, 0, strftime('%s', 'now'));
    `);
    console.log('✅ [OTC] Initialized stats data');
    
    // 用户统计表
    db.exec(`
      CREATE TABLE IF NOT EXISTS otc_user_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_address TEXT NOT NULL,
          network TEXT NOT NULL,
          
          orders_created INTEGER DEFAULT 0,
          orders_filled INTEGER DEFAULT 0,
          orders_cancelled INTEGER DEFAULT 0,
          volume_as_maker REAL DEFAULT 0,
          
          orders_taken INTEGER DEFAULT 0,
          volume_as_taker REAL DEFAULT 0,
          
          total_volume REAL DEFAULT 0,
          total_trades INTEGER DEFAULT 0,
          
          first_trade_at INTEGER,
          last_trade_at INTEGER,
          updated_at INTEGER NOT NULL,
          
          UNIQUE(user_address, network)
      );
    `);
    console.log('✅ [OTC] Created table: otc_user_stats');
    
    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_otc_user_stats_address ON otc_user_stats(user_address);
      CREATE INDEX IF NOT EXISTS idx_otc_user_stats_volume ON otc_user_stats(total_volume DESC);
      CREATE INDEX IF NOT EXISTS idx_otc_user_stats_trades ON otc_user_stats(total_trades DESC);
    `);
    console.log('✅ [OTC] Created indexes for otc_user_stats');
    
    console.log('\n🎉 [OTC] All OTC tables created successfully!');
  }
  
  db.close();
  console.log('\n✅ [OTC] Database operation completed!\n');
  
} catch (error) {
  console.error('\n❌ [OTC] ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
}
