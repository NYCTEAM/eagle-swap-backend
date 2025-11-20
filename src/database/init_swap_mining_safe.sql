-- ============================================
-- SWAP 挖矿系统安全初始化脚本
-- 包含 NFT 加成功能
-- ============================================

BEGIN TRANSACTION;

-- 1. 交易记录表
CREATE TABLE IF NOT EXISTS swap_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_hash TEXT UNIQUE NOT NULL,
    user_address TEXT NOT NULL,
    from_token TEXT NOT NULL,
    to_token TEXT NOT NULL,
    from_amount REAL NOT NULL,
    to_amount REAL NOT NULL,
    trade_value_usdt REAL NOT NULL,
    fee_usdt REAL NOT NULL,
    eagle_reward REAL NOT NULL,
    route_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_swap_tx_user ON swap_transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_tx_hash ON swap_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_swap_tx_date ON swap_transactions(created_at);

-- 2. 用户统计表
CREATE TABLE IF NOT EXISTS user_swap_stats (
    user_address TEXT PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    total_volume_usdt REAL DEFAULT 0,
    total_fee_paid REAL DEFAULT 0,
    total_eagle_earned REAL DEFAULT 0,
    total_eagle_claimed REAL DEFAULT 0,
    first_trade_at DATETIME,
    last_trade_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_stats_volume ON user_swap_stats(total_volume_usdt);
CREATE INDEX IF NOT EXISTS idx_user_stats_eagle ON user_swap_stats(total_eagle_earned);

-- 3. 每日统计表
CREATE TABLE IF NOT EXISTS daily_swap_stats (
    stat_date TEXT PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    total_volume_usdt REAL DEFAULT 0,
    total_fee_collected REAL DEFAULT 0,
    total_eagle_distributed REAL DEFAULT 0,
    unique_traders INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_swap_stats(stat_date);

-- 4. 奖励记录表
CREATE TABLE IF NOT EXISTS swap_mining_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    tx_id INTEGER NOT NULL,
    reward_date TEXT NOT NULL,
    eagle_earned REAL NOT NULL,
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tx_id) REFERENCES swap_transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_swap_rewards_user ON swap_mining_rewards(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_rewards_date ON swap_mining_rewards(reward_date);
CREATE INDEX IF NOT EXISTS idx_swap_rewards_claimed ON swap_mining_rewards(claimed);

-- 5. 配置表（包含 NFT 加成配置）
CREATE TABLE IF NOT EXISTS swap_mining_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    reward_rate REAL NOT NULL DEFAULT 0.0003,
    fee_rate REAL NOT NULL DEFAULT 0.001,
    eagle_price_usdt REAL NOT NULL DEFAULT 0.10,
    enabled BOOLEAN DEFAULT 1,
    nft_bonus_enabled BOOLEAN DEFAULT 1,
    nft_bonus_multiplier REAL DEFAULT 10.0,
    compliance_disclaimer TEXT DEFAULT '当前参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置（新的奖励率）
INSERT OR REPLACE INTO swap_mining_config (
    id, 
    reward_rate, 
    fee_rate, 
    eagle_price_usdt, 
    enabled,
    nft_bonus_enabled,
    nft_bonus_multiplier,
    compliance_disclaimer
) VALUES (
    1, 
    0.0003,  -- 新的基础奖励率（提高 10 倍）
    0.001,   -- 0.1% 平台手续费
    0.10,    -- EAGLE 价格参考
    1,       -- 启用
    1,       -- NFT 加成启用
    10.0,    -- 权重 × 10 = 加成%
    '当前参数：基础奖励率 0.0003 EAGLE/USDT，NFT 加成 = 权重 × 10%。此参数可能根据网络条件调整，不保证未来维持相同参数。'
);

-- 6. NFT 加成记录表（用于审计）
CREATE TABLE IF NOT EXISTS swap_mining_nft_bonus_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    base_reward REAL NOT NULL,
    nft_weight REAL NOT NULL,
    bonus_percent REAL NOT NULL,
    bonus_amount REAL NOT NULL,
    final_reward REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nft_bonus_log_user ON swap_mining_nft_bonus_log(user_address);
CREATE INDEX IF NOT EXISTS idx_nft_bonus_log_date ON swap_mining_nft_bonus_log(created_at);

-- 7. 创建视图：用户当前 NFT 总权重
CREATE VIEW IF NOT EXISTS user_nft_weight AS
SELECT 
    n.owner_address as user_address,
    COALESCE(SUM(nl.power), 0) as total_weight,
    COUNT(n.token_id) as nft_count,
    MAX(nl.power) as max_weight,
    datetime('now') as calculated_at
FROM nft_ownership n
LEFT JOIN node_levels nl ON n.level_id = nl.id
WHERE n.owner_address IS NOT NULL
GROUP BY n.owner_address;

COMMIT;

-- 验证安装
SELECT '✅ SWAP 挖矿表已创建' as status;

SELECT 
    'ℹ️  配置信息' as info,
    reward_rate as '基础奖励率',
    nft_bonus_enabled as 'NFT加成',
    nft_bonus_multiplier as '加成倍数'
FROM swap_mining_config 
WHERE id = 1;
