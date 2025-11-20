const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./eagle_swap.db')

console.log('🔧 Initializing chart data tables...\n')

// 创建价格快照表
db.run(`
  CREATE TABLE IF NOT EXISTS price_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_pair TEXT NOT NULL,
    token0_address TEXT NOT NULL,
    token1_address TEXT NOT NULL,
    dex_name TEXT NOT NULL,
    price REAL NOT NULL,
    reserve0 TEXT NOT NULL,
    reserve1 TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('❌ Failed to create price_snapshots table:', err)
  } else {
    console.log('✅ Created price_snapshots table')
  }
})

// 创建索引
db.run(`
  CREATE INDEX IF NOT EXISTS idx_price_snapshots_lookup 
  ON price_snapshots(token_pair, dex_name, timestamp)
`, (err) => {
  if (err) {
    console.error('❌ Failed to create index:', err)
  } else {
    console.log('✅ Created index on price_snapshots')
  }
})

// 创建 K 线表
db.run(`
  CREATE TABLE IF NOT EXISTS candles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_pair TEXT NOT NULL,
    dex_name TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    open_price REAL NOT NULL,
    high_price REAL NOT NULL,
    low_price REAL NOT NULL,
    close_price REAL NOT NULL,
    volume REAL DEFAULT 0,
    timestamp INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token_pair, dex_name, timeframe, timestamp)
  )
`, (err) => {
  if (err) {
    console.error('❌ Failed to create candles table:', err)
  } else {
    console.log('✅ Created candles table')
  }
})

// 创建索引
db.run(`
  CREATE INDEX IF NOT EXISTS idx_candles_lookup 
  ON candles(token_pair, dex_name, timeframe, timestamp)
`, (err) => {
  if (err) {
    console.error('❌ Failed to create index:', err)
  } else {
    console.log('✅ Created index on candles')
    
    // 完成后关闭数据库
    setTimeout(() => {
      console.log('\n✅ Database initialization complete!')
      db.close()
    }, 500)
  }
})
