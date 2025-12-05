-- =====================================================
-- 同步服务数据库表 - 2024-12-05
-- 用于保存区块同步状态和历史记录
-- =====================================================

-- 1. OTC 同步状态表
CREATE TABLE IF NOT EXISTS otc_sync_state (
  key TEXT NOT NULL,
  network TEXT NOT NULL,
  value TEXT,
  updated_at INTEGER,
  PRIMARY KEY (key, network)
);

-- 2. Bridge 同步状态表
CREATE TABLE IF NOT EXISTS bridge_sync_state (
  chain TEXT PRIMARY KEY,
  last_block INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Marketplace 历史记录表
CREATE TABLE IF NOT EXISTS marketplace_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  seller_address TEXT,
  buyer_address TEXT,
  price TEXT,
  tx_hash TEXT,
  block_number INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketplace_history_chain ON marketplace_history(chain_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_history_token ON marketplace_history(token_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_history_seller ON marketplace_history(seller_address);
CREATE INDEX IF NOT EXISTS idx_marketplace_history_buyer ON marketplace_history(buyer_address);

-- 4. Marketplace 同步状态表
CREATE TABLE IF NOT EXISTS marketplace_sync_state (
  chain_id INTEGER PRIMARY KEY,
  last_block INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 验证表是否创建成功
-- =====================================================
-- SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
