-- ============================================
-- Eagle Swap 完整数据库初始化脚本
-- 包含所有 NFT Mining 和 Swap Mining 相关表格
-- ============================================

BEGIN TRANSACTION;

-- ============================================
-- 1. 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);

-- ============================================
-- 2. NFT 节点等级配置表
-- ============================================
CREATE TABLE IF NOT EXISTS node_levels (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    price_usdt REAL NOT NULL,
    power REAL NOT NULL,
    max_supply INTEGER NOT NULL,
    minted INTEGER DEFAULT 0,
    daily_reward_base REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入 7 个节点等级数据
INSERT OR REPLACE INTO node_levels (id, name, emoji, price_usdt, power, max_supply, minted, daily_reward_base) VALUES
(1, 'Micro Node', '🪙', 10, 0.1, 5000, 0, 0.27),
(2, 'Mini Node', '⚪', 25, 0.3, 3000, 0, 0.82),
(3, 'Bronze Node', '🥉', 50, 0.5, 2000, 0, 1.36),
(4, 'Silver Node', '🥈', 100, 1.0, 1500, 0, 2.72),
(5, 'Gold Node', '🥇', 250, 3.0, 1100, 0, 8.15),
(6, 'Platinum Node', '💎', 500, 7.0, 700, 0, 19.02),
(7, 'Diamond Node', '💠', 1000, 15.0, 600, 0, 40.76);

CREATE INDEX IF NOT EXISTS idx_node_levels_price ON node_levels(price_usdt);
CREATE INDEX IF NOT EXISTS idx_node_levels_power ON node_levels(power);

-- ============================================
-- 3. NFT 销售阶段配置表
-- ============================================
CREATE TABLE IF NOT EXISTS node_level_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level_id INTEGER NOT NULL,
    stage INTEGER NOT NULL,
    stage_supply INTEGER NOT NULL,
    stage_minted INTEGER DEFAULT 0,
    difficulty_multiplier REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (level_id) REFERENCES node_levels(id),
    UNIQUE(level_id, stage)
);

-- Micro Node (5000 total, 1000 per stage)
INSERT OR REPLACE INTO node_level_stages (level_id, stage, stage_supply, difficulty_multiplier, description) VALUES
(1, 1, 1000, 1.0, 'Micro Stage 1 - 100% rewards'),
(1, 2, 1000, 0.9, 'Micro Stage 2 - 90% rewards'),
(1, 3, 1000, 0.8, 'Micro Stage 3 - 80% rewards'),
(1, 4, 1000, 0.7, 'Micro Stage 4 - 70% rewards'),
(1, 5, 1000, 0.6, 'Micro Stage 5 - 60% rewards');

-- Mini Node (3000 total, 600 per stage)
INSERT OR REPLACE INTO node_level_stages (level_id, stage, stage_supply, difficulty_multiplier, description) VALUES
(2, 1, 600, 1.0, 'Mini Stage 1 - 100% rewards'),
(2, 2, 600, 0.9, 'Mini Stage 2 - 90% rewards'),
(2, 3, 600, 0.8, 'Mini Stage 3 - 80% rewards'),
(2, 4, 600, 0.7, 'Mini Stage 4 - 70% rewards'),
(2, 5, 600, 0.6, 'Mini Stage 5 - 60% rewards');

-- Bronze Node (2000 total, 400 per stage)
INSERT OR REPLACE INTO node_level_stages (level_id, stage, stage_supply, difficulty_multiplier, description) VALUES
(3, 1, 400, 1.0, 'Bronze Stage 1 - 100% rewards'),
(3, 2, 400, 0.9, 'Bronze Stage 2 - 90% rewards'),
(3, 3, 400, 0.8, 'Bronze Stage 3 - 80% rewards'),
(3, 4, 400, 0.7, 'Bronze Stage 4 - 70% rewards'),
(3, 5, 400, 0.6, 'Bronze Stage 5 - 60% rewards');

-- Silver Node (1500 total, 300 per stage)
INSERT OR REPLACE INTO node_level_stages (level_id, stage, stage_supply, difficulty_multiplier, description) VALUES
(4, 1, 300, 1.0, 'Silver Stage 1 - 100% rewards'),
(4, 2, 300, 0.9, 'Silver Stage 2 - 90% rewards'),
(4, 3, 300, 0.8, 'Silver Stage 3 - 80% rewards'),
(4, 4, 300, 0.7, 'Silver Stage 4 - 70% rewards'),
(4, 5, 300, 0.6, 'Silver Stage 5 - 60% rewards');

-- Gold Node (1100 total, 220 per stage)
INSERT OR REPLACE INTO node_level_stages (level_id, stage, stage_supply, difficulty_multiplier, description) VALUES
(5, 1, 220, 1.0, 'Gold Stage 1 - 100% rewards'),
(5, 2, 220, 0.95, 'Gold Stage 2 - 95% rewards'),
(5, 3, 220, 0.9, 'Gold Stage 3 - 90% rewards'),
(5, 4, 220, 0.85, 'Gold Stage 4 - 85% rewards'),
(5, 5, 220, 0.8, 'Gold Stage 5 - 80% rewards');

-- Platinum Node (700 total, 140 per stage)
INSERT OR REPLACE INTO node_level_stages (level_id, stage, stage_supply, difficulty_multiplier, description) VALUES
(6, 1, 140, 1.0, 'Platinum Stage 1 - 100% rewards'),
(6, 2, 140, 0.95, 'Platinum Stage 2 - 95% rewards'),
(6, 3, 140, 0.9, 'Platinum Stage 3 - 90% rewards'),
(6, 4, 140, 0.85, 'Platinum Stage 4 - 85% rewards'),
(6, 5, 140, 0.8, 'Platinum Stage 5 - 80% rewards');

-- Diamond Node (600 total, 120 per stage)
INSERT OR REPLACE INTO node_level_stages (level_id, stage, stage_supply, difficulty_multiplier, description) VALUES
(7, 1, 120, 1.0, 'Diamond Stage 1 - 100% rewards'),
(7, 2, 120, 0.95, 'Diamond Stage 2 - 95% rewards'),
(7, 3, 120, 0.9, 'Diamond Stage 3 - 90% rewards'),
(7, 4, 120, 0.85, 'Diamond Stage 4 - 85% rewards'),
(7, 5, 120, 0.8, 'Diamond Stage 5 - 80% rewards');

CREATE INDEX IF NOT EXISTS idx_node_stages_level ON node_level_stages(level_id);
CREATE INDEX IF NOT EXISTS idx_node_stages_stage ON node_level_stages(stage);

-- ============================================
-- 4. NFT 节点表 (nodes) - 用于所有路由和服务
-- ============================================
CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER UNIQUE NOT NULL,
    owner_address TEXT NOT NULL,
    level INTEGER NOT NULL,
    stage INTEGER NOT NULL,
    difficulty_multiplier REAL NOT NULL,
    power REAL NOT NULL,
    mint_time DATETIME NOT NULL,
    tx_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (level) REFERENCES node_levels(id)
);

CREATE INDEX IF NOT EXISTS idx_nodes_owner ON nodes(owner_address);
CREATE INDEX IF NOT EXISTS idx_nodes_level ON nodes(level);
CREATE INDEX IF NOT EXISTS idx_nodes_token ON nodes(token_id);

-- ============================================
-- 5. NFT 挖矿奖励记录表
-- ============================================
CREATE TABLE IF NOT EXISTS node_mining_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL,
    owner_address TEXT NOT NULL,
    reward_date DATE NOT NULL,
    daily_reward_base REAL NOT NULL,
    difficulty_multiplier REAL NOT NULL,
    year_multiplier REAL NOT NULL,
    final_reward REAL NOT NULL,
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES nodes(token_id),
    UNIQUE(token_id, reward_date)
);

CREATE INDEX IF NOT EXISTS idx_node_rewards_token ON node_mining_rewards(token_id);
CREATE INDEX IF NOT EXISTS idx_node_rewards_owner ON node_mining_rewards(owner_address);
CREATE INDEX IF NOT EXISTS idx_node_rewards_date ON node_mining_rewards(reward_date);
CREATE INDEX IF NOT EXISTS idx_node_rewards_claimed ON node_mining_rewards(claimed);

-- ============================================
-- 6. 年度奖励倍数表
-- ============================================
CREATE TABLE IF NOT EXISTS yearly_reward_multipliers (
    year INTEGER PRIMARY KEY,
    multiplier REAL NOT NULL,
    decay_rate REAL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入10年奖励系数数据
INSERT OR REPLACE INTO yearly_reward_multipliers (year, multiplier, decay_rate, description) VALUES
(1, 1.000, 0.00, '第1年 - 100% 奖励（黄金期）'),
(2, 0.750, 0.25, '第2年 - 75% 奖励（急降 25%）'),
(3, 0.675, 0.10, '第3年 - 67.5% 奖励（递减 10%）'),
(4, 0.608, 0.10, '第4年 - 60.8% 奖励（递减 10%）'),
(5, 0.547, 0.10, '第5年 - 54.7% 奖励（递减 10%）'),
(6, 0.492, 0.10, '第6年 - 49.2% 奖励（递减 10%）'),
(7, 0.443, 0.10, '第7年 - 44.3% 奖励（递减 10%）'),
(8, 0.399, 0.10, '第8年 - 39.9% 奖励（递减 10%）'),
(9, 0.359, 0.10, '第9年 - 35.9% 奖励（递减 10%）'),
(10, 0.323, 0.10, '第10年 - 32.3% 奖励（递减 10%）');

CREATE INDEX IF NOT EXISTS idx_yearly_multipliers_year ON yearly_reward_multipliers(year);

-- ============================================
-- 7. 年度奖励预计算表 (yearly_rewards)
-- ============================================
CREATE TABLE IF NOT EXISTS yearly_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    level_id INTEGER NOT NULL,
    stage INTEGER NOT NULL,
    daily_reward REAL NOT NULL,
    year_multiplier REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (level_id) REFERENCES node_levels(id),
    UNIQUE(year, level_id, stage)
);

-- 插入预计算的年度奖励数据 (10年 × 7等级 × 5阶段 = 350条记录)
-- 公式: daily_reward = daily_reward_base × difficulty_multiplier × year_multiplier
INSERT OR REPLACE INTO yearly_rewards (year, level_id, stage, daily_reward, year_multiplier)
SELECT 
    yrm.year,
    nl.id as level_id,
    nls.stage,
    ROUND(nl.daily_reward_base * nls.difficulty_multiplier * yrm.multiplier, 4) as daily_reward,
    yrm.multiplier as year_multiplier
FROM node_levels nl
CROSS JOIN node_level_stages nls ON nl.id = nls.level_id
CROSS JOIN yearly_reward_multipliers yrm
ORDER BY yrm.year, nl.id, nls.stage;

CREATE INDEX IF NOT EXISTS idx_yearly_rewards_lookup ON yearly_rewards(year, level_id, stage);
CREATE INDEX IF NOT EXISTS idx_yearly_rewards_year ON yearly_rewards(year);
CREATE INDEX IF NOT EXISTS idx_yearly_rewards_level ON yearly_rewards(level_id);

-- ============================================
-- 8. SWAP 交易记录表
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
-- 9. SWAP 挖矿配置表
-- ============================================
CREATE TABLE IF NOT EXISTS swap_mining_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    reward_rate REAL NOT NULL DEFAULT 0.0003,
    fee_rate REAL NOT NULL DEFAULT 0.0015,
    eagle_price_usdt REAL NOT NULL DEFAULT 0.10,
    enabled BOOLEAN DEFAULT 1,
    nft_bonus_enabled BOOLEAN DEFAULT 1,
    nft_bonus_multiplier REAL DEFAULT 10.0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO swap_mining_config (id, reward_rate, fee_rate, eagle_price_usdt, enabled, nft_bonus_enabled, nft_bonus_multiplier) 
VALUES (1, 0.0003, 0.0015, 0.10, 1, 1, 10.0);

-- ============================================
-- 10. SWAP 挖矿 NFT 加成日志表
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_nft_bonus_user ON swap_mining_nft_bonus_log(user_address);
CREATE INDEX IF NOT EXISTS idx_nft_bonus_date ON swap_mining_nft_bonus_log(created_at);

-- ============================================
-- 10. 用户 SWAP 统计表
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
-- 11. 每日全平台统计表
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
-- 12. SWAP 挖矿奖励记录表
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
-- 13. VIP 等级表
-- ============================================
CREATE TABLE IF NOT EXISTS vip_levels (
    vip_level INTEGER PRIMARY KEY,
    vip_name TEXT NOT NULL,
    min_volume_usdt REAL NOT NULL,
    max_volume_usdt REAL,
    boost_percentage REAL NOT NULL,
    description TEXT
);

INSERT OR REPLACE INTO vip_levels (vip_level, vip_name, min_volume_usdt, max_volume_usdt, boost_percentage, description) VALUES
(0, 'Bronze', 0, 999.99, 100, 'Bronze VIP - 1.0x (100% base rate)'),
(1, 'Silver', 1000, 9999.99, 120, 'Silver VIP - 1.2x (120% = +20% boost)'),
(2, 'Gold', 10000, 99999.99, 150, 'Gold VIP - 1.5x (150% = +50% boost)'),
(3, 'Platinum', 100000, NULL, 200, 'Platinum VIP - 2.0x (200% = +100% boost)');

CREATE INDEX IF NOT EXISTS idx_vip_levels_volume ON vip_levels(min_volume_usdt);

-- ============================================
-- 14. NFT 加成表 (用于 Swap Mining)
-- ============================================
CREATE TABLE IF NOT EXISTS nft_level_bonus (
    nft_level INTEGER PRIMARY KEY,
    nft_tier_name TEXT NOT NULL,
    bonus_multiplier REAL NOT NULL,
    description TEXT
);

INSERT OR REPLACE INTO nft_level_bonus (nft_level, nft_tier_name, bonus_multiplier, description) VALUES
(0, 'None', 1.0, 'No NFT - 1.0x (100%)'),
(1, 'Micro', 1.01, 'Micro Node (Power 0.1) - 1.01x (101% = 100% + 1%)'),
(2, 'Mini', 1.03, 'Mini Node (Power 0.3) - 1.03x (103% = 100% + 3%)'),
(3, 'Bronze', 1.05, 'Bronze Node (Power 0.5) - 1.05x (105% = 100% + 5%)'),
(4, 'Silver', 1.10, 'Silver Node (Power 1.0) - 1.10x (110% = 100% + 10%)'),
(5, 'Gold', 1.30, 'Gold Node (Power 3.0) - 1.30x (130% = 100% + 30%)'),
(6, 'Platinum', 1.70, 'Platinum Node (Power 7.0) - 1.70x (170% = 100% + 70%)'),
(7, 'Diamond', 2.50, 'Diamond Node (Power 15.0) - 2.50x (250% = 100% + 150%)');

-- ============================================
-- 15. 系统配置表
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO system_config (key, value, description) VALUES
('eagle_token_address', '', 'EAGLE 代币合约地址'),
('node_nft_address', '', '节点 NFT 合约地址'),
('node_mining_address', '', '节点挖矿合约地址'),
('last_synced_block', '0', '最后同步的区块号'),
('daily_mining_pool', '57345', '每日NFT挖矿奖励池（第1年阶段1）- 13,900个NFT全部售出'),
('yearly_mining_pool', '20930925', '年度NFT挖矿奖励池（第1年）- 57,345 × 365天'),
('min_daily_pool', '34407', '最小每日奖励池 - 所有NFT在阶段5（60-80%奖励）'),
('total_nft_supply', '13900', 'NFT总供应量'),
('nft_mining_allocation', '400000000', 'NFT Mining总分配量 - 400M EAGLE（15年衰减）'),
('swap_mining_allocation', '300000000', 'Swap Mining总分配量 - 300M EAGLE（固定费率）'),
('eagle_price_usdt', '0.10', 'EAGLE 当前价格（USDT）');

COMMIT;

-- ============================================
-- 验证数据
-- ============================================
SELECT '✅ 数据库初始化完成！' as status;

SELECT 'NFT 等级配置:' as info;
SELECT id, name, emoji, price_usdt, power, max_supply, daily_reward_base FROM node_levels ORDER BY id;

SELECT 'VIP 等级配置:' as info;
SELECT vip_level, vip_name, min_volume_usdt, boost_percentage FROM vip_levels ORDER BY vip_level;

SELECT 'Swap Mining 配置:' as info;
SELECT reward_rate, fee_rate, nft_bonus_enabled, nft_bonus_multiplier FROM swap_mining_config WHERE id = 1;

SELECT '总计表格数量:' as info, COUNT(*) as table_count FROM sqlite_master WHERE type='table';
