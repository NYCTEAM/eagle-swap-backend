-- 添加 acquired_at 字段到 nft_holders 表
-- 用于记录用户获得 NFT 的时间（转账或铸造）

-- 1. 添加新字段
ALTER TABLE nft_holders ADD COLUMN acquired_at INTEGER;

-- 2. 为现有记录设置 acquired_at
-- 如果是原始持有者（从未转移），使用 minted_at
-- 否则使用 created_at（数据库记录时间，即转账时间）
UPDATE nft_holders 
SET acquired_at = CASE 
  WHEN created_at IS NOT NULL THEN strftime('%s', created_at)
  ELSE minted_at
END
WHERE acquired_at IS NULL;

-- 3. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_holders_acquired ON nft_holders(acquired_at);

-- 4. 说明
-- acquired_at: Unix 时间戳（秒），记录用户获得此 NFT 的时间
-- - 对于铸造：acquired_at = minted_at
-- - 对于转账：acquired_at = 转账时的区块时间戳
