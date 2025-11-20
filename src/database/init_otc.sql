-- =====================================================
-- Eagle Swap OTC (Over-The-Counter) 场外交易系统数据库
-- =====================================================
-- 说明：
-- 1. 此数据库不存储用户资金，所有资金托管在智能合约中
-- 2. 仅用于读取链上记录、建立索引、优化搜索性能
-- 3. 核心数据（资金、交易执行）都在链上，数据库仅用于辅助查询
-- =====================================================

-- OTC 订单表（从链上同步）
CREATE TABLE IF NOT EXISTS otc_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,              -- 链上订单 ID（唯一标识）
    maker_address TEXT NOT NULL,                -- 创建者地址
    side TEXT NOT NULL CHECK(side IN ('buy', 'sell')), -- 订单类型：买入/卖出
    
    -- 代币信息
    token_sell TEXT NOT NULL,                   -- 出售的代币地址
    token_buy TEXT NOT NULL,                    -- 购买的代币地址
    amount_sell REAL NOT NULL,                  -- 出售数量
    amount_buy REAL NOT NULL,                   -- 购买数量
    amount_remaining REAL NOT NULL,             -- 剩余可交易数量
    
    -- 价格信息
    price_usdt REAL NOT NULL,                   -- USDT 计价
    
    -- 订单状态
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'filled', 'partial', 'cancelled', 'expired')),
    
    -- 时间信息
    created_at INTEGER NOT NULL,                -- 创建时间（Unix 时间戳）
    expiry_ts INTEGER NOT NULL,                 -- 过期时间（Unix 时间戳，0 表示永不过期）
    updated_at INTEGER NOT NULL,                -- 最后更新时间
    
    -- 区块链信息
    network TEXT NOT NULL,                      -- 网络：X Layer, Ethereum, BSC, Polygon, Arbitrum, Base
    chain_id INTEGER NOT NULL,                  -- 链 ID
    tx_hash TEXT,                               -- 创建订单的交易哈希
    contract_address TEXT,                      -- 智能合约地址
    
    -- 索引优化
    UNIQUE(order_id, network)
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_otc_orders_maker ON otc_orders(maker_address);
CREATE INDEX IF NOT EXISTS idx_otc_orders_status ON otc_orders(status);
CREATE INDEX IF NOT EXISTS idx_otc_orders_network ON otc_orders(network);
CREATE INDEX IF NOT EXISTS idx_otc_orders_side ON otc_orders(side);
CREATE INDEX IF NOT EXISTS idx_otc_orders_created ON otc_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otc_orders_price ON otc_orders(price_usdt);

-- OTC 交易历史表（成交记录）
CREATE TABLE IF NOT EXISTS otc_fills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,                     -- 关联的订单 ID
    maker_address TEXT NOT NULL,                -- Maker 地址
    taker_address TEXT NOT NULL,                -- Taker 地址
    
    -- 交易信息
    fill_amount REAL NOT NULL,                  -- 成交数量
    fill_price_usdt REAL NOT NULL,              -- 成交价格（USDT）
    gross_usdt REAL NOT NULL,                   -- 总金额
    fee_usdt REAL NOT NULL,                     -- 手续费（USDT）
    net_to_maker REAL NOT NULL,                 -- Maker 实际收到金额
    
    -- 订单信息
    side TEXT NOT NULL CHECK(side IN ('buy', 'sell')), -- 订单类型
    
    -- 时间信息
    filled_at INTEGER NOT NULL,                 -- 成交时间（Unix 时间戳）
    
    -- 区块链信息
    network TEXT NOT NULL,                      -- 网络
    chain_id INTEGER NOT NULL,                  -- 链 ID
    tx_hash TEXT NOT NULL,                      -- 交易哈希
    block_number INTEGER,                       -- 区块号
    
    FOREIGN KEY (order_id) REFERENCES otc_orders(order_id)
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_otc_fills_order ON otc_fills(order_id);
CREATE INDEX IF NOT EXISTS idx_otc_fills_maker ON otc_fills(maker_address);
CREATE INDEX IF NOT EXISTS idx_otc_fills_taker ON otc_fills(taker_address);
CREATE INDEX IF NOT EXISTS idx_otc_fills_time ON otc_fills(filled_at DESC);
CREATE INDEX IF NOT EXISTS idx_otc_fills_network ON otc_fills(network);
CREATE INDEX IF NOT EXISTS idx_otc_fills_tx ON otc_fills(tx_hash);

-- OTC 统计数据表（缓存统计信息）
CREATE TABLE IF NOT EXISTS otc_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    network TEXT NOT NULL,                      -- 网络
    
    -- 24小时统计
    volume_24h REAL DEFAULT 0,                  -- 24小时交易量（USDT）
    trades_24h INTEGER DEFAULT 0,               -- 24小时交易笔数
    active_orders INTEGER DEFAULT 0,            -- 活跃订单数
    
    -- 价格信息
    last_price REAL DEFAULT 0,                  -- 最新成交价
    price_change_24h REAL DEFAULT 0,            -- 24小时价格变化（%）
    
    -- 更新时间
    updated_at INTEGER NOT NULL,                -- 最后更新时间
    
    UNIQUE(network)
);

-- 用户 OTC 统计表（用户交易统计）
CREATE TABLE IF NOT EXISTS otc_user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,                 -- 用户地址
    network TEXT NOT NULL,                      -- 网络
    
    -- 作为 Maker 的统计
    orders_created INTEGER DEFAULT 0,           -- 创建的订单数
    orders_filled INTEGER DEFAULT 0,            -- 完成的订单数
    orders_cancelled INTEGER DEFAULT 0,         -- 取消的订单数
    volume_as_maker REAL DEFAULT 0,             -- 作为 Maker 的交易量
    
    -- 作为 Taker 的统计
    orders_taken INTEGER DEFAULT 0,             -- 接受的订单数
    volume_as_taker REAL DEFAULT 0,             -- 作为 Taker 的交易量
    
    -- 总计
    total_volume REAL DEFAULT 0,                -- 总交易量
    total_trades INTEGER DEFAULT 0,             -- 总交易笔数
    
    -- 时间信息
    first_trade_at INTEGER,                     -- 首次交易时间
    last_trade_at INTEGER,                      -- 最后交易时间
    updated_at INTEGER NOT NULL,                -- 最后更新时间
    
    UNIQUE(user_address, network)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_otc_user_stats_address ON otc_user_stats(user_address);
CREATE INDEX IF NOT EXISTS idx_otc_user_stats_volume ON otc_user_stats(total_volume DESC);
CREATE INDEX IF NOT EXISTS idx_otc_user_stats_trades ON otc_user_stats(total_trades DESC);

-- =====================================================
-- 插入初始数据
-- =====================================================

-- 初始化各网络的统计数据
INSERT OR IGNORE INTO otc_stats (network, volume_24h, trades_24h, active_orders, last_price, price_change_24h, updated_at)
VALUES 
    ('X Layer', 0, 0, 0, 0, 0, strftime('%s', 'now')),
    ('Ethereum', 0, 0, 0, 0, 0, strftime('%s', 'now')),
    ('BSC', 0, 0, 0, 0, 0, strftime('%s', 'now')),
    ('Polygon', 0, 0, 0, 0, 0, strftime('%s', 'now')),
    ('Arbitrum', 0, 0, 0, 0, 0, strftime('%s', 'now')),
    ('Base', 0, 0, 0, 0, 0, strftime('%s', 'now'));

-- =====================================================
-- 视图：活跃订单视图
-- =====================================================
CREATE VIEW IF NOT EXISTS v_active_otc_orders AS
SELECT 
    o.*,
    CASE 
        WHEN o.expiry_ts = 0 THEN 'never'
        WHEN o.expiry_ts > strftime('%s', 'now') THEN 'active'
        ELSE 'expired'
    END as expiry_status
FROM otc_orders o
WHERE o.status = 'open' 
  AND (o.expiry_ts = 0 OR o.expiry_ts > strftime('%s', 'now'))
  AND o.amount_remaining > 0
ORDER BY o.created_at DESC;

-- =====================================================
-- 视图：用户订单历史视图
-- =====================================================
CREATE VIEW IF NOT EXISTS v_user_otc_history AS
SELECT 
    f.*,
    o.side as order_side,
    o.token_sell,
    o.token_buy,
    CASE 
        WHEN f.maker_address = o.maker_address THEN 'maker'
        ELSE 'taker'
    END as user_role
FROM otc_fills f
JOIN otc_orders o ON f.order_id = o.order_id
ORDER BY f.filled_at DESC;

-- =====================================================
-- 说明文档
-- =====================================================
-- 
-- 数据同步流程：
-- 1. 用户在前端创建订单 → 代币存入智能合约
-- 2. 智能合约触发 OrderCreated 事件
-- 3. 后端监听事件，将订单信息插入 otc_orders 表
-- 4. 前端从 otc_orders 表快速查询订单列表
-- 5. 用户接受订单 → 直接与智能合约交互
-- 6. 智能合约触发 OrderFilled 事件
-- 7. 后端监听事件，插入 otc_fills 记录，更新 otc_orders 状态
-- 8. 后端定期更新统计数据（otc_stats, otc_user_stats）
--
-- 重要提示：
-- - 所有用户资金都在智能合约中，数据库不存储资金
-- - 数据库仅用于索引和查询优化
-- - 即使数据库失效，用户资金仍然安全
-- - 所有关键数据都可以从区块链重新同步
-- 
-- =====================================================
