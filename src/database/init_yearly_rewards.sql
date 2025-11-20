-- ============================================
-- 年度奖励递减配置表
-- 基于 NODE_MINING_AGGRESSIVE_PLAN.md
-- 第2年急降 25%，之后每年递减 10%
-- ============================================

-- 创建年度奖励系数表
CREATE TABLE IF NOT EXISTS yearly_reward_multipliers (
    year INTEGER PRIMARY KEY,
    multiplier REAL NOT NULL,
    decay_rate REAL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入10年奖励系数数据
-- 第1年: 100% (1.0)
-- 第2年: 75% (0.75) - 急降 25%
-- 第3年起: 每年递减 10%

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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_yearly_multipliers_year ON yearly_reward_multipliers(year);

-- ============================================
-- 挖矿奖励计算辅助视图
-- ============================================

-- 创建视图：节点等级 × 年度系数 = 实际奖励
CREATE VIEW IF NOT EXISTS node_yearly_rewards AS
SELECT 
    nl.id as node_level_id,
    nl.name as node_name,
    nl.price_usdt,
    nl.daily_reward_base,
    yrm.year,
    yrm.multiplier as year_multiplier,
    yrm.decay_rate,
    (nl.daily_reward_base * yrm.multiplier) as daily_reward,
    (nl.daily_reward_base * yrm.multiplier * 365) as yearly_reward,
    yrm.description as year_description
FROM node_levels nl
CROSS JOIN yearly_reward_multipliers yrm
ORDER BY nl.id, yrm.year;

-- ============================================
-- 完整奖励计算视图（销售阶段 × 年度系数）
-- ============================================

-- 创建视图：节点等级 × 销售阶段 × 年度系数 = 最终奖励
CREATE VIEW IF NOT EXISTS node_complete_rewards AS
SELECT 
    nl.id as node_level_id,
    nl.name as node_name,
    nl.price_usdt,
    nl.daily_reward_base,
    nls.stage as sale_stage,
    nls.difficulty_multiplier as stage_multiplier,
    yrm.year,
    yrm.multiplier as year_multiplier,
    -- 最终日奖励 = 基础奖励 × 销售阶段系数 × 年度系数
    (nl.daily_reward_base * nls.difficulty_multiplier * yrm.multiplier) as final_daily_reward,
    -- 最终年奖励
    (nl.daily_reward_base * nls.difficulty_multiplier * yrm.multiplier * 365) as final_yearly_reward,
    nls.description as stage_description,
    yrm.description as year_description
FROM node_levels nl
JOIN node_level_stages nls ON nl.id = nls.level_id
CROSS JOIN yearly_reward_multipliers yrm
ORDER BY nl.id, nls.stage, yrm.year;

-- ============================================
-- 查询示例
-- ============================================

-- 查询所有年度奖励系数
-- SELECT * FROM yearly_reward_multipliers ORDER BY year;

-- 查询 Micro Node 各年度奖励
-- SELECT * FROM node_yearly_rewards WHERE node_name = 'Micro Node';

-- 查询 Micro Node 阶段1 在第5年的奖励
-- SELECT * FROM node_complete_rewards 
-- WHERE node_name = 'Micro Node' AND sale_stage = 1 AND year = 5;

-- 查询所有节点第1年的奖励
-- SELECT node_name, price_usdt, daily_reward, yearly_reward 
-- FROM node_yearly_rewards 
-- WHERE year = 1 
-- ORDER BY node_level_id;

-- 计算 Micro Node 10年总收益
-- SELECT 
--   node_name,
--   SUM(yearly_reward) as total_10_year_reward,
--   price_usdt,
--   (SUM(yearly_reward) / price_usdt * 100) as roi_percentage
-- FROM node_yearly_rewards 
-- WHERE node_name = 'Micro Node'
-- GROUP BY node_name, price_usdt;
