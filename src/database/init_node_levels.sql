-- 节点等级配置表
-- 根据 NODE_PRICING_REVISED.md - 975,000 USDT 方案
-- 包含固定的每日奖励值（基于阶段1的100%奖励）

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

-- 插入 7 个节点等级数据（包含固定每日奖励）
INSERT OR REPLACE INTO node_levels (id, name, emoji, price_usdt, power, max_supply, minted, daily_reward_base) VALUES
(1, 'Micro Node', '🪙', 10, 0.1, 5000, 0, 0.27),
(2, 'Mini Node', '⚪', 25, 0.3, 3000, 0, 0.82),
(3, 'Bronze Node', '🥉', 50, 0.5, 2000, 0, 1.36),
(4, 'Silver Node', '🥈', 100, 1.0, 1500, 0, 2.72),
(5, 'Gold Node', '🥇', 250, 3.0, 1100, 0, 8.15),
(6, 'Platinum Node', '💎', 500, 7.0, 700, 0, 19.02),
(7, 'Diamond Node', '💠', 1000, 15.0, 600, 0, 40.76);

-- 销售阶段配置表（每个等级独立的 5 个阶段）
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

-- 为每个节点等级插入 5 个阶段（每阶段 20% 供应量）
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_node_levels_price ON node_levels(price_usdt);
CREATE INDEX IF NOT EXISTS idx_node_levels_power ON node_levels(power);

-- 查询验证 - 节点等级配置
SELECT 
    id,
    name,
    emoji,
    price_usdt || ' USDT' as price,
    power || 'x' as power,
    max_supply as supply,
    daily_reward_base || ' EAGLE/day' as daily_reward,
    (price_usdt * max_supply) as total_raised
FROM node_levels
ORDER BY id;

-- 查询验证 - 每个等级的所有阶段奖励
SELECT 
    nl.name,
    nl.emoji,
    nls.stage,
    nls.stage_supply as supply,
    nls.difficulty_multiplier || 'x' as multiplier,
    ROUND(nl.daily_reward_base * nls.difficulty_multiplier, 2) || ' EAGLE/day' as daily_reward,
    ROUND(nl.daily_reward_base * nls.difficulty_multiplier * 30, 2) || ' EAGLE/month' as monthly_reward,
    ROUND(nl.daily_reward_base * nls.difficulty_multiplier * 365, 2) || ' EAGLE/year' as yearly_reward
FROM node_levels nl
JOIN node_level_stages nls ON nl.id = nls.level_id
ORDER BY nl.id, nls.stage;

-- 总计验证
SELECT 
    SUM(max_supply) as total_nodes,
    SUM(price_usdt * max_supply) as total_raised_usdt,
    SUM(daily_reward_base * max_supply) as total_daily_rewards_if_all_sold
FROM node_levels;
