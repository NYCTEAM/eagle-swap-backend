-- =====================================================
-- Solana Swap 交易历史表
-- Chain ID: 900 (Solana Mainnet)
-- =====================================================

-- Solana Swap 交易表
CREATE TABLE IF NOT EXISTS solana_swap_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signature TEXT NOT NULL UNIQUE,  -- Solana 交易签名 (类似 tx_hash)
  user_address TEXT NOT NULL,       -- 用户钱包地址 (Base58)
  token_in_mint TEXT NOT NULL,      -- 输入代币 Mint 地址
  token_out_mint TEXT NOT NULL,     -- 输出代币 Mint 地址
  token_in_symbol TEXT,             -- 输入代币符号 (SOL, USDC, etc.)
  token_out_symbol TEXT,            -- 输出代币符号
  amount_in TEXT NOT NULL,          -- 输入数量 (原始精度)
  amount_out TEXT NOT NULL,         -- 输出数量 (原始精度)
  amount_in_usd REAL,               -- 输入 USD 价值
  amount_out_usd REAL,              -- 输出 USD 价值
  dex_name TEXT NOT NULL,           -- DEX 名称 (Jupiter, Raydium, Orca, etc.)
  route_path TEXT,                  -- 路由路径 JSON (多跳路由)
  platform_fee TEXT NOT NULL,       -- 平台费用 (0.15%)
  platform_fee_usd REAL,            -- 平台费用 USD 价值
  slippage_bps INTEGER,             -- 滑点 (基点)
  price_impact_pct TEXT,            -- 价格影响百分比
  execution_price TEXT,             -- 执行价格
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  slot INTEGER,                     -- Solana slot number
  block_time INTEGER,               -- 区块时间戳
  error_message TEXT,               -- 失败时的错误信息
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Solana 用户交易统计表
CREATE TABLE IF NOT EXISTS solana_user_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL UNIQUE,
  total_swaps INTEGER NOT NULL DEFAULT 0,
  total_volume_usd REAL NOT NULL DEFAULT 0,
  total_fees_paid_usd REAL NOT NULL DEFAULT 0,
  first_swap_at DATETIME,
  last_swap_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Solana 代币交易对统计表
CREATE TABLE IF NOT EXISTS solana_token_pair_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_in_mint TEXT NOT NULL,
  token_out_mint TEXT NOT NULL,
  token_in_symbol TEXT,
  token_out_symbol TEXT,
  total_swaps INTEGER NOT NULL DEFAULT 0,
  total_volume_in TEXT NOT NULL DEFAULT '0',
  total_volume_out TEXT NOT NULL DEFAULT '0',
  total_volume_usd REAL NOT NULL DEFAULT 0,
  last_swap_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_in_mint, token_out_mint)
);

-- 平台费用收入统计表 (Solana)
CREATE TABLE IF NOT EXISTS solana_platform_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  total_fees_sol REAL NOT NULL DEFAULT 0,
  total_fees_usdc REAL NOT NULL DEFAULT 0,
  total_fees_usd REAL NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sol_swap_user ON solana_swap_transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_sol_swap_created_at ON solana_swap_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sol_swap_status ON solana_swap_transactions(status);
CREATE INDEX IF NOT EXISTS idx_sol_swap_signature ON solana_swap_transactions(signature);
CREATE INDEX IF NOT EXISTS idx_sol_swap_tokens ON solana_swap_transactions(token_in_mint, token_out_mint);

CREATE INDEX IF NOT EXISTS idx_sol_user_stats_address ON solana_user_stats(user_address);
CREATE INDEX IF NOT EXISTS idx_sol_token_pair ON solana_token_pair_stats(token_in_mint, token_out_mint);
CREATE INDEX IF NOT EXISTS idx_sol_fees_date ON solana_platform_fees(date);

-- =====================================================
-- 触发器: 自动更新 updated_at
-- =====================================================

CREATE TRIGGER IF NOT EXISTS update_solana_swap_timestamp 
AFTER UPDATE ON solana_swap_transactions
BEGIN
  UPDATE solana_swap_transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_solana_user_stats_timestamp 
AFTER UPDATE ON solana_user_stats
BEGIN
  UPDATE solana_user_stats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_solana_token_pair_stats_timestamp 
AFTER UPDATE ON solana_token_pair_stats
BEGIN
  UPDATE solana_token_pair_stats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
