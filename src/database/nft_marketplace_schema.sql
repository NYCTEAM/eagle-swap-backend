-- NFT 市场数据库表结构

-- 1. NFT 市场挂单表
CREATE TABLE IF NOT EXISTS nft_listings (
    id SERIAL PRIMARY KEY,
    token_id INTEGER NOT NULL,
    seller_address VARCHAR(42) NOT NULL,
    price DECIMAL(20, 6) NOT NULL,           -- USDT 价格
    is_active BOOLEAN DEFAULT true,
    listed_at TIMESTAMP NOT NULL,
    unlisted_at TIMESTAMP,
    tx_hash VARCHAR(66),                      -- 挂单交易哈希
    
    -- NFT 详细信息（缓存）
    nft_level INTEGER NOT NULL,               -- 0-6
    nft_stage INTEGER NOT NULL,               -- 1-5
    base_power DECIMAL(10, 2),
    stage_multiplier DECIMAL(10, 2),
    final_power DECIMAL(10, 2),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_token_id (token_id),
    INDEX idx_seller (seller_address),
    INDEX idx_active (is_active),
    INDEX idx_level (nft_level),
    INDEX idx_price (price)
);

-- 2. NFT 市场交易历史表
CREATE TABLE IF NOT EXISTS nft_sales (
    id SERIAL PRIMARY KEY,
    token_id INTEGER NOT NULL,
    seller_address VARCHAR(42) NOT NULL,
    buyer_address VARCHAR(42) NOT NULL,
    price DECIMAL(20, 6) NOT NULL,
    marketplace_fee DECIMAL(20, 6) NOT NULL,  -- 2% 手续费
    seller_amount DECIMAL(20, 6) NOT NULL,    -- 卖家实收
    
    -- NFT 信息
    nft_level INTEGER NOT NULL,
    nft_stage INTEGER NOT NULL,
    final_power DECIMAL(10, 2),
    
    tx_hash VARCHAR(66) NOT NULL,
    block_number INTEGER,
    sold_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_token_id (token_id),
    INDEX idx_seller (seller_address),
    INDEX idx_buyer (buyer_address),
    INDEX idx_sold_at (sold_at)
);

-- 3. NFT 价格历史表（用于图表）
CREATE TABLE IF NOT EXISTS nft_price_history (
    id SERIAL PRIMARY KEY,
    nft_level INTEGER NOT NULL,
    nft_stage INTEGER NOT NULL,
    avg_price DECIMAL(20, 6),
    min_price DECIMAL(20, 6),
    max_price DECIMAL(20, 6),
    sales_count INTEGER DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(nft_level, nft_stage, date),
    INDEX idx_level_stage (nft_level, nft_stage),
    INDEX idx_date (date)
);

-- 4. 用户市场活动表
CREATE TABLE IF NOT EXISTS user_marketplace_activity (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    activity_type VARCHAR(20) NOT NULL,      -- 'list', 'unlist', 'buy', 'sell'
    token_id INTEGER,
    price DECIMAL(20, 6),
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_user (user_address),
    INDEX idx_type (activity_type),
    INDEX idx_created_at (created_at)
);

-- 5. 市场统计表（每日汇总）
CREATE TABLE IF NOT EXISTS marketplace_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_volume DECIMAL(20, 6) DEFAULT 0,   -- 总交易额
    total_sales INTEGER DEFAULT 0,            -- 总交易数
    total_fees DECIMAL(20, 6) DEFAULT 0,     -- 总手续费
    active_listings INTEGER DEFAULT 0,        -- 活跃挂单数
    unique_sellers INTEGER DEFAULT 0,         -- 卖家数
    unique_buyers INTEGER DEFAULT 0,          -- 买家数
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_date (date)
);

-- 创建视图：当前市场概览
CREATE OR REPLACE VIEW v_marketplace_overview AS
SELECT 
    nft_level,
    COUNT(*) as listings_count,
    MIN(price) as min_price,
    MAX(price) as max_price,
    AVG(price) as avg_price,
    SUM(CASE WHEN nft_stage = 1 THEN 1 ELSE 0 END) as stage1_count,
    SUM(CASE WHEN nft_stage = 2 THEN 1 ELSE 0 END) as stage2_count,
    SUM(CASE WHEN nft_stage = 3 THEN 1 ELSE 0 END) as stage3_count,
    SUM(CASE WHEN nft_stage = 4 THEN 1 ELSE 0 END) as stage4_count,
    SUM(CASE WHEN nft_stage = 5 THEN 1 ELSE 0 END) as stage5_count
FROM nft_listings
WHERE is_active = true
GROUP BY nft_level;

-- 创建视图：热门 NFT
CREATE OR REPLACE VIEW v_trending_nfts AS
SELECT 
    nft_level,
    nft_stage,
    COUNT(*) as sales_count,
    AVG(price) as avg_price,
    SUM(price) as total_volume
FROM nft_sales
WHERE sold_at >= NOW() - INTERVAL '7 days'
GROUP BY nft_level, nft_stage
ORDER BY sales_count DESC, total_volume DESC
LIMIT 10;
