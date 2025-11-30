-- ============================================
-- 多链 NFT 系统数据库 Schema
-- 支持 X Layer, BSC, Solana 多链 NFT
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
    (196, 'X Layer', '0xc301211e0e9ADD883135eA268444649ee6c510c5', '["USDT", "NATIVE"]', 1, '2025-11-30'),
    (56, 'BSC', '', '["USDT", "BNB"]', 0, NULL),
    (900, 'Solana', '', '["USDC", "SOL"]', 0, NULL);

-- 2. 多链 NFT 库存 (每条链独立库存)
CREATE TABLE IF NOT EXISTS nft_multichain_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id INTEGER NOT NULL,
    level INTEGER NOT NULL,
    level_name TEXT NOT NULL,
    price_usdt REAL NOT NULL,
    total_supply INTEGER NOT NULL,
    minted INTEGER DEFAULT 0,
    available INTEGER GENERATED ALWAYS AS (total_supply - minted) STORED,
    mining_power INTEGER NOT NULL,
    boost_multiplier REAL NOT NULL, -- 1.05 = 5% boost
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain_id, level)
);

-- 为每条链初始化库存 (X Layer)
INSERT OR REPLACE INTO nft_multichain_inventory (chain_id, level, level_name, price_usdt, total_supply, mining_power, boost_multiplier)
VALUES 
    (196, 1, 'Micro Node', 10, 5000, 1, 1.05),
    (196, 2, 'Mini Node', 25, 3000, 2, 1.10),
    (196, 3, 'Bronze Node', 50, 2000, 3, 1.15),
    (196, 4, 'Silver Node', 100, 1500, 5, 1.25),
    (196, 5, 'Gold Node', 250, 1100, 8, 1.50),
    (196, 6, 'Platinum Node', 500, 700, 12, 2.00),
    (196, 7, 'Diamond Node', 1000, 600, 15, 3.50);

-- BSC 库存 (相同配置)
INSERT OR REPLACE INTO nft_multichain_inventory (chain_id, level, level_name, price_usdt, total_supply, mining_power, boost_multiplier)
VALUES 
    (56, 1, 'Micro Node', 10, 5000, 1, 1.05),
    (56, 2, 'Mini Node', 25, 3000, 2, 1.10),
    (56, 3, 'Bronze Node', 50, 2000, 3, 1.15),
    (56, 4, 'Silver Node', 100, 1500, 5, 1.25),
    (56, 5, 'Gold Node', 250, 1100, 8, 1.50),
    (56, 6, 'Platinum Node', 500, 700, 12, 2.00),
    (56, 7, 'Diamond Node', 1000, 600, 15, 3.50);

-- Solana 库存 (相同配置)
INSERT OR REPLACE INTO nft_multichain_inventory (chain_id, level, level_name, price_usdt, total_supply, mining_power, boost_multiplier)
VALUES 
    (900, 1, 'Micro Node', 10, 5000, 1, 1.05),
    (900, 2, 'Mini Node', 25, 3000, 2, 1.10),
    (900, 3, 'Bronze Node', 50, 2000, 3, 1.15),
    (900, 4, 'Silver Node', 100, 1500, 5, 1.25),
    (900, 5, 'Gold Node', 250, 1100, 8, 1.50),
    (900, 6, 'Platinum Node', 500, 700, 12, 2.00),
    (900, 7, 'Diamond Node', 1000, 600, 15, 3.50);

-- 3. 全局 NFT 记录 (跨链唯一 ID)
CREATE TABLE IF NOT EXISTS nft_global_registry (
    global_id INTEGER PRIMARY KEY AUTOINCREMENT, -- 全局唯一 ID
    chain_id INTEGER NOT NULL,
    chain_token_id INTEGER NOT NULL, -- 链上 Token ID
    level INTEGER NOT NULL,
    owner_address TEXT NOT NULL, -- 可以是 EVM 或 Solana 地址
    mint_tx TEXT NOT NULL,
    mint_price_usdt REAL NOT NULL,
    payment_token TEXT NOT NULL, -- USDT, USDC, SOL, BNB, OKB
    minted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_burned BOOLEAN DEFAULT 0,
    burned_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain_id, chain_token_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_nft_global_owner ON nft_global_registry(owner_address);
CREATE INDEX IF NOT EXISTS idx_nft_global_chain ON nft_global_registry(chain_id);
CREATE INDEX IF NOT EXISTS idx_nft_global_level ON nft_global_registry(level);

-- 4. 用户多链 NFT 汇总视图
CREATE VIEW IF NOT EXISTS v_user_multichain_nfts AS
SELECT 
    owner_address,
    COUNT(*) as total_nfts,
    SUM(CASE WHEN chain_id = 196 THEN 1 ELSE 0 END) as xlayer_nfts,
    SUM(CASE WHEN chain_id = 56 THEN 1 ELSE 0 END) as bsc_nfts,
    SUM(CASE WHEN chain_id = 900 THEN 1 ELSE 0 END) as solana_nfts,
    MAX(level) as highest_level,
    GROUP_CONCAT(DISTINCT chain_id) as chains_owned
FROM nft_global_registry
WHERE is_burned = 0
GROUP BY owner_address;

-- 5. 全局库存统计视图
CREATE VIEW IF NOT EXISTS v_global_nft_stats AS
SELECT 
    level,
    level_name,
    price_usdt,
    mining_power,
    boost_multiplier,
    SUM(total_supply) as global_total_supply,
    SUM(minted) as global_minted,
    SUM(available) as global_available
FROM nft_multichain_inventory
GROUP BY level;

-- 6. 触发器: 更新库存
CREATE TRIGGER IF NOT EXISTS trg_update_multichain_inventory
AFTER INSERT ON nft_global_registry
BEGIN
    UPDATE nft_multichain_inventory 
    SET minted = minted + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE chain_id = NEW.chain_id AND level = NEW.level;
END;

-- 验证
SELECT '✅ 多链 NFT 系统表创建完成' as status;
SELECT chain_name, contract_address, is_active FROM nft_chain_contracts;
SELECT chain_id, level, level_name, total_supply, minted, available FROM nft_multichain_inventory WHERE chain_id = 196;
