-- ============================================
-- Swap Mining 数据库表创建脚本
-- 用于生产环境数据库迁移
-- ============================================

-- 1. 用户领取 nonce 表 (防重放攻击)
CREATE TABLE IF NOT EXISTS user_claim_nonce (
    user_address TEXT PRIMARY KEY,
    nonce INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_claim_nonce_address ON user_claim_nonce(user_address);

-- 2. 确保 user_swap_stats 表存在
CREATE TABLE IF NOT EXISTS user_swap_stats (
    user_address TEXT PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    total_volume_usdt REAL DEFAULT 0,
    total_fee_paid REAL DEFAULT 0,
    total_eagle_earned REAL DEFAULT 0,
    total_eagle_claimed REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_swap_stats_address ON user_swap_stats(user_address);
CREATE INDEX IF NOT EXISTS idx_user_swap_stats_volume ON user_swap_stats(total_volume_usdt);

-- 3. 确保 swap_transactions 表存在
CREATE TABLE IF NOT EXISTS swap_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_hash TEXT UNIQUE NOT NULL,
    user_address TEXT NOT NULL,
    from_token TEXT NOT NULL,
    to_token TEXT NOT NULL,
    from_amount TEXT,
    to_amount TEXT,
    trade_value_usdt REAL DEFAULT 0,
    eagle_reward REAL DEFAULT 0,
    chain_id INTEGER NOT NULL,
    route_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_swap_tx_user ON swap_transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_tx_hash ON swap_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_swap_tx_chain ON swap_transactions(chain_id);
CREATE INDEX IF NOT EXISTS idx_swap_tx_created ON swap_transactions(created_at);

-- 验证表创建
SELECT 'Tables created successfully' as status;
