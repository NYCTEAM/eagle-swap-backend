-- ============================================
-- 多链共享 NFT 系统数据库 Schema
-- 全局共享 13,900 张 NFT，跨 X Layer, BSC, Solana
-- ============================================

-- 1. 多链 NFT 合约配置
CREATE TABLE IF NOT EXISTS nft_chain_contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id INTEGER NOT NULL UNIQUE,
    chain_name TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    payment_tokens TEXT NOT NULL, -- JSON: ["USDT", "NATIVE"]
    is_active BOOLEAN DEFAULT 1,
    deploy_tx TEXT,
    deployed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入已知合约
INSERT OR REPLACE INTO nft_chain_contracts (chain_id, chain_name, contract_address, payment_tokens, is_active, deployed_at)
VALUES 
    (196, 'X Layer', '0x8d3FBe540CBe8189333A1758cE3801067A023809', '["USDT", "NATIVE"]', 1, '2025-12-04'),
    (56, 'BSC', '0xB6966D11898D7c6bC0cC942C013e314e2b4C4d15', '["USDT", "BNB"]', 1, '2025-12-04'),
    (900, 'Solana', '', '["USDC", "SOL"]', 0, NULL);

-- 2. 全局共享 NFT 库存 (跨链共享总供应量)
CREATE TABLE IF NOT EXISTS nft_global_inventory (
    level INTEGER PRIMARY KEY,
    level_name TEXT NOT NULL,
    price_usdt REAL NOT NULL,
    total_supply INTEGER NOT NULL,           -- 全局总供应量
    minted INTEGER DEFAULT 0,                -- 全局已铸造数量
    available INTEGER GENERATED ALWAYS AS (total_supply - minted) STORED,
    mining_power REAL NOT NULL,              -- 挖矿权重
    boost_multiplier REAL NOT NULL,          -- Swap Mining boost (1.05 = 105%)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化全局共享库存 (总计 13,900 张)
INSERT OR REPLACE INTO nft_global_inventory (level, level_name, price_usdt, total_supply, mining_power, boost_multiplier)
VALUES 
    (1, 'Micro Node', 10, 5000, 0.1, 1.05),      -- 5000 张
    (2, 'Mini Node', 25, 3000, 0.3, 1.10),       -- 3000 张
    (3, 'Bronze Node', 50, 2000, 0.5, 1.15),     -- 2000 张
    (4, 'Silver Node', 100, 1500, 1.0, 1.25),    -- 1500 张
    (5, 'Gold Node', 250, 1100, 3.0, 1.50),      -- 1100 张
    (6, 'Platinum Node', 500, 700, 7.0, 2.00),   -- 700 张
    (7, 'Diamond Node', 1000, 600, 15.0, 3.50);  -- 600 张
    -- 总计: 13,900 张 NFT

-- 3. 全局 NFT 注册表 (每个 NFT 的全局唯一记录)
CREATE TABLE IF NOT EXISTS nft_global_registry (
    global_id INTEGER PRIMARY KEY AUTOINCREMENT, -- 全局唯一 ID (1-13900)
    chain_id INTEGER NOT NULL,                   -- 铸造在哪条链
    chain_token_id INTEGER NOT NULL,             -- 链上 Token ID
    level INTEGER NOT NULL,
    owner_address TEXT NOT NULL,                 -- 可以是 EVM 或 Solana 地址
    mint_tx TEXT NOT NULL,
    mint_price_usdt REAL NOT NULL,
    payment_token TEXT NOT NULL,                 -- USDT, USDC, SOL, BNB, OKB
    minted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_burned BOOLEAN DEFAULT 0,
    burned_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain_id, chain_token_id),
    FOREIGN KEY (level) REFERENCES nft_global_inventory(level)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_nft_global_owner ON nft_global_registry(owner_address);
CREATE INDEX IF NOT EXISTS idx_nft_global_chain ON nft_global_registry(chain_id);
CREATE INDEX IF NOT EXISTS idx_nft_global_level ON nft_global_registry(level);
CREATE INDEX IF NOT EXISTS idx_nft_global_id ON nft_global_registry(global_id);

-- 4. 每条链的铸造统计
CREATE TABLE IF NOT EXISTS nft_chain_stats (
    chain_id INTEGER PRIMARY KEY,
    total_minted INTEGER DEFAULT 0,
    total_burned INTEGER DEFAULT 0,
    active_nfts INTEGER DEFAULT 0,
    last_mint_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chain_id) REFERENCES nft_chain_contracts(chain_id)
);

-- 初始化链统计
INSERT OR REPLACE INTO nft_chain_stats (chain_id, total_minted, total_burned, active_nfts)
VALUES 
    (196, 0, 0, 0),
    (56, 0, 0, 0),
    (900, 0, 0, 0);

-- 5. 用户多链 NFT 汇总视图
CREATE VIEW IF NOT EXISTS v_user_multichain_nfts AS
SELECT 
    owner_address,
    COUNT(*) as total_nfts,
    SUM(CASE WHEN chain_id = 196 THEN 1 ELSE 0 END) as xlayer_nfts,
    SUM(CASE WHEN chain_id = 56 THEN 1 ELSE 0 END) as bsc_nfts,
    SUM(CASE WHEN chain_id = 900 THEN 1 ELSE 0 END) as solana_nfts,
    SUM(i.mining_power) as total_mining_power,
    MAX(i.boost_multiplier) as max_boost
FROM nft_global_registry r
JOIN nft_global_inventory i ON r.level = i.level
WHERE r.is_burned = 0
GROUP BY owner_address;

-- 6. 全局库存统计视图
CREATE VIEW IF NOT EXISTS v_global_inventory_stats AS
SELECT 
    level,
    level_name,
    price_usdt,
    total_supply,
    minted,
    available,
    ROUND(minted * 100.0 / total_supply, 2) as minted_percentage,
    mining_power,
    boost_multiplier
FROM nft_global_inventory
ORDER BY level;

-- 7. 触发器: 更新全局库存
CREATE TRIGGER IF NOT EXISTS trg_update_global_inventory
AFTER INSERT ON nft_global_registry
BEGIN
    -- 更新全局库存
    UPDATE nft_global_inventory 
    SET minted = minted + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE level = NEW.level;
    
    -- 更新链统计
    UPDATE nft_chain_stats
    SET total_minted = total_minted + 1,
        active_nfts = active_nfts + 1,
        last_mint_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE chain_id = NEW.chain_id;
END;

-- 8. 触发器: 处理 NFT 销毁
CREATE TRIGGER IF NOT EXISTS trg_burn_nft
AFTER UPDATE OF is_burned ON nft_global_registry
WHEN NEW.is_burned = 1 AND OLD.is_burned = 0
BEGIN
    -- 更新全局库存 (销毁后可重新铸造)
    UPDATE nft_global_inventory 
    SET minted = minted - 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE level = NEW.level;
    
    -- 更新链统计
    UPDATE nft_chain_stats
    SET total_burned = total_burned + 1,
        active_nfts = active_nfts - 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE chain_id = NEW.chain_id;
END;

-- 9. 阶段衰减配置 (可选)
CREATE TABLE IF NOT EXISTS nft_stage_decay (
    stage INTEGER PRIMARY KEY,
    stage_name TEXT NOT NULL,
    nft_threshold INTEGER NOT NULL,  -- 达到多少张 NFT 进入此阶段
    decay_multiplier REAL NOT NULL,  -- 奖励衰减倍数 (1.0 = 100%, 0.95 = 95%)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化阶段配置
INSERT OR REPLACE INTO nft_stage_decay (stage, stage_name, nft_threshold, decay_multiplier)
VALUES 
    (1, 'Stage 1', 0, 1.00),      -- 0-2780 张: 100%
    (2, 'Stage 2', 2780, 0.95),   -- 2780-5560 张: 95%
    (3, 'Stage 3', 5560, 0.90),   -- 5560-8340 张: 90%
    (4, 'Stage 4', 8340, 0.85),   -- 8340-11120 张: 85%
    (5, 'Stage 5', 11120, 0.80);  -- 11120-13900 张: 80%

-- 10. 获取当前阶段函数 (通过视图实现)
CREATE VIEW IF NOT EXISTS v_current_stage AS
SELECT 
    s.stage,
    s.stage_name,
    s.nft_threshold,
    s.decay_multiplier,
    (SELECT SUM(minted) FROM nft_global_inventory) as total_minted,
    (SELECT SUM(total_supply) FROM nft_global_inventory) as total_supply
FROM nft_stage_decay s
WHERE s.nft_threshold <= (SELECT SUM(minted) FROM nft_global_inventory)
ORDER BY s.stage DESC
LIMIT 1;

-- 验证
SELECT '✅ 多链共享 NFT 系统表创建完成' as status;
SELECT '📊 全局库存配置:' as info;
SELECT level, level_name, total_supply, minted, available FROM nft_global_inventory;
SELECT '📊 总供应量:', SUM(total_supply) as total FROM nft_global_inventory;
SELECT '⛓️  支持的链:' as info;
SELECT chain_id, chain_name, contract_address, is_active FROM nft_chain_contracts;
