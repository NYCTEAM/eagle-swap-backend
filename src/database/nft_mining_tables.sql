-- ============================================
-- NFT 持有挖矿相关表
-- ============================================

-- 用户领取记录
CREATE TABLE IF NOT EXISTS nft_mining_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL UNIQUE,
    last_claim_time DATETIME NOT NULL,
    total_claimed TEXT DEFAULT '0',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nft_mining_claims_address ON nft_mining_claims(user_address);

-- 领取历史
CREATE TABLE IF NOT EXISTS nft_mining_claim_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    nonce INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    base_reward TEXT,
    nft_bonus TEXT,
    vip_bonus TEXT,
    community_bonus TEXT,
    claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nft_mining_claim_history_address ON nft_mining_claim_history(user_address);
CREATE INDEX IF NOT EXISTS idx_nft_mining_claim_history_nonce ON nft_mining_claim_history(nonce);

-- 签名日志 (用于调试和审计)
CREATE TABLE IF NOT EXISTS nft_mining_signature_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    nonce INTEGER NOT NULL,
    deadline INTEGER NOT NULL,
    signature TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nft_mining_signature_log_address ON nft_mining_signature_log(user_address);

-- ============================================
-- 触发器：更新 updated_at
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_nft_mining_claims_timestamp
AFTER UPDATE ON nft_mining_claims
BEGIN
    UPDATE nft_mining_claims SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
