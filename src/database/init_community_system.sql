-- 社区系统数据库表
-- 自动选举社区长 + 弹劾投票机制

-- ============================================
-- 1. 社区表
-- ============================================
CREATE TABLE IF NOT EXISTS communities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_name TEXT NOT NULL,
    leader_address TEXT NOT NULL,
    community_code TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    total_value REAL DEFAULT 0,
    total_members INTEGER DEFAULT 0,
    community_level INTEGER DEFAULT 1,
    bonus_rate REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_communities_leader ON communities(leader_address);
CREATE INDEX IF NOT EXISTS idx_communities_code ON communities(community_code);
CREATE INDEX IF NOT EXISTS idx_communities_level ON communities(community_level);

-- ============================================
-- 2. 社区成员表
-- ============================================
CREATE TABLE IF NOT EXISTS community_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL,
    member_address TEXT NOT NULL,
    node_value REAL DEFAULT 0,
    is_leader BOOLEAN DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (community_id) REFERENCES communities(id),
    UNIQUE(member_address)
);

CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_member ON community_members(member_address);
CREATE INDEX IF NOT EXISTS idx_community_members_leader ON community_members(is_leader);

-- ============================================
-- 3. 社区更换记录表
-- ============================================
CREATE TABLE IF NOT EXISTS community_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_address TEXT NOT NULL,
    old_community_id INTEGER,
    new_community_id INTEGER,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_community_changes_member ON community_changes(member_address);

-- ============================================
-- 4. 弹劾投票表
-- ============================================
CREATE TABLE IF NOT EXISTS impeachment_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL,
    target_leader_address TEXT NOT NULL,
    initiator_address TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'active',
    total_votes_for REAL DEFAULT 0,
    total_votes_against REAL DEFAULT 0,
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (community_id) REFERENCES communities(id)
);

CREATE INDEX IF NOT EXISTS idx_impeachment_votes_community ON impeachment_votes(community_id);
CREATE INDEX IF NOT EXISTS idx_impeachment_votes_status ON impeachment_votes(status);

-- ============================================
-- 5. 投票记录表
-- ============================================
CREATE TABLE IF NOT EXISTS vote_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    impeachment_id INTEGER NOT NULL,
    voter_address TEXT NOT NULL,
    vote_weight REAL NOT NULL,
    vote_for BOOLEAN NOT NULL,
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (impeachment_id) REFERENCES impeachment_votes(id),
    UNIQUE(impeachment_id, voter_address)
);

CREATE INDEX IF NOT EXISTS idx_vote_records_impeachment ON vote_records(impeachment_id);
CREATE INDEX IF NOT EXISTS idx_vote_records_voter ON vote_records(voter_address);

-- ============================================
-- 6. 被弹劾记录表
-- ============================================
CREATE TABLE IF NOT EXISTS impeachment_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL,
    leader_address TEXT NOT NULL,
    impeachment_id INTEGER NOT NULL,
    impeached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ban_until DATETIME,
    FOREIGN KEY (community_id) REFERENCES communities(id),
    FOREIGN KEY (impeachment_id) REFERENCES impeachment_votes(id)
);

CREATE INDEX IF NOT EXISTS idx_impeachment_history_community ON impeachment_history(community_id);
CREATE INDEX IF NOT EXISTS idx_impeachment_history_leader ON impeachment_history(leader_address);

-- ============================================
-- 7. 社区等级配置表
-- ============================================
CREATE TABLE IF NOT EXISTS community_level_config (
    level INTEGER PRIMARY KEY,
    level_name TEXT NOT NULL,
    min_value REAL NOT NULL,
    member_bonus_rate REAL NOT NULL,
    leader_bonus_rate REAL NOT NULL,
    description TEXT
);

-- 插入社区等级配置
INSERT OR REPLACE INTO community_level_config (level, level_name, min_value, member_bonus_rate, leader_bonus_rate, description) VALUES
(1, '新手社区', 0, 0.00, 0.10, '$0 - $1,000'),
(2, '成长社区', 1001, 0.05, 0.15, '$1,001 - $5,000'),
(3, '精英社区', 5001, 0.10, 0.20, '$5,001 - $20,000'),
(4, '王者社区', 20001, 0.15, 0.25, '$20,001 - $50,000'),
(5, '传奇社区', 50001, 0.20, 0.30, '$50,000+');

-- ============================================
-- 8. 社区排行榜视图
-- ============================================
CREATE VIEW IF NOT EXISTS community_leaderboard AS
SELECT 
    c.id,
    c.community_name,
    c.community_code,
    c.leader_address,
    c.total_value,
    c.total_members,
    c.community_level,
    c.bonus_rate,
    clc.level_name,
    clc.member_bonus_rate,
    clc.leader_bonus_rate
FROM communities c
LEFT JOIN community_level_config clc ON c.community_level = clc.level
ORDER BY c.total_value DESC;

-- ============================================
-- 完成
-- ============================================
