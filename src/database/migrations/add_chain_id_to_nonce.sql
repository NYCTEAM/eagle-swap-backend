-- 为 user_claim_nonce 表添加 chain_id 字段，支持多链独立 nonce

-- 1. 创建新表结构
CREATE TABLE IF NOT EXISTS user_claim_nonce_new (
    user_address TEXT NOT NULL,
    chain_id INTEGER NOT NULL DEFAULT 196,
    nonce INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_address, chain_id)
);

-- 2. 迁移现有数据 (默认为 X Layer chain_id = 196)
INSERT INTO user_claim_nonce_new (user_address, chain_id, nonce, created_at, updated_at)
SELECT user_address, 196 as chain_id, nonce, created_at, updated_at
FROM user_claim_nonce;

-- 3. 删除旧表
DROP TABLE user_claim_nonce;

-- 4. 重命名新表
ALTER TABLE user_claim_nonce_new RENAME TO user_claim_nonce;

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_user_claim_nonce_address_chain ON user_claim_nonce(user_address, chain_id);

-- 6. 更新 schema_info
UPDATE schema_info 
SET description = 'User claim nonce for preventing replay attacks in SWAP mining rewards (multi-chain support)', 
    version = '2.0'
WHERE table_name = 'user_claim_nonce';
