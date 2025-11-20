-- Swap 交易历史表
CREATE TABLE IF NOT EXISTS swap_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT NOT NULL UNIQUE,
  user_address TEXT NOT NULL,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  amount_in TEXT NOT NULL,
  amount_out TEXT NOT NULL,
  dex_name TEXT NOT NULL, -- 'QuickSwap' or 'POTATO SWAP'
  platform_fee TEXT NOT NULL,
  execution_price TEXT NOT NULL,
  slippage TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  block_number INTEGER,
  timestamp INTEGER,
  chain_id INTEGER NOT NULL DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TWAP 订单表
CREATE TABLE IF NOT EXISTS twap_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE, -- 链上订单ID
  user_address TEXT NOT NULL,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  total_amount TEXT NOT NULL,
  amount_per_trade TEXT NOT NULL,
  total_trades INTEGER NOT NULL,
  executed_trades INTEGER NOT NULL DEFAULT 0,
  trade_interval INTEGER NOT NULL, -- 秒
  max_duration INTEGER NOT NULL, -- 秒
  order_type TEXT NOT NULL, -- 'market' or 'limit'
  min_amount_out TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'expired'
  created_tx_hash TEXT,
  created_at_timestamp INTEGER NOT NULL,
  last_execute_time INTEGER,
  chain_id INTEGER NOT NULL DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TWAP 执行历史表
CREATE TABLE IF NOT EXISTS twap_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  twap_order_id INTEGER NOT NULL,
  trade_number INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  amount_in TEXT NOT NULL,
  amount_out TEXT NOT NULL,
  executor_address TEXT NOT NULL,
  executor_reward TEXT NOT NULL,
  platform_fee TEXT NOT NULL,
  execution_price TEXT NOT NULL,
  timestamp INTEGER,
  block_number INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (twap_order_id) REFERENCES twap_orders(id)
);

-- Limit Order 订单表
CREATE TABLE IF NOT EXISTS limit_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE, -- 链上订单ID
  user_address TEXT NOT NULL,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  amount_in TEXT NOT NULL,
  min_amount_out TEXT NOT NULL,
  limit_price TEXT NOT NULL, -- 18位精度
  expiry_time INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'filled', 'cancelled', 'expired'
  created_tx_hash TEXT,
  filled_tx_hash TEXT,
  filled_amount_out TEXT,
  filled_at_timestamp INTEGER,
  executor_address TEXT,
  executor_reward TEXT,
  platform_fee TEXT,
  created_at_timestamp INTEGER NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户交易统计表
CREATE TABLE IF NOT EXISTS user_swap_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL UNIQUE,
  total_swaps INTEGER NOT NULL DEFAULT 0,
  total_volume_usd REAL NOT NULL DEFAULT 0,
  total_fees_paid_usd REAL NOT NULL DEFAULT 0,
  total_twap_orders INTEGER NOT NULL DEFAULT 0,
  total_limit_orders INTEGER NOT NULL DEFAULT 0,
  first_swap_at DATETIME,
  last_swap_at DATETIME,
  chain_id INTEGER NOT NULL DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 代币交易对统计表
CREATE TABLE IF NOT EXISTS token_pair_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  total_swaps INTEGER NOT NULL DEFAULT 0,
  total_volume_in TEXT NOT NULL DEFAULT '0',
  total_volume_out TEXT NOT NULL DEFAULT '0',
  total_volume_usd REAL NOT NULL DEFAULT 0,
  last_swap_at DATETIME,
  chain_id INTEGER NOT NULL DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_in, token_out, chain_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_swap_user ON swap_transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_created_at ON swap_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swap_status ON swap_transactions(status);

CREATE INDEX IF NOT EXISTS idx_twap_user ON twap_orders(user_address);
CREATE INDEX IF NOT EXISTS idx_twap_status ON twap_orders(status);
CREATE INDEX IF NOT EXISTS idx_twap_order_id ON twap_orders(order_id);

CREATE INDEX IF NOT EXISTS idx_twap_exec_order ON twap_executions(twap_order_id);
CREATE INDEX IF NOT EXISTS idx_twap_exec_created_at ON twap_executions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_limit_user ON limit_orders(user_address);
CREATE INDEX IF NOT EXISTS idx_limit_status ON limit_orders(status);
CREATE INDEX IF NOT EXISTS idx_limit_order_id ON limit_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_limit_expiry ON limit_orders(expiry_time);

CREATE INDEX IF NOT EXISTS idx_user_stats_address ON user_swap_stats(user_address);
CREATE INDEX IF NOT EXISTS idx_token_pair ON token_pair_stats(token_in, token_out);
