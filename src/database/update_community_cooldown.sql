-- ============================================
-- 更新社区系统：7天冷却期规则
-- 规则：加入社区后必须待满7天才能退出
--       退出后可以立即加入新社区
-- ============================================

-- 1. 添加冷却期相关字段到 community_members 表
-- 注意：SQLite 不支持直接 ALTER TABLE ADD COLUMN IF NOT EXISTS
-- 需要先检查字段是否存在

-- 添加 can_leave_at 字段（可以离开的时间）
-- 计算方式：joined_at + 7天
ALTER TABLE community_members ADD COLUMN can_leave_at DATETIME;

-- 更新现有记录的 can_leave_at
UPDATE community_members 
SET can_leave_at = datetime(joined_at, '+7 days')
WHERE can_leave_at IS NULL;

-- ============================================
-- 2. 创建视图：检查成员是否可以离开社区
-- ============================================

CREATE VIEW IF NOT EXISTS member_leave_status AS
SELECT 
    cm.id,
    cm.community_id,
    cm.member_address,
    cm.joined_at,
    cm.can_leave_at,
    CASE 
        WHEN datetime('now') >= cm.can_leave_at THEN 1
        ELSE 0
    END as can_leave_now,
    CAST((julianday(cm.can_leave_at) - julianday('now')) AS INTEGER) as days_until_can_leave,
    c.community_name
FROM community_members cm
JOIN communities c ON cm.community_id = c.id;

-- ============================================
-- 3. 更新 community_changes 表，添加退出原因
-- ============================================

-- 添加 leave_reason 字段
ALTER TABLE community_changes ADD COLUMN leave_reason TEXT;

-- 添加 is_forced 字段（是否被强制退出，如被弹劾）
ALTER TABLE community_changes ADD COLUMN is_forced BOOLEAN DEFAULT 0;

-- ============================================
-- 4. 创建触发器：加入社区时自动设置 can_leave_at
-- ============================================

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS set_can_leave_at;

-- 创建新触发器
CREATE TRIGGER set_can_leave_at
AFTER INSERT ON community_members
BEGIN
    UPDATE community_members 
    SET can_leave_at = datetime(NEW.joined_at, '+7 days')
    WHERE id = NEW.id;
END;

-- ============================================
-- 5. 创建触发器：更换社区时重置 can_leave_at
-- ============================================

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS reset_can_leave_at_on_change;

-- 创建新触发器：当成员更换社区时，重置 can_leave_at
CREATE TRIGGER reset_can_leave_at_on_change
AFTER UPDATE OF community_id ON community_members
BEGIN
    UPDATE community_members 
    SET joined_at = CURRENT_TIMESTAMP,
        can_leave_at = datetime(CURRENT_TIMESTAMP, '+7 days')
    WHERE id = NEW.id;
END;

-- ============================================
-- 6. 查询示例
-- ============================================

-- 查询成员是否可以离开社区
-- SELECT * FROM member_leave_status WHERE member_address = '0x...';

-- 查询还需要等待多少天才能离开
-- SELECT 
--   member_address,
--   community_name,
--   joined_at,
--   can_leave_at,
--   days_until_can_leave,
--   can_leave_now
-- FROM member_leave_status 
-- WHERE member_address = '0x...' AND can_leave_now = 0;

-- 查询所有可以离开的成员
-- SELECT * FROM member_leave_status WHERE can_leave_now = 1;

-- ============================================
-- 7. 业务逻辑说明
-- ============================================

-- 加入社区流程：
-- 1. INSERT INTO community_members (community_id, member_address, node_value)
-- 2. 触发器自动设置 can_leave_at = joined_at + 7天
-- 3. 记录到 community_changes

-- 退出社区流程：
-- 1. 检查 can_leave_now = 1（已满7天）
-- 2. 如果可以退出：DELETE FROM community_members WHERE member_address = '0x...'
-- 3. 记录到 community_changes (old_community_id = X, new_community_id = NULL)
-- 4. 退出后立即可以加入新社区（没有冷却期）

-- 更换社区流程：
-- 1. 检查 can_leave_now = 1（已满7天）
-- 2. 如果可以：UPDATE community_members SET community_id = NEW_ID
-- 3. 触发器自动重置 joined_at 和 can_leave_at
-- 4. 记录到 community_changes (old_community_id = X, new_community_id = Y)

-- 强制退出（被弹劾）：
-- 1. 不检查 can_leave_at
-- 2. 直接 DELETE FROM community_members
-- 3. 记录到 community_changes (is_forced = 1)
