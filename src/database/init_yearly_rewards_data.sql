-- ============================================
-- 填充 yearly_rewards 表数据
-- 基于 node_levels 表的 daily_reward_base
-- 结合年度衰减和阶段衰减
-- ============================================

-- 确保表存在
CREATE TABLE IF NOT EXISTS yearly_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    level_id INTEGER NOT NULL,
    stage INTEGER NOT NULL,
    daily_reward REAL NOT NULL,
    year_multiplier REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, level_id, stage)
);

-- 年度系数
-- Year 1: 100%, Year 2: 75%, Year 3-10: 每年递减10%
CREATE TABLE IF NOT EXISTS year_multipliers (
    year INTEGER PRIMARY KEY,
    multiplier REAL NOT NULL
);

INSERT OR REPLACE INTO year_multipliers (year, multiplier) VALUES
(1, 1.000),
(2, 0.750),
(3, 0.675),
(4, 0.608),
(5, 0.547),
(6, 0.492),
(7, 0.443),
(8, 0.399),
(9, 0.359),
(10, 0.323);

-- 阶段系数
-- Stage 1: 100%, Stage 2: 95%, Stage 3: 90%, Stage 4: 85%, Stage 5: 80%
CREATE TABLE IF NOT EXISTS stage_multipliers (
    stage INTEGER PRIMARY KEY,
    multiplier REAL NOT NULL
);

INSERT OR REPLACE INTO stage_multipliers (stage, multiplier) VALUES
(1, 1.00),
(2, 0.95),
(3, 0.90),
(4, 0.85),
(5, 0.80);

-- 基础每日奖励 (基于 NFT 等级)
-- Level 1 (Micro): 0.27 EAGLE/day
-- Level 2 (Mini): 0.68 EAGLE/day
-- Level 3 (Bronze): 1.37 EAGLE/day
-- Level 4 (Silver): 2.74 EAGLE/day
-- Level 5 (Gold): 6.85 EAGLE/day
-- Level 6 (Platinum): 13.70 EAGLE/day
-- Level 7 (Diamond): 27.40 EAGLE/day

-- 清空并重新填充 yearly_rewards
DELETE FROM yearly_rewards;

-- 插入所有组合 (7 levels × 5 stages × 10 years = 350 records)
-- 使用 node_level_stages 表中的实际阶段系数
INSERT INTO yearly_rewards (year, level_id, stage, daily_reward, year_multiplier)
SELECT 
    ym.year,
    nl.id as level_id,
    nls.stage,
    nl.daily_reward_base * ym.multiplier * nls.difficulty_multiplier as daily_reward,
    ym.multiplier as year_multiplier
FROM node_levels nl
JOIN node_level_stages nls ON nl.id = nls.level_id
CROSS JOIN year_multipliers ym
WHERE nl.id BETWEEN 1 AND 7
ORDER BY nl.id, nls.stage, ym.year;

-- 验证数据
SELECT 
    'Level ' || level_id as level,
    'Stage ' || stage as stage,
    'Year ' || year as year,
    ROUND(daily_reward, 4) as daily_reward
FROM yearly_rewards
WHERE level_id = 1 AND stage = 1
ORDER BY year
LIMIT 10;
