-- ============================================
-- 更新 NFT Swap Mining 加成百分比
-- 并清理数据库结构
-- ============================================

BEGIN TRANSACTION;

-- ============================================
-- 1. 检查并创建 nft_level_bonus 表（如果不存在）
-- ============================================
CREATE TABLE IF NOT EXISTS nft_level_bonus (
    nft_level INTEGER PRIMARY KEY,
    tier_name TEXT NOT NULL,
    bonus_percentage REAL NOT NULL,
    description TEXT,
    FOREIGN KEY (nft_level) REFERENCES node_levels(id)
);

-- ============================================
-- 2. 更新 NFT 加成百分比
-- 原始: 1%, 3%, 5%, 10%, 30%, 70%, 150%
-- 新值: 3%, 5%, 10%, 10%, 30%, 170%, 250%
-- ============================================
INSERT OR REPLACE INTO nft_level_bonus (nft_level, tier_name, bonus_percentage, description) VALUES
(1, 'Micro Node', 103, 'Micro NFT 持有者获得 103% Swap Mining 加成（基础 100% + 3% 加成）'),
(2, 'Mini Node', 105, 'Mini NFT 持有者获得 105% Swap Mining 加成（基础 100% + 5% 加成）'),
(3, 'Bronze Node', 110, 'Bronze NFT 持有者获得 110% Swap Mining 加成（基础 100% + 10% 加成）'),
(4, 'Silver Node', 110, 'Silver NFT 持有者获得 110% Swap Mining 加成（基础 100% + 10% 加成）'),
(5, 'Gold Node', 130, 'Gold NFT 持有者获得 130% Swap Mining 加成（基础 100% + 30% 加成）'),
(6, 'Platinum Node', 270, 'Platinum NFT 持有者获得 270% Swap Mining 加成（基础 100% + 170% 加成）'),
(7, 'Diamond Node', 350, 'Diamond NFT 持有者获得 350% Swap Mining 加成（基础 100% + 250% 加成）');

-- ============================================
-- 3. 创建审计日志
-- ============================================
INSERT INTO compliance_audit_log (event_type, description)
VALUES (
    'NFT_BONUS_UPDATED',
    'NFT Swap Mining 加成百分比已更新。新值：Micro 103%, Mini 105%, Bronze 110%, Silver 110%, Gold 130%, Platinum 270%, Diamond 350%。'
);

COMMIT;

-- ============================================
-- 4. 验证更新结果
-- ============================================
SELECT '✅ NFT 加成已更新' as status;

SELECT 
    '📊 当前 NFT Swap Mining 加成配置' as info;

SELECT 
    nft_level as '等级',
    tier_name as '名称',
    bonus_percentage as '总倍数%',
    (bonus_percentage - 100) as '加成%',
    description as '说明'
FROM nft_level_bonus
ORDER BY nft_level;

-- ============================================
-- 5. 显示与交易等级的组合效果
-- ============================================
SELECT '📈 最高组合加成示例' as example;

SELECT 
    'Diamond Tier (3.0x = 200%) + Diamond NFT (250%) = 450% 总加成 = 5.5x 总倍数' as max_combo;

SELECT 
    'Platinum Tier (2.0x = 100%) + Diamond NFT (250%) = 350% 总加成 = 4.5x 总倍数' as high_combo;
