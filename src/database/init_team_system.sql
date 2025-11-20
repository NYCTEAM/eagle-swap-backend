-- 团队推荐系统数据库表
-- 三级推荐：一级 10%，二级 5%，三级 2%

-- ============================================
-- 1. 团队表
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL,
    leader_address TEXT NOT NULL,
    team_code TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    level INTEGER DEFAULT 1,
    total_members INTEGER DEFAULT 0,
    total_volume REAL DEFAULT 0,
    total_rewards REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (leader_address) REFERENCES users(wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_teams_leader ON teams(leader_address);
CREATE INDEX IF NOT EXISTS idx_teams_code ON teams(team_code);
CREATE INDEX IF NOT EXISTS idx_teams_level ON teams(level);

-- ============================================
-- 2. 团队成员表
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    member_address TEXT NOT NULL,
    referrer_address TEXT,
    member_level INTEGER NOT NULL,  -- 1, 2, 或 3
    total_volume REAL DEFAULT 0,
    total_rewards REAL DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (member_address) REFERENCES users(wallet_address),
    UNIQUE(team_id, member_address)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_address);
CREATE INDEX IF NOT EXISTS idx_team_members_level ON team_members(member_level);
CREATE INDEX IF NOT EXISTS idx_team_members_referrer ON team_members(referrer_address);

-- ============================================
-- 3. 团队奖励表
-- ============================================
CREATE TABLE IF NOT EXISTS team_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    leader_address TEXT NOT NULL,
    member_address TEXT NOT NULL,
    member_level INTEGER NOT NULL,
    reward_amount REAL NOT NULL,
    reward_type TEXT NOT NULL,
    source_tx_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (leader_address) REFERENCES users(wallet_address),
    FOREIGN KEY (member_address) REFERENCES users(wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_team_rewards_team ON team_rewards(team_id);
CREATE INDEX IF NOT EXISTS idx_team_rewards_leader ON team_rewards(leader_address);
CREATE INDEX IF NOT EXISTS idx_team_rewards_member ON team_rewards(member_address);
CREATE INDEX IF NOT EXISTS idx_team_rewards_date ON team_rewards(created_at);

-- ============================================
-- 4. 团队统计表
-- ============================================
CREATE TABLE IF NOT EXISTS team_stats (
    team_id INTEGER PRIMARY KEY,
    level1_members INTEGER DEFAULT 0,
    level2_members INTEGER DEFAULT 0,
    level3_members INTEGER DEFAULT 0,
    level1_volume REAL DEFAULT 0,
    level2_volume REAL DEFAULT 0,
    level3_volume REAL DEFAULT 0,
    level1_rewards REAL DEFAULT 0,
    level2_rewards REAL DEFAULT 0,
    level3_rewards REAL DEFAULT 0,
    total_volume REAL DEFAULT 0,
    total_rewards REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- ============================================
-- 5. 团队等级配置表
-- ============================================
CREATE TABLE IF NOT EXISTS team_level_config (
    level INTEGER PRIMARY KEY,
    level_name TEXT NOT NULL,
    min_members INTEGER NOT NULL,
    reward_multiplier REAL NOT NULL,
    description TEXT
);

-- 插入团队等级配置
INSERT OR REPLACE INTO team_level_config (level, level_name, min_members, reward_multiplier, description) VALUES
(1, '新手团队', 0, 1.0, '0-50 人'),
(2, '成长团队', 51, 1.1, '51-200 人'),
(3, '精英团队', 201, 1.2, '201-500 人'),
(4, '王者团队', 501, 1.3, '501-1000 人'),
(5, '传奇团队', 1001, 1.5, '1000+ 人');

-- ============================================
-- 6. 团队成员层级视图
-- ============================================
CREATE VIEW IF NOT EXISTS team_member_hierarchy AS
SELECT 
    tm.team_id,
    tm.member_address,
    tm.referrer_address,
    tm.member_level,
    tm.total_volume,
    tm.total_rewards,
    t.team_name,
    t.leader_address,
    t.team_code
FROM team_members tm
JOIN teams t ON tm.team_id = t.id;

-- ============================================
-- 7. 团队排行榜视图
-- ============================================
CREATE VIEW IF NOT EXISTS team_leaderboard AS
SELECT 
    t.id,
    t.team_name,
    t.team_code,
    t.leader_address,
    t.level,
    t.total_members,
    t.total_volume,
    t.total_rewards,
    ts.level1_members,
    ts.level2_members,
    ts.level3_members,
    tlc.level_name,
    tlc.reward_multiplier
FROM teams t
LEFT JOIN team_stats ts ON t.id = ts.team_id
LEFT JOIN team_level_config tlc ON t.level = tlc.level
ORDER BY t.total_volume DESC;

-- ============================================
-- 8. 奖励比例配置表
-- ============================================
CREATE TABLE IF NOT EXISTS reward_rate_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    level1_rate REAL NOT NULL DEFAULT 0.10,  -- 10%
    level2_rate REAL NOT NULL DEFAULT 0.05,  -- 5%
    level3_rate REAL NOT NULL DEFAULT 0.02,  -- 2%
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
INSERT OR REPLACE INTO reward_rate_config (id, level1_rate, level2_rate, level3_rate) 
VALUES (1, 0.10, 0.05, 0.02);

-- ============================================
-- 9. 团队活动表（可选）
-- ============================================
CREATE TABLE IF NOT EXISTS team_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT,
    reward_pool REAL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_team_activities_team ON team_activities(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activities_status ON team_activities(status);

-- ============================================
-- 10. 团队成就表（可选）
-- ============================================
CREATE TABLE IF NOT EXISTS team_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    achievement_type TEXT NOT NULL,
    achievement_name TEXT NOT NULL,
    description TEXT,
    reward_amount REAL DEFAULT 0,
    achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_team_achievements_team ON team_achievements(team_id);

-- ============================================
-- 完成
-- ============================================
