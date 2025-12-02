-- ============================================
-- SWAP Mining 和 NFT 加成系统数据库 Schema
-- 与服务器数据库保持一致
-- ============================================

-- 1. VIP 等级表 (基于交易量)
CREATE TABLE IF NOT EXISTS vip_levels (
    vip_level INTEGER PRIMARY KEY,
    vip_name TEXT NOT NULL,
    min_volume_usdt REAL NOT NULL,
    max_volume_usdt REAL,
    boost_percentage INTEGER NOT NULL,
    description TEXT
);

-- 插入 VIP 等级数据
INSERT OR REPLACE INTO vip_levels (vip_level, vip_name, min_volume_usdt, max_volume_usdt, boost_percentage, description)
VALUES 
    (0, 'Bronze', 0, 999.99, 100, 'Bronze VIP - 1.0x (100% base rate)'),
    (1, 'Silver', 1000, 9999.99, 120, 'Silver VIP - 1.2x (120% = +20% boost)'),
    (2, 'Gold', 10000, 99999.99, 150, 'Gold VIP - 1.5x (150% = +50% boost)'),
    (3, 'Platinum', 100000, NULL, 200, 'Platinum VIP - 2.0x (200% = +100% boost)');

-- 2. NFT 等级加成表 (固定倍数)
CREATE TABLE IF NOT EXISTS nft_level_bonus (
    nft_level INTEGER PRIMARY KEY,
    nft_tier_name TEXT NOT NULL,
    bonus_multiplier REAL NOT NULL,
    description TEXT
);

-- 插入 NFT 等级加成数据
INSERT OR REPLACE INTO nft_level_bonus (nft_level, nft_tier_name, bonus_multiplier, description)
VALUES 
    (0, 'None', 1.0, 'No NFT - 1.0x (100%)'),
    (1, 'Micro', 1.05, 'Micro Node ($10, Power 0.1) - 1.05x (105%)'),
    (2, 'Mini', 1.20, 'Mini Node ($25, Power 0.3) - 1.20x (120%)'),
    (3, 'Bronze', 1.35, 'Bronze Node ($50, Power 0.5) - 1.35x (135%)'),
    (4, 'Silver', 1.50, 'Silver Node ($100, Power 1.0) - 1.50x (150%)'),
    (5, 'Gold', 1.70, 'Gold Node ($250, Power 3.0) - 1.70x (170%)'),
    (6, 'Platinum', 1.85, 'Platinum Node ($500, Power 7.0) - 1.85x (185%)'),
    (7, 'Diamond', 2.50, 'Diamond Node ($1000, Power 15.0) - 2.50x (250%)');

-- 3. NFT 等级配置表
CREATE TABLE IF NOT EXISTS nft_levels (
    level INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    weight REAL NOT NULL,
    price_usdt REAL NOT NULL,
    price_eth REAL NOT NULL,
    supply INTEGER NOT NULL,
    minted INTEGER DEFAULT 0,
    available INTEGER GENERATED ALWAYS AS (supply - minted) STORED,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入 NFT 等级数据 (与合约一致)
INSERT OR REPLACE INTO nft_levels (level, name, weight, price_usdt, price_eth, supply, minted, description)
VALUES 
    (1, 'Micro Node', 0.1, 10, 0.01, 5000, 0, 'Entry-level NFT with basic mining power'),
    (2, 'Mini Node', 0.3, 25, 0.025, 3000, 0, 'Enhanced NFT with improved mining capabilities'),
    (3, 'Bronze Node', 0.5, 50, 0.05, 2000, 0, 'Bronze tier NFT with solid mining performance'),
    (4, 'Silver Node', 1.0, 100, 0.1, 1500, 0, 'Silver tier NFT with high mining efficiency'),
    (5, 'Gold Node', 3.0, 250, 0.25, 1100, 0, 'Gold tier NFT with premium mining power'),
    (6, 'Platinum Node', 7.0, 500, 0.5, 700, 0, 'Platinum tier NFT with elite mining capabilities'),
    (7, 'Diamond Node', 15.0, 1000, 1.0, 600, 0, 'Ultimate tier NFT with maximum mining power');

-- 4. NFT 库存表 (实时同步)
CREATE TABLE IF NOT EXISTS nft_inventory (
    level INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    weight REAL NOT NULL,
    price_usdt REAL NOT NULL,
    total_supply INTEGER NOT NULL,
    minted INTEGER DEFAULT 0,
    available INTEGER GENERATED ALWAYS AS (total_supply - minted) STORED,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入 NFT 库存数据
INSERT OR REPLACE INTO nft_inventory (level, name, weight, price_usdt, total_supply, minted)
VALUES 
    (1, 'Micro Node', 0.1, 10, 5000, 0),
    (2, 'Mini Node', 0.3, 25, 3000, 0),
    (3, 'Bronze Node', 0.5, 50, 2000, 0),
    (4, 'Silver Node', 1.0, 100, 1500, 0),
    (5, 'Gold Node', 3.0, 250, 1100, 0),
    (6, 'Platinum Node', 7.0, 500, 700, 0),
    (7, 'Diamond Node', 15.0, 1000, 600, 0);

-- 5. 用户 NFT 表
CREATE TABLE IF NOT EXISTS user_nfts (
    token_id INTEGER PRIMARY KEY,
    owner_address TEXT NOT NULL,
    level INTEGER NOT NULL,
    weight REAL NOT NULL,
    minted_at DATETIME,
    payment_method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_listed INTEGER DEFAULT 0,
    listing_price REAL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_user_nfts_owner ON user_nfts(owner_address);
CREATE INDEX IF NOT EXISTS idx_user_nfts_level ON user_nfts(level);

-- 6. Swap Mining 配置表
CREATE TABLE IF NOT EXISTS swap_mining_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    reward_rate REAL NOT NULL DEFAULT 0.0003,
    fee_rate REAL NOT NULL DEFAULT 0.0015,
    eagle_price_usdt REAL NOT NULL DEFAULT 0.1,
    enabled INTEGER DEFAULT 1,
    nft_bonus_enabled INTEGER DEFAULT 1,
    nft_bonus_multiplier REAL DEFAULT 10,
    vip_bonus_enabled INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
INSERT OR IGNORE INTO swap_mining_config (id, reward_rate, fee_rate, eagle_price_usdt, enabled, nft_bonus_enabled, nft_bonus_multiplier, vip_bonus_enabled)
VALUES (1, 0.0003, 0.0015, 0.1, 1, 1, 10, 1);

-- 7. Swap Mining NFT 加成日志
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
CREATE INDEX IF NOT EXISTS idx_nft_bonus_log_tx ON swap_mining_nft_bonus_log(tx_hash);

-- 8. 用户 Swap 统计表
CREATE TABLE IF NOT EXISTS user_swap_stats (
    user_address TEXT PRIMARY KEY,
    total_volume_usdt REAL DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    total_fees_usdt REAL DEFAULT 0,
    total_eagle_earned REAL DEFAULT 0,
    pending_eagle REAL DEFAULT 0,
    claimed_eagle REAL DEFAULT 0,
    vip_level INTEGER DEFAULT 0,
    last_trade_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. 每日 Swap 统计表
CREATE TABLE IF NOT EXISTS daily_swap_stats (
    stat_date DATE PRIMARY KEY,
    total_volume_usdt REAL DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    total_fees_usdt REAL DEFAULT 0,
    total_eagle_distributed REAL DEFAULT 0,
    unique_traders INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Swap Mining 奖励表
CREATE TABLE IF NOT EXISTS swap_mining_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    amount REAL NOT NULL,
    reward_type TEXT DEFAULT 'swap',
    tx_hash TEXT,
    claimed INTEGER DEFAULT 0,
    claimed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_swap_rewards_user ON swap_mining_rewards(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_rewards_claimed ON swap_mining_rewards(claimed);

-- 11. NFT 等级特权表
CREATE TABLE IF NOT EXISTS nft_tier_privileges (
    tier_id INTEGER PRIMARY KEY,
    tier_name TEXT NOT NULL,
    can_create_community INTEGER DEFAULT 0,
    vote_weight REAL DEFAULT 1,
    description TEXT
);

-- 插入 NFT 特权数据
INSERT OR REPLACE INTO nft_tier_privileges (tier_id, tier_name, can_create_community, vote_weight, description)
VALUES 
    (1, 'Micro Node', 0, 1, 'Cannot create community, standard vote weight'),
    (2, 'Mini Node', 0, 1, 'Cannot create community, standard vote weight'),
    (3, 'Bronze Node', 0, 1.5, 'Cannot create community, 1.5x vote weight'),
    (4, 'Silver Node', 0, 2, 'Cannot create community, 2x vote weight'),
    (5, 'Gold Node', 0, 3, 'Cannot create community, 3x vote weight'),
    (6, 'Platinum Node', 1, 5, 'Can create community directly, 5x vote weight'),
    (7, 'Diamond Node', 1, 10, 'Can create community directly, 10x vote weight');

-- 12. 更新 swap_transactions 表添加新字段
-- 注意: SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS
-- 所以这里用 PRAGMA 检查

-- 验证
SELECT '✅ Swap Mining 和 NFT 加成系统表创建完成' as status;
