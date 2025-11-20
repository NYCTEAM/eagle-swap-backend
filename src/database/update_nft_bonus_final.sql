-- ============================================
-- 更新 Platinum NFT 加成：185% → 200%
-- ============================================

BEGIN TRANSACTION;

-- 只更新 Platinum (等级6) 的加成百分比
UPDATE nft_level_bonus 
SET bonus_percentage = 200, 
    description = 'Platinum NFT - 2.00x boost (200% = 基础 100% + 100% 加成)' 
WHERE nft_level = 6;

-- 记录审计日志
INSERT INTO compliance_audit_log (event_type, description)
VALUES (
    'NFT_BONUS_PLATINUM_UPDATED',
    'Platinum NFT Swap Mining 加成已从 185% 更新为 200%。'
);

COMMIT;

-- 验证更新
SELECT '✅ Platinum NFT 加成已更新：185% → 200%' as status;

SELECT 
    nft_level as '等级',
    nft_tier_name as 'NFT 名称',
    bonus_percentage as '总倍数%',
    (bonus_percentage - 100) as '纯加成%'
FROM nft_level_bonus
ORDER BY nft_level;
