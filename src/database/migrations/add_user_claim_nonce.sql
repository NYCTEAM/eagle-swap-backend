-- 用户领取 nonce 表 (防重放攻击)
CREATE TABLE IF NOT EXISTS user_claim_nonce (
    user_address TEXT PRIMARY KEY,
    nonce INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_claim_nonce_address ON user_claim_nonce(user_address);

-- 插入说明注释
INSERT OR IGNORE INTO schema_info (table_name, description, version) 
VALUES ('user_claim_nonce', 'User claim nonce for preventing replay attacks in SWAP mining rewards', '1.0');
