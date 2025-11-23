-- EAGLE SWAP 数据库表结构
-- SQLite 数据库

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    tx_hash TEXT UNIQUE,
    user_address TEXT,
    from_token TEXT,
    to_token TEXT,
    from_amount REAL,
    to_amount REAL,
    trade_value_usdt REAL,
    fee_usdt REAL,
    eagle_reward REAL,
    route_info TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
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

-- 推荐系统已移除 (Referral system removed)

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
('daily_mining_pool', '1095890', '每日挖矿奖励池（第1年）- 400M EAGLE / 365天'),
('max_daily_pool', '57345', '理论最大每日奖励池 - 13,900个NFT全部售出且在阶段1'),
('total_nft_supply', '13900', 'NFT总供应量'),
('eagle_price_usdt', '0.10', 'EAGLE 当前价格（USDT）');
