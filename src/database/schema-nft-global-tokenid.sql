-- NFT 全局 Token ID 管理系统
-- 用于跨链共享 Token ID (1-13900)

-- 全局 Token ID 分配表
CREATE TABLE IF NOT EXISTS nft_global_token_allocation (
  global_token_id INTEGER PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  chain_name TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  owner_address TEXT,
  level INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved', -- reserved, minted, failed (立即清理)
  reserved_at INTEGER NOT NULL,
  minted_at INTEGER,
  tx_hash TEXT,
  signature TEXT,
  deadline INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_global_token_status ON nft_global_token_allocation(status);
CREATE INDEX IF NOT EXISTS idx_global_token_chain ON nft_global_token_allocation(chain_id);
CREATE INDEX IF NOT EXISTS idx_global_token_owner ON nft_global_token_allocation(owner_address);
CREATE INDEX IF NOT EXISTS idx_global_token_level ON nft_global_token_allocation(level);
CREATE INDEX IF NOT EXISTS idx_global_token_reserved ON nft_global_token_allocation(reserved_at);

-- NFT 持有者表（跨链）
CREATE TABLE IF NOT EXISTS nft_holders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  global_token_id INTEGER NOT NULL,
  chain_id INTEGER NOT NULL,
  chain_name TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  level INTEGER NOT NULL,
  weight INTEGER NOT NULL,
  effective_weight INTEGER NOT NULL,
  stage INTEGER NOT NULL,
  minted_at INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(global_token_id, chain_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_holders_owner ON nft_holders(owner_address);
CREATE INDEX IF NOT EXISTS idx_holders_chain ON nft_holders(chain_id);
CREATE INDEX IF NOT EXISTS idx_holders_level ON nft_holders(level);
CREATE INDEX IF NOT EXISTS idx_holders_global_token ON nft_holders(global_token_id);

-- 全局统计表
CREATE TABLE IF NOT EXISTS nft_global_stats (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- 单行表
  total_minted INTEGER NOT NULL DEFAULT 0,
  total_reserved INTEGER NOT NULL DEFAULT 0,
  current_stage INTEGER NOT NULL DEFAULT 1,
  stage_efficiency INTEGER NOT NULL DEFAULT 100,
  last_token_id INTEGER NOT NULL DEFAULT 0,
  xlayer_minted INTEGER NOT NULL DEFAULT 0,
  bsc_minted INTEGER NOT NULL DEFAULT 0,
  solana_minted INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化统计表
INSERT OR IGNORE INTO nft_global_stats (id, total_minted, total_reserved, current_stage, stage_efficiency, last_token_id)
VALUES (1, 0, 0, 1, 100, 0);

-- 等级统计表（每个等级的铸造情况）
CREATE TABLE IF NOT EXISTS nft_level_stats (
  level INTEGER PRIMARY KEY,
  level_name TEXT NOT NULL,
  total_supply INTEGER NOT NULL,
  minted INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL,
  weight INTEGER NOT NULL,
  price_usdt INTEGER NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化等级统计
INSERT OR IGNORE INTO nft_level_stats (level, level_name, total_supply, minted, available, weight, price_usdt) VALUES
(1, 'Micro Node', 5000, 0, 5000, 1, 10000000),
(2, 'Mini Node', 3000, 0, 3000, 3, 25000000),
(3, 'Bronze Node', 2000, 0, 2000, 5, 50000000),
(4, 'Silver Node', 1500, 0, 1500, 10, 100000000),
(5, 'Gold Node', 1100, 0, 1100, 30, 250000000),
(6, 'Platinum Node', 700, 0, 700, 70, 500000000),
(7, 'Diamond Node', 600, 0, 600, 150, 1000000000);

-- Token ID 预留记录（防止并发问题）
CREATE TABLE IF NOT EXISTS nft_token_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  global_token_id INTEGER NOT NULL,
  user_address TEXT NOT NULL,
  level INTEGER NOT NULL,
  chain_id INTEGER NOT NULL,
  reserved_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, used, expired, failed (立即清理)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(global_token_id)
);

CREATE INDEX IF NOT EXISTS idx_reservations_user ON nft_token_reservations(user_address);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON nft_token_reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON nft_token_reservations(expires_at);
