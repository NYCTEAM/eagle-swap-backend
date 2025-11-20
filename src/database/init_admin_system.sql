-- ============================================
-- 后台管理系统数据库表
-- 功能：管理员登录、用户管理、社区管理、数据统计
-- ============================================

-- ============================================
-- 1. 管理员表
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT DEFAULT 'admin',  -- 'super_admin', 'admin', 'operator'
    permissions TEXT,  -- JSON 格式的权限列表
    is_active BOOLEAN DEFAULT 1,
    last_login_at DATETIME,
    last_login_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);

-- ============================================
-- 2. 管理员操作日志表
-- ============================================
CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    action TEXT NOT NULL,  -- 'create_user', 'update_community', 'change_leader', etc.
    target_type TEXT,  -- 'user', 'community', 'node', etc.
    target_id TEXT,
    details TEXT,  -- JSON 格式的详细信息
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at);

-- ============================================
-- 3. 平台收入统计表
-- ============================================
CREATE TABLE IF NOT EXISTS platform_revenue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revenue_date DATE NOT NULL UNIQUE,
    node_sales_count INTEGER DEFAULT 0,
    node_sales_revenue REAL DEFAULT 0,
    swap_fee_revenue REAL DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_date ON platform_revenue(revenue_date);

-- ============================================
-- 4. 用户统计表（每日快照）
-- ============================================
CREATE TABLE IF NOT EXISTS user_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_date DATE NOT NULL UNIQUE,
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,  -- 当日有交易的用户
    total_nodes INTEGER DEFAULT 0,
    total_node_value REAL DEFAULT 0,
    total_swap_volume REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_statistics_date ON user_statistics(stat_date);

-- ============================================
-- 5. 社区统计表（每日快照）
-- ============================================
CREATE TABLE IF NOT EXISTS community_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_date DATE NOT NULL,
    community_id INTEGER NOT NULL,
    total_members INTEGER DEFAULT 0,
    total_value REAL DEFAULT 0,
    community_level INTEGER DEFAULT 1,
    leader_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (community_id) REFERENCES communities(id)
);

CREATE INDEX IF NOT EXISTS idx_community_statistics_date ON community_statistics(stat_date);
CREATE INDEX IF NOT EXISTS idx_community_statistics_community ON community_statistics(community_id);

-- ============================================
-- 6. 节点销售记录表
-- ============================================
CREATE TABLE IF NOT EXISTS node_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_address TEXT NOT NULL,
    node_level INTEGER NOT NULL,
    node_stage INTEGER NOT NULL,
    price_usdt REAL NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_node_sales_buyer ON node_sales(buyer_address);
CREATE INDEX IF NOT EXISTS idx_node_sales_date ON node_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_node_sales_level ON node_sales(node_level);

-- ============================================
-- 7. 系统配置变更记录表
-- ============================================
CREATE TABLE IF NOT EXISTS config_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    config_key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_config_changes_admin ON config_changes(admin_id);
CREATE INDEX IF NOT EXISTS idx_config_changes_key ON config_changes(config_key);

-- ============================================
-- 8. 创建管理视图
-- ============================================

-- 用户总览视图
CREATE VIEW IF NOT EXISTS admin_users_overview AS
SELECT 
    u.id,
    u.wallet_address,
    u.referral_code,
    u.referrer_level,
    u.swap_mining_bonus,
    u.created_at,
    COUNT(DISTINCT n.id) as total_nodes,
    COALESCE(SUM(nl.price_usdt), 0) as total_node_value,
    cm.community_id,
    c.community_name,
    cm.is_leader as is_community_leader
FROM users u
LEFT JOIN nodes n ON u.wallet_address = n.owner_address
LEFT JOIN node_levels nl ON n.level = nl.id
LEFT JOIN community_members cm ON u.wallet_address = cm.member_address
LEFT JOIN communities c ON cm.community_id = c.id
GROUP BY u.id;

-- 社区总览视图
CREATE VIEW IF NOT EXISTS admin_communities_overview AS
SELECT 
    c.id,
    c.community_name,
    c.leader_address,
    c.total_value,
    c.total_members,
    c.community_level,
    cl.level_name,
    cl.member_bonus,
    cl.leader_bonus,
    c.created_at,
    COUNT(DISTINCT iv.id) as total_impeachments,
    COUNT(DISTINCT CASE WHEN iv.status = 'active' THEN iv.id END) as active_impeachments
FROM communities c
LEFT JOIN community_level_config cl ON c.community_level = cl.level
LEFT JOIN impeachment_votes iv ON c.id = iv.community_id
GROUP BY c.id;

-- 平台收入总览视图
CREATE VIEW IF NOT EXISTS admin_revenue_overview AS
SELECT 
    revenue_date,
    node_sales_count,
    node_sales_revenue,
    swap_fee_revenue,
    total_revenue,
    SUM(total_revenue) OVER (ORDER BY revenue_date) as cumulative_revenue
FROM platform_revenue
ORDER BY revenue_date DESC;

-- 节点销售统计视图
CREATE VIEW IF NOT EXISTS admin_node_sales_stats AS
SELECT 
    nl.name as node_name,
    nl.price_usdt,
    COUNT(*) as sales_count,
    SUM(ns.price_usdt) as total_revenue,
    AVG(ns.price_usdt) as avg_price,
    MIN(ns.sale_date) as first_sale,
    MAX(ns.sale_date) as last_sale
FROM node_sales ns
JOIN node_levels nl ON ns.node_level = nl.id
GROUP BY ns.node_level;

-- SWAP 交易统计视图
CREATE VIEW IF NOT EXISTS admin_swap_stats AS
SELECT 
    DATE(created_at) as trade_date,
    COUNT(*) as total_trades,
    COUNT(DISTINCT user_address) as unique_traders,
    SUM(fee_usdt) as total_fees,
    AVG(fee_usdt) as avg_fee,
    SUM(amount_in) as total_volume_in,
    SUM(amount_out) as total_volume_out
FROM swap_transactions
GROUP BY DATE(created_at)
ORDER BY trade_date DESC;

-- ============================================
-- 9. 插入默认超级管理员
-- ============================================
-- 默认账号: admin
-- 默认密码: admin123 (实际使用时应该使用加密的密码)
-- 注意：这只是示例，生产环境需要使用 bcrypt 等加密
INSERT OR IGNORE INTO admins (username, password_hash, email, role, permissions) VALUES
('admin', 'admin123_CHANGE_ME', 'admin@eagleswap.com', 'super_admin', '["all"]');

-- ============================================
-- 10. 查询示例
-- ============================================

-- 查询所有用户及其节点信息
-- SELECT * FROM admin_users_overview;

-- 查询所有社区及其统计信息
-- SELECT * FROM admin_communities_overview;

-- 查询平台收入
-- SELECT * FROM admin_revenue_overview LIMIT 30;

-- 查询节点销售统计
-- SELECT * FROM admin_node_sales_stats;

-- 查询 SWAP 交易统计
-- SELECT * FROM admin_swap_stats LIMIT 30;

-- 查询管理员操作日志
-- SELECT 
--   al.*,
--   a.username
-- FROM admin_logs al
-- JOIN admins a ON al.admin_id = a.id
-- ORDER BY al.created_at DESC
-- LIMIT 100;
