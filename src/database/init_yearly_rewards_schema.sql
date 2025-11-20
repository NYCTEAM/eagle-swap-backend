-- 年度奖励配置表结构
-- 存储每个年份、每个等级、每个阶段的固定奖励值

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

-- 年度系数表
CREATE TABLE IF NOT EXISTS year_multipliers (
    year INTEGER PRIMARY KEY,
    multiplier REAL NOT NULL,
    decay_rate TEXT,
    description TEXT
);

-- 插入年度系数数据
INSERT OR REPLACE INTO year_multipliers (year, multiplier, decay_rate, description) VALUES
(1, 1.000, '-', 'Year 1 - 100% rewards (Golden Year)'),
(2, 0.750, '-25%', 'Year 2 - 75% rewards (Sharp drop)'),
(3, 0.675, '-10%', 'Year 3 - 67.5% rewards'),
(4, 0.608, '-10%', 'Year 4 - 60.8% rewards'),
(5, 0.547, '-10%', 'Year 5 - 54.7% rewards'),
(6, 0.492, '-10%', 'Year 6 - 49.2% rewards'),
(7, 0.443, '-10%', 'Year 7 - 44.3% rewards'),
(8, 0.399, '-10%', 'Year 8 - 39.9% rewards'),
(9, 0.359, '-10%', 'Year 9 - 35.9% rewards'),
(10, 0.323, '-10%', 'Year 10 - 32.3% rewards');

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_yearly_rewards_year ON yearly_rewards(year);
CREATE INDEX IF NOT EXISTS idx_yearly_rewards_level ON yearly_rewards(level_id);
CREATE INDEX IF NOT EXISTS idx_yearly_rewards_stage ON yearly_rewards(stage);
CREATE INDEX IF NOT EXISTS idx_yearly_rewards_lookup ON yearly_rewards(year, level_id, stage);
