-- 修复数据库表结构
-- 使其与合约完全对接

-- ============================================
-- 1. 修正 nodes 表
-- ============================================

-- 备份旧数据
CREATE TABLE IF NOT EXISTS nodes_backup AS SELECT * FROM nodes;

-- 删除旧表
DROP TABLE IF EXISTS nodes;

-- 创建新的 nodes 表（与合约完全对应）
CREATE TABLE nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER UNIQUE NOT NULL,
    owner_address TEXT NOT NULL,
    original_owner TEXT NOT NULL,         -- 对应合约 originalOwner
    level INTEGER NOT NULL,               -- 0-6 (枚举值: Micro=0, Mini=1, Bronze=2, Silver=3, Gold=4, Platinum=5, Diamond=6)
    level_name TEXT NOT NULL,             -- 'Micro', 'Mini', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'
    stage INTEGER NOT NULL,               -- 1-5 (对应合约 stage)
    purchase_price DECIMAL(10,2) NOT NULL, -- 对应合约 purchasePrice (USDT)
    base_power DECIMAL(10,2) NOT NULL,    -- 对应合约 basePower / 100
    stage_multiplier DECIMAL(10,2) NOT NULL, -- 对应合约 stageMultiplier / 100
    final_power DECIMAL(10,2) NOT NULL,   -- 对应合约 finalPower / 100
    mint_time DATETIME NOT NULL,          -- 对应合约 mintTime
    tx_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_nodes_owner ON nodes(owner_address);
CREATE INDEX idx_nodes_token ON nodes(token_id);
CREATE INDEX idx_nodes_level ON nodes(level);
CREATE INDEX idx_nodes_stage ON nodes(stage);

-- ============================================
-- 2. 修正挖矿奖励表（使用合约管理）
-- ============================================

-- 备份旧数据
CREATE TABLE IF NOT EXISTS node_mining_rewards_backup AS SELECT * FROM node_mining_rewards;

-- 删除旧表
DROP TABLE IF EXISTS node_mining_rewards;

-- 创建新的挖矿领取历史表
CREATE TABLE mining_claim_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    amount DECIMAL(20,6) NOT NULL,        -- 领取的 EAGLE 数量
    tx_hash TEXT NOT NULL,                -- 领取交易哈希
    claimed_at DATETIME NOT NULL,         -- 领取时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_mining_claim_user ON mining_claim_history(user_address);
CREATE INDEX idx_mining_claim_time ON mining_claim_history(claimed_at);
CREATE INDEX idx_mining_claim_hash ON mining_claim_history(tx_hash);

-- ============================================
-- 3. 添加用户算力缓存表（优化查询）
-- ============================================

CREATE TABLE IF NOT EXISTS user_power_cache (
    user_address TEXT PRIMARY KEY,
    total_power DECIMAL(10,2) NOT NULL,   -- 用户总算力
    nft_count INTEGER NOT NULL,           -- NFT 数量
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_power_cache_updated ON user_power_cache(updated_at);

-- ============================================
-- 4. 修正系统配置
-- ============================================

-- 删除错误的配置
DELETE FROM system_config WHERE key = 'daily_mining_pool';
DELETE FROM system_config WHERE key = 'node_mining_address';

-- 添加正确的配置
INSERT OR REPLACE INTO system_config (key, value, description) VALUES
('reward_per_power_per_day', '10', '每单位算力每日收益（EAGLE）'),
('mining_contract_address', '', 'NFT 挖矿合约地址'),
('mining_enabled', 'true', '挖矿是否启用'),
('total_network_power', '0', '全网总算力（定期更新）');

-- ============================================
-- 5. NFT 市场表（已存在，确认结构）
-- ============================================

-- nft_listings 表应该已存在
-- 确认结构正确

CREATE TABLE IF NOT EXISTS nft_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER UNIQUE NOT NULL,
    seller_address TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,         -- USDT
    is_active BOOLEAN DEFAULT 1,
    nft_level INTEGER NOT NULL,
    nft_stage INTEGER NOT NULL,
    base_power DECIMAL(10,2) NOT NULL,
    stage_multiplier DECIMAL(10,2) NOT NULL,
    final_power DECIMAL(10,2) NOT NULL,
    listed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_listings_seller ON nft_listings(seller_address);
CREATE INDEX IF NOT EXISTS idx_listings_active ON nft_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_listings_level ON nft_listings(nft_level);
CREATE INDEX IF NOT EXISTS idx_listings_price ON nft_listings(price);

-- ============================================
-- 6. NFT 交易历史表
-- ============================================

CREATE TABLE IF NOT EXISTS nft_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL,
    seller_address TEXT NOT NULL,
    buyer_address TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,         -- USDT
    marketplace_fee DECIMAL(10,2) NOT NULL, -- 2% 手续费
    nft_level INTEGER NOT NULL,
    nft_stage INTEGER NOT NULL,
    final_power DECIMAL(10,2) NOT NULL,
    tx_hash TEXT NOT NULL,
    sold_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_seller ON nft_sales(seller_address);
CREATE INDEX IF NOT EXISTS idx_sales_buyer ON nft_sales(buyer_address);
CREATE INDEX IF NOT EXISTS idx_sales_token ON nft_sales(token_id);
CREATE INDEX IF NOT EXISTS idx_sales_time ON nft_sales(sold_at);

-- ============================================
-- 完成
-- ============================================

-- 验证表结构
SELECT 'nodes 表结构:' as info;
PRAGMA table_info(nodes);

SELECT 'mining_claim_history 表结构:' as info;
PRAGMA table_info(mining_claim_history);

SELECT 'user_power_cache 表结构:' as info;
PRAGMA table_info(user_power_cache);

SELECT '系统配置:' as info;
SELECT * FROM system_config;
