-- EAGLE SWAP 数据库表结构
-- SQLite 数据库

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT UNIQUE NOT NULL,
    referrer_id INTEGER,
    referral_code TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id)
);

-- 2. 节点表（缓存链上数据）
CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER UNIQUE NOT NULL,
    owner_address TEXT NOT NULL,
    level INTEGER NOT NULL,              -- 1-7 (Micro to Diamond)
    stage INTEGER NOT NULL,               -- 1-5 (阶段)
    difficulty_multiplier REAL NOT NULL,  -- 0.6-1.0
    power REAL NOT NULL,                  -- 算力
    mint_time DATETIME NOT NULL,
    tx_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 节点挖矿奖励表
CREATE TABLE IF NOT EXISTS node_mining_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL,
    owner_address TEXT NOT NULL,
    reward_date DATE NOT NULL,
    daily_pool REAL NOT NULL,             -- 当日奖励池
    node_power REAL NOT NULL,             -- 节点算力
    total_power REAL NOT NULL,            -- 全网算力
    difficulty_multiplier REAL NOT NULL,  -- 难度系数
    reward_amount REAL NOT NULL,          -- 奖励金额
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES nodes(token_id)
);

-- 4. SWAP 交易表
CREATE TABLE IF NOT EXISTS swap_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    token_in TEXT NOT NULL,
    token_out TEXT NOT NULL,
    amount_in REAL NOT NULL,
    amount_out REAL NOT NULL,
    fee_usdt REAL NOT NULL,               -- 0.1% 手续费
    tx_hash TEXT UNIQUE NOT NULL,
    block_number INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. SWAP 奖励表
CREATE TABLE IF NOT EXISTS swap_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    reward_date DATE NOT NULL,
    trading_volume_usdt REAL NOT NULL,    -- 交易量
    base_reward REAL NOT NULL,            -- 基础奖励
    node_multiplier REAL NOT NULL,        -- 节点加成 1.0-5.0
    final_reward REAL NOT NULL,           -- 最终奖励
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. 推荐关系表
CREATE TABLE IF NOT EXISTS referral_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_address TEXT NOT NULL,       -- 推荐人
    referee_address TEXT NOT NULL,        -- 被推荐人
    referral_code TEXT,                   -- 推荐码
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referee_address)
);

-- 7. 推荐奖励表
CREATE TABLE IF NOT EXISTS referral_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_address TEXT NOT NULL,
    referee_address TEXT NOT NULL,
    event_type TEXT NOT NULL,             -- 'node_purchase', 'swap_fee'
    amount_usdt REAL NOT NULL,            -- 事件金额
    commission_rate REAL NOT NULL,        -- 佣金比例 0.05-0.20
    reward_amount REAL NOT NULL,          -- 奖励金额
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. 流动性挖矿表
CREATE TABLE IF NOT EXISTS liquidity_mining (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    pool_address TEXT NOT NULL,
    lp_amount REAL NOT NULL,
    staked_at DATETIME NOT NULL,
    unstaked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. 流动性奖励表
CREATE TABLE IF NOT EXISTS liquidity_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    reward_date DATE NOT NULL,
    lp_amount REAL NOT NULL,
    reward_amount REAL NOT NULL,
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

CREATE INDEX IF NOT EXISTS idx_nodes_owner ON nodes(owner_address);
CREATE INDEX IF NOT EXISTS idx_nodes_token ON nodes(token_id);
CREATE INDEX IF NOT EXISTS idx_nodes_level ON nodes(level);

CREATE INDEX IF NOT EXISTS idx_mining_rewards_owner ON node_mining_rewards(owner_address);
CREATE INDEX IF NOT EXISTS idx_mining_rewards_token ON node_mining_rewards(token_id);
CREATE INDEX IF NOT EXISTS idx_mining_rewards_date ON node_mining_rewards(reward_date);
CREATE INDEX IF NOT EXISTS idx_mining_rewards_claimed ON node_mining_rewards(claimed);

CREATE INDEX IF NOT EXISTS idx_swap_transactions_user ON swap_transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_transactions_date ON swap_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_swap_transactions_hash ON swap_transactions(tx_hash);

CREATE INDEX IF NOT EXISTS idx_swap_rewards_user ON swap_rewards(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_rewards_date ON swap_rewards(reward_date);
CREATE INDEX IF NOT EXISTS idx_swap_rewards_claimed ON swap_rewards(claimed);

CREATE INDEX IF NOT EXISTS idx_referral_referrer ON referral_relationships(referrer_address);
CREATE INDEX IF NOT EXISTS idx_referral_referee ON referral_relationships(referee_address);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_address);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_claimed ON referral_rewards(claimed);

CREATE INDEX IF NOT EXISTS idx_liquidity_user ON liquidity_mining(user_address);
CREATE INDEX IF NOT EXISTS idx_liquidity_pool ON liquidity_mining(pool_address);

CREATE INDEX IF NOT EXISTS idx_liquidity_rewards_user ON liquidity_rewards(user_address);
CREATE INDEX IF NOT EXISTS idx_liquidity_rewards_date ON liquidity_rewards(reward_date);
CREATE INDEX IF NOT EXISTS idx_liquidity_rewards_claimed ON liquidity_rewards(claimed);

-- 插入初始系统配置
INSERT OR IGNORE INTO system_config (key, value, description) VALUES
('eagle_token_address', '', 'EAGLE 代币合约地址'),
('node_nft_address', '', '节点 NFT 合约地址'),
('node_mining_address', '', '节点挖矿合约地址'),
('last_synced_block', '0', '最后同步的区块号'),
('daily_mining_pool', '32877', '每日挖矿奖励池（第1年）'),
('eagle_price_usdt', '0.10', 'EAGLE 当前价格（USDT）');
