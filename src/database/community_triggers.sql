-- ============================================
-- 社区系统自动化触发器
-- 实现社区价值统计、等级升级、社区长选举
-- ============================================

-- ============================================
-- 1. 更新成员 NFT 价值
-- 当用户购买 NFT 时，自动更新社区成员的 node_value
-- ============================================
DROP TRIGGER IF EXISTS update_community_member_value;

CREATE TRIGGER update_community_member_value
AFTER INSERT ON nodes
BEGIN
    -- 更新社区成员的 NFT 总价值
    UPDATE community_members
    SET node_value = (
        SELECT COALESCE(SUM(nl.price_usdt), 0)
        FROM nodes n
        JOIN node_levels nl ON n.level = nl.id
        WHERE n.owner_address = NEW.owner_address
    )
    WHERE member_address = NEW.owner_address;
END;

-- ============================================
-- 2. 更新社区总价值和成员数
-- 当成员 NFT 价值更新时，自动更新社区总价值
-- ============================================
DROP TRIGGER IF EXISTS update_community_total_value;

CREATE TRIGGER update_community_total_value
AFTER UPDATE OF node_value ON community_members
BEGIN
    -- 更新社区总价值
    UPDATE communities
    SET 
        total_value = (
            SELECT COALESCE(SUM(node_value), 0)
            FROM community_members
            WHERE community_id = NEW.community_id
        ),
        total_members = (
            SELECT COUNT(*)
            FROM community_members
            WHERE community_id = NEW.community_id
        ),
        updated_at = datetime('now')
    WHERE id = NEW.community_id;
END;

-- ============================================
-- 3. 自动升级社区等级
-- 当社区总价值更新时，自动检查并升级社区等级
-- ============================================
DROP TRIGGER IF EXISTS upgrade_community_level;

CREATE TRIGGER upgrade_community_level
AFTER UPDATE OF total_value ON communities
BEGIN
    UPDATE communities
    SET 
        community_level = (
            SELECT level
            FROM community_level_config
            WHERE NEW.total_value >= min_value
            ORDER BY min_value DESC
            LIMIT 1
        ),
        bonus_rate = (
            SELECT member_bonus_rate
            FROM community_level_config
            WHERE NEW.total_value >= min_value
            ORDER BY min_value DESC
            LIMIT 1
        ),
        updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- ============================================
-- 4. 自动选举社区长
-- 当成员 NFT 价值更新时，自动检查并更换社区长
-- ============================================
DROP TRIGGER IF EXISTS auto_elect_leader;

CREATE TRIGGER auto_elect_leader
AFTER UPDATE OF node_value ON community_members
BEGIN
    -- 取消当前社区长
    UPDATE community_members
    SET is_leader = 0
    WHERE community_id = NEW.community_id AND is_leader = 1;
    
    -- 选举新社区长（NFT 价值最高的成员）
    UPDATE community_members
    SET is_leader = 1
    WHERE community_id = NEW.community_id
    AND member_address = (
        SELECT member_address
        FROM community_members
        WHERE community_id = NEW.community_id
        ORDER BY node_value DESC
        LIMIT 1
    );
    
    -- 更新社区表的 leader_address
    UPDATE communities
    SET 
        leader_address = (
            SELECT member_address
            FROM community_members
            WHERE community_id = NEW.community_id
            AND is_leader = 1
            LIMIT 1
        ),
        updated_at = datetime('now')
    WHERE id = NEW.community_id;
END;

-- ============================================
-- 5. 新成员加入时初始化 NFT 价值
-- ============================================
DROP TRIGGER IF EXISTS init_member_node_value;

CREATE TRIGGER init_member_node_value
AFTER INSERT ON community_members
BEGIN
    -- 计算新成员的 NFT 总价值
    UPDATE community_members
    SET node_value = (
        SELECT COALESCE(SUM(nl.price_usdt), 0)
        FROM nodes n
        JOIN node_levels nl ON n.level = nl.id
        WHERE n.owner_address = NEW.member_address
    )
    WHERE id = NEW.id;
END;

-- ============================================
-- 6. 成员加入后更新社区统计
-- ============================================
DROP TRIGGER IF EXISTS update_community_on_member_join;

CREATE TRIGGER update_community_on_member_join
AFTER INSERT ON community_members
BEGIN
    -- 更新社区总价值和成员数
    UPDATE communities
    SET 
        total_value = (
            SELECT COALESCE(SUM(node_value), 0)
            FROM community_members
            WHERE community_id = NEW.community_id
        ),
        total_members = (
            SELECT COUNT(*)
            FROM community_members
            WHERE community_id = NEW.community_id
        ),
        updated_at = datetime('now')
    WHERE id = NEW.community_id;
END;

-- ============================================
-- 7. 成员离开时更新社区统计
-- ============================================
DROP TRIGGER IF EXISTS update_community_on_member_leave;

CREATE TRIGGER update_community_on_member_leave
AFTER DELETE ON community_members
BEGIN
    -- 更新社区总价值和成员数
    UPDATE communities
    SET 
        total_value = (
            SELECT COALESCE(SUM(node_value), 0)
            FROM community_members
            WHERE community_id = OLD.community_id
        ),
        total_members = (
            SELECT COUNT(*)
            FROM community_members
            WHERE community_id = OLD.community_id
        ),
        updated_at = datetime('now')
    WHERE id = OLD.community_id;
    
    -- 如果离开的是社区长，重新选举
    UPDATE community_members
    SET is_leader = 1
    WHERE community_id = OLD.community_id
    AND member_address = (
        SELECT member_address
        FROM community_members
        WHERE community_id = OLD.community_id
        ORDER BY node_value DESC
        LIMIT 1
    );
    
    -- 更新社区的 leader_address
    UPDATE communities
    SET leader_address = (
        SELECT member_address
        FROM community_members
        WHERE community_id = OLD.community_id
        AND is_leader = 1
        LIMIT 1
    )
    WHERE id = OLD.community_id;
END;

-- ============================================
-- 8. 创建社区统计视图
-- ============================================
DROP VIEW IF EXISTS community_statistics_view;

CREATE VIEW community_statistics_view AS
SELECT 
    c.id,
    c.community_name,
    c.leader_address,
    c.community_code,
    c.total_value,
    c.total_members,
    c.community_level,
    c.bonus_rate,
    clc.level_name,
    clc.member_bonus_rate,
    clc.leader_bonus_rate,
    clc.min_value as current_level_min,
    (
        SELECT min_value 
        FROM community_level_config 
        WHERE level = c.community_level + 1
    ) as next_level_min,
    (
        SELECT min_value 
        FROM community_level_config 
        WHERE level = c.community_level + 1
    ) - c.total_value as value_to_next_level,
    c.created_at,
    c.updated_at
FROM communities c
LEFT JOIN community_level_config clc ON c.community_level = clc.level;

-- ============================================
-- 9. 创建成员详情视图
-- ============================================
DROP VIEW IF EXISTS community_member_details;

CREATE VIEW community_member_details AS
SELECT 
    cm.id,
    cm.community_id,
    cm.member_address,
    cm.node_value,
    cm.is_leader,
    cm.joined_at,
    c.community_name,
    c.community_level,
    c.bonus_rate,
    clc.member_bonus_rate,
    clc.leader_bonus_rate,
    CASE 
        WHEN cm.is_leader = 1 THEN clc.leader_bonus_rate
        ELSE clc.member_bonus_rate
    END as effective_bonus_rate,
    (
        SELECT COUNT(*)
        FROM nodes n
        WHERE n.owner_address = cm.member_address
    ) as nft_count
FROM community_members cm
JOIN communities c ON cm.community_id = c.id
LEFT JOIN community_level_config clc ON c.community_level = clc.level;

-- ============================================
-- 完成
-- ============================================

SELECT '✅ 社区触发器和视图已创建' as status;
