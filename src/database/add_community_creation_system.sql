-- ============================================
-- 社区创建系统
-- 支持两种创建方式：
-- 1. 持有顶级 NFT (Diamond/Platinum) 直接创建
-- 2. 50人投票创建
-- ============================================

-- ============================================
-- 1. 社区创建申请表
-- ============================================
CREATE TABLE IF NOT EXISTS community_creation_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_address TEXT NOT NULL,
    community_name TEXT NOT NULL,
    community_code TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    creation_type TEXT NOT NULL, -- 'nft_holder' 或 'voting'
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
    required_votes INTEGER DEFAULT 50, -- 需要的投票数
    current_votes INTEGER DEFAULT 0, -- 当前投票数
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    completed_at DATETIME,
    CHECK (creation_type IN ('nft_holder', 'voting')),
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_creation_requests_creator ON community_creation_requests(creator_address);
CREATE INDEX IF NOT EXISTS idx_creation_requests_status ON community_creation_requests(status);
CREATE INDEX IF NOT EXISTS idx_creation_requests_type ON community_creation_requests(creation_type);

-- ============================================
-- 2. 社区创建投票表
-- ============================================
CREATE TABLE IF NOT EXISTS community_creation_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    voter_address TEXT NOT NULL,
    vote_weight REAL DEFAULT 1.0, -- 投票权重（基于 NFT 等级）
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES community_creation_requests(id),
    UNIQUE(request_id, voter_address)
);

CREATE INDEX IF NOT EXISTS idx_creation_votes_request ON community_creation_votes(request_id);
CREATE INDEX IF NOT EXISTS idx_creation_votes_voter ON community_creation_votes(voter_address);

-- ============================================
-- 3. NFT 等级配置（用于判断是否可以直接创建）
-- ============================================
CREATE TABLE IF NOT EXISTS nft_tier_privileges (
    tier_id INTEGER PRIMARY KEY,
    tier_name TEXT NOT NULL,
    can_create_community BOOLEAN DEFAULT 0,
    vote_weight REAL DEFAULT 1.0,
    description TEXT
);

-- 插入 NFT 等级权限配置
INSERT OR REPLACE INTO nft_tier_privileges (tier_id, tier_name, can_create_community, vote_weight, description) VALUES
(1, 'Micro Node', 0, 1.0, 'Cannot create community, standard vote weight'),
(2, 'Mini Node', 0, 1.0, 'Cannot create community, standard vote weight'),
(3, 'Bronze Node', 0, 1.5, 'Cannot create community, 1.5x vote weight'),
(4, 'Silver Node', 0, 2.0, 'Cannot create community, 2x vote weight'),
(5, 'Gold Node', 0, 3.0, 'Cannot create community, 3x vote weight'),
(6, 'Platinum Node', 1, 5.0, 'Can create community directly, 5x vote weight'),
(7, 'Diamond Node', 1, 10.0, 'Can create community directly, 10x vote weight');

-- ============================================
-- 4. 触发器：自动批准顶级 NFT 持有者的申请
-- ============================================
DROP TRIGGER IF EXISTS auto_approve_nft_holder_request;

CREATE TRIGGER auto_approve_nft_holder_request
AFTER INSERT ON community_creation_requests
WHEN NEW.creation_type = 'nft_holder'
BEGIN
    -- 检查申请者是否持有顶级 NFT
    UPDATE community_creation_requests
    SET 
        status = CASE
            WHEN EXISTS (
                SELECT 1 FROM nodes n
                JOIN nft_tier_privileges ntp ON n.level = ntp.tier_id
                WHERE n.owner_address = NEW.creator_address
                AND ntp.can_create_community = 1
            ) THEN 'approved'
            ELSE 'rejected'
        END,
        approved_at = CASE
            WHEN EXISTS (
                SELECT 1 FROM nodes n
                JOIN nft_tier_privileges ntp ON n.level = ntp.tier_id
                WHERE n.owner_address = NEW.creator_address
                AND ntp.can_create_community = 1
            ) THEN datetime('now')
            ELSE NULL
        END
    WHERE id = NEW.id;
END;

-- ============================================
-- 5. 触发器：投票达到要求自动批准
-- ============================================
DROP TRIGGER IF EXISTS auto_approve_voting_request;

CREATE TRIGGER auto_approve_voting_request
AFTER INSERT ON community_creation_votes
BEGIN
    -- 更新投票数
    UPDATE community_creation_requests
    SET current_votes = (
        SELECT COUNT(DISTINCT voter_address)
        FROM community_creation_votes
        WHERE request_id = NEW.request_id
    )
    WHERE id = NEW.request_id;
    
    -- 如果投票数达到要求，自动批准
    UPDATE community_creation_requests
    SET 
        status = 'approved',
        approved_at = datetime('now')
    WHERE id = NEW.request_id
    AND status = 'pending'
    AND current_votes >= required_votes;
END;

-- ============================================
-- 6. 触发器：批准后自动创建社区
-- ============================================
DROP TRIGGER IF EXISTS auto_create_community;

CREATE TRIGGER auto_create_community
AFTER UPDATE OF status ON community_creation_requests
WHEN NEW.status = 'approved' AND OLD.status != 'approved'
BEGIN
    -- 创建社区
    INSERT INTO communities (
        community_name,
        leader_address,
        community_code,
        description,
        logo_url,
        total_value,
        total_members,
        community_level,
        bonus_rate
    ) VALUES (
        NEW.community_name,
        NEW.creator_address,
        NEW.community_code,
        NEW.description,
        NEW.logo_url,
        0,
        0,
        1,
        0
    );
    
    -- 更新申请状态为已完成
    UPDATE community_creation_requests
    SET 
        status = 'completed',
        completed_at = datetime('now')
    WHERE id = NEW.id;
    
    -- 自动将创建者加入社区
    INSERT INTO community_members (
        community_id,
        member_address,
        node_value,
        is_leader
    )
    SELECT 
        c.id,
        NEW.creator_address,
        COALESCE(SUM(nl.price_usdt), 0),
        1
    FROM communities c
    LEFT JOIN nodes n ON n.owner_address = NEW.creator_address
    LEFT JOIN node_levels nl ON n.level = nl.id
    WHERE c.community_code = NEW.community_code
    GROUP BY c.id;
END;

-- ============================================
-- 7. 视图：社区创建申请详情
-- ============================================
DROP VIEW IF EXISTS community_creation_requests_view;

CREATE VIEW community_creation_requests_view AS
SELECT 
    ccr.id,
    ccr.creator_address,
    ccr.community_name,
    ccr.community_code,
    ccr.description,
    ccr.creation_type,
    ccr.status,
    ccr.required_votes,
    ccr.current_votes,
    ccr.created_at,
    ccr.approved_at,
    ccr.completed_at,
    -- 创建者是否持有顶级 NFT
    EXISTS (
        SELECT 1 FROM nodes n
        JOIN nft_tier_privileges ntp ON n.level = ntp.tier_id
        WHERE n.owner_address = ccr.creator_address
        AND ntp.can_create_community = 1
    ) as has_premium_nft,
    -- 创建者持有的最高等级 NFT
    (
        SELECT nl.name
        FROM nodes n
        JOIN node_levels nl ON n.level = nl.id
        WHERE n.owner_address = ccr.creator_address
        ORDER BY nl.price_usdt DESC
        LIMIT 1
    ) as highest_nft,
    -- 投票进度百分比
    ROUND(CAST(ccr.current_votes AS REAL) / ccr.required_votes * 100, 2) as vote_progress_percent
FROM community_creation_requests ccr;

-- ============================================
-- 8. 函数：检查用户是否可以创建社区
-- ============================================
-- 这个会在后端 API 中实现

-- ============================================
-- 9. 函数：检查用户是否可以投票
-- ============================================
-- 条件：
-- 1. 持有至少一个 NFT
-- 2. 未加入任何社区
-- 3. 未对该申请投过票
-- 这个会在后端 API 中实现

-- ============================================
-- 完成
-- ============================================

SELECT '✅ 社区创建系统表已创建' as status;

-- 查询验证
SELECT * FROM nft_tier_privileges ORDER BY tier_id;
