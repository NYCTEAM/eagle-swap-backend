-- X Layer 价格快照表
CREATE TABLE IF NOT EXISTS price_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_pair TEXT NOT NULL,              -- 'XDOG/USDT'
  token0_address TEXT NOT NULL,
  token1_address TEXT NOT NULL,
  dex_name TEXT NOT NULL,                -- 'quickswap' or 'potato'
  price REAL NOT NULL,                   -- 当前价格
  reserve0 TEXT NOT NULL,                -- Token0 储备量
  reserve1 TEXT NOT NULL,                -- Token1 储备量
  timestamp INTEGER NOT NULL,
  chain_id INTEGER DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_snapshots_pair ON price_snapshots(token_pair, dex_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_time ON price_snapshots(timestamp);

-- K线数据表
CREATE TABLE IF NOT EXISTS candles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_pair TEXT NOT NULL,
  dex_name TEXT NOT NULL,
  timeframe TEXT NOT NULL,               -- '1m', '5m', '15m', '1h', '4h', '1d'
  open_price REAL NOT NULL,
  high_price REAL NOT NULL,
  low_price REAL NOT NULL,
  close_price REAL NOT NULL,
  volume REAL DEFAULT 0,
  timestamp INTEGER NOT NULL,            -- K线开始时间
  chain_id INTEGER DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_pair, dex_name, timeframe, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_candles_query ON candles(token_pair, dex_name, timeframe, timestamp);
CREATE INDEX IF NOT EXISTS idx_candles_time ON candles(timeframe, timestamp);

-- 代币对配置表
CREATE TABLE IF NOT EXISTS token_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_pair TEXT NOT NULL,
  token0_address TEXT NOT NULL,
  token1_address TEXT NOT NULL,
  token0_symbol TEXT NOT NULL,
  token1_symbol TEXT NOT NULL,
  dex_name TEXT NOT NULL,
  pair_address TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  chain_id INTEGER DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token0_address, token1_address, dex_name, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_token_pairs_active ON token_pairs(is_active, dex_name);
