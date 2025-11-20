-- SWAP 交易挖矿数据库表
-- 记录用户交易和挖矿奖励

-- ============================================
-- 1. 用户表（如果不存在）
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT UNIQUE NOT NULL,
    referrer_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer_address);

-- ============================================
-- 2. SWAP 交易记录表
-- ============================================
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
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_address) REFERENCES users(wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_swap_tx_user ON swap_transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_tx_timestamp ON swap_transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_swap_tx_hash ON swap_transactions(tx_hash);

-- ============================================
-- 3. SWAP 挖矿奖励记录表
-- ============================================
CREATE TABLE IF NOT EXISTS swap_mining_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    reward_date DATE NOT NULL,
    total_trade_volume REAL NOT NULL,
    total_fee_paid REAL NOT NULL,
    eagle_earned REAL NOT NULL,
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_address) REFERENCES users(wallet_address),
    UNIQUE(user_address, reward_date)
);

CREATE INDEX IF NOT EXISTS idx_swap_rewards_user ON swap_mining_rewards(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_rewards_date ON swap_mining_rewards(reward_date);
CREATE INDEX IF NOT EXISTS idx_swap_rewards_claimed ON swap_mining_rewards(claimed);

-- ============================================
-- 4. 用户交易统计表
-- ============================================
CREATE TABLE IF NOT EXISTS user_swap_stats (
    user_address TEXT PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    total_volume_usdt REAL DEFAULT 0,
    total_fee_paid REAL DEFAULT 0,
    total_eagle_earned REAL DEFAULT 0,
    total_eagle_claimed REAL DEFAULT 0,
    first_trade_at DATETIME,
    last_trade_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_address) REFERENCES users(wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_user_stats_volume ON user_swap_stats(total_volume_usdt);
CREATE INDEX IF NOT EXISTS idx_user_stats_eagle ON user_swap_stats(total_eagle_earned);

-- ============================================
-- 5. 每日全平台统计表
-- ============================================
CREATE TABLE IF NOT EXISTS daily_swap_stats (
    stat_date DATE PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    total_volume_usdt REAL DEFAULT 0,
    total_fee_collected REAL DEFAULT 0,
    total_eagle_distributed REAL DEFAULT 0,
    unique_traders INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_swap_stats(stat_date);

-- ============================================
-- 6. SWAP 挖矿配置表
-- ============================================
CREATE TABLE IF NOT EXISTS swap_mining_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    reward_rate REAL NOT NULL DEFAULT 0.0003,
    fee_rate REAL NOT NULL DEFAULT 0.001,
    eagle_price_usdt REAL NOT NULL DEFAULT 0.10,
    enabled BOOLEAN DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
-- reward_rate: 0.00003 = 0.003 EAGLE per 100 USDT (0.003 / 100)
-- fee_rate: 0.001 = 0.1% platform fee
INSERT OR REPLACE INTO swap_mining_config (id, reward_rate, fee_rate, eagle_price_usdt, enabled) 
VALUES (1, 0.00003, 0.001, 0.10, 1);

-- ============================================
-- 7. 推荐奖励表（可选）
-- ============================================
CREATE TABLE IF NOT EXISTS referral_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_address TEXT NOT NULL,
    referee_address TEXT NOT NULL,
    reward_type TEXT NOT NULL,
    reward_amount REAL NOT NULL,
    source_tx_id INTEGER,
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_address) REFERENCES users(wallet_address),
    FOREIGN KEY (referee_address) REFERENCES users(wallet_address),
    FOREIGN KEY (source_tx_id) REFERENCES swap_transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_referral_referrer ON referral_rewards(referrer_address);
CREATE INDEX IF NOT EXISTS idx_referral_referee ON referral_rewards(referee_address);
CREATE INDEX IF NOT EXISTS idx_referral_claimed ON referral_rewards(claimed);

-- ============================================
-- 8. 用户等级表（基于累计交易量）
-- ============================================
CREATE TABLE IF NOT EXISTS user_tiers (
    tier_name TEXT PRIMARY KEY,
    tier_level INTEGER NOT NULL,
    min_volume_usdt REAL NOT NULL,
    multiplier REAL NOT NULL DEFAULT 1.0,
    icon TEXT,
    privilege_count INTEGER DEFAULT 3  -- 该等级有多少个特权（用于前端循环显示）
);

-- 插入等级基础数据（翻译在前端处理）
INSERT OR REPLACE INTO user_tiers (tier_name, tier_level, min_volume_usdt, multiplier, icon, privilege_count) VALUES
('Bronze', 1, 0, 1.0, '🥉', 3),
('Silver', 2, 10000, 1.2, '🥈', 4),
('Gold', 3, 50000, 1.5, '🥇', 4),
('Platinum', 4, 200000, 2.0, '💎', 5),
('Diamond', 5, 1000000, 3.0, '💠', 7);

-- ============================================
-- 9. 用户当前等级视图
-- ============================================
CREATE VIEW IF NOT EXISTS user_current_tier AS
SELECT 
    u.wallet_address,
    u.created_at,
    COALESCE(s.total_volume_usdt, 0) as total_volume,
    COALESCE(s.total_eagle_earned, 0) as total_eagle,
    CASE 
        WHEN COALESCE(s.total_volume_usdt, 0) >= 1000000 THEN 'Diamond'
        WHEN COALESCE(s.total_volume_usdt, 0) >= 200000 THEN 'Platinum'
        WHEN COALESCE(s.total_volume_usdt, 0) >= 50000 THEN 'Gold'
        WHEN COALESCE(s.total_volume_usdt, 0) >= 10000 THEN 'Silver'
        ELSE 'Bronze'
    END as tier_name,
    CASE 
        WHEN COALESCE(s.total_volume_usdt, 0) >= 1000000 THEN 3.0
        WHEN COALESCE(s.total_volume_usdt, 0) >= 200000 THEN 2.0
        WHEN COALESCE(s.total_volume_usdt, 0) >= 50000 THEN 1.5
        WHEN COALESCE(s.total_volume_usdt, 0) >= 10000 THEN 1.2
        ELSE 1.0
    END as multiplier
FROM users u
LEFT JOIN user_swap_stats s ON u.wallet_address = s.user_address;

-- ============================================
-- 10. 查询示例和验证
-- ============================================

-- 查询用户交易统计
-- SELECT * FROM user_swap_stats WHERE user_address = '0x...';

-- 查询用户当前等级
-- SELECT * FROM user_current_tier WHERE wallet_address = '0x...';

-- 查询每日统计
-- SELECT * FROM daily_swap_stats ORDER BY stat_date DESC LIMIT 30;

-- 查询待领取奖励
-- SELECT * FROM swap_mining_rewards WHERE user_address = '0x...' AND claimed = 0;

-- 查询推荐奖励
-- SELECT * FROM referral_rewards WHERE referrer_address = '0x...' AND claimed = 0;

-- ============================================
-- 完成
-- ============================================
