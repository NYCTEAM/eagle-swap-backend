-- ============================================
-- SWAP 挖矿 NFT 加成系统更新
-- 基础奖励率提高 10 倍：0.00003 → 0.0003
-- 添加 NFT 权重加成：权重 × 10 = 加成%
-- ============================================

BEGIN TRANSACTION;

-- 1. 添加 NFT 加成相关字段到配置表
ALTER TABLE swap_mining_config ADD COLUMN nft_bonus_enabled BOOLEAN DEFAULT 1;
ALTER TABLE swap_mining_config ADD COLUMN nft_bonus_multiplier REAL DEFAULT 10.0;
ALTER TABLE swap_mining_config ADD COLUMN compliance_disclaimer TEXT DEFAULT '当前参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。';

-- 2. 更新基础奖励率（提高 10 倍）
UPDATE swap_mining_config 
SET 
  reward_rate = 0.0003,  -- 从 0.00003 提高到 0.0003（10倍）
  nft_bonus_enabled = 1,
  nft_bonus_multiplier = 10.0,
  compliance_disclaimer = '当前参数：基础奖励率 0.0003 EAGLE/USDT，NFT 加成 = 权重 × 10%。此参数可能根据网络条件调整，不保证未来维持相同参数。',
  updated_at = datetime('now')
WHERE id = 1;

-- 3. 创建 NFT 加成记录表（用于审计）
CREATE TABLE IF NOT EXISTS swap_mining_nft_bonus_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  base_reward REAL NOT NULL,
  nft_weight REAL NOT NULL,
  bonus_percent REAL NOT NULL,
  bonus_amount REAL NOT NULL,
  final_reward REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_address) REFERENCES users(wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_nft_bonus_log_user ON swap_mining_nft_bonus_log(user_address);
CREATE INDEX IF NOT EXISTS idx_nft_bonus_log_date ON swap_mining_nft_bonus_log(created_at);

-- 4. 添加用户 NFT 权重缓存字段（性能优化）
-- 注意：如果字段已存在会报错，可以忽略
-- ALTER TABLE users ADD COLUMN total_nft_weight REAL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN nft_weight_updated_at DATETIME;

-- 5. 创建视图：用户当前 NFT 总权重
CREATE VIEW IF NOT EXISTS user_nft_weight AS
SELECT 
  n.owner_address as user_address,
  COALESCE(SUM(nl.power), 0) as total_weight,
  COUNT(n.token_id) as nft_count,
  MAX(nl.power) as max_weight,
  datetime('now') as calculated_at
FROM nft_ownership n
LEFT JOIN node_levels nl ON n.level_id = nl.id
WHERE n.owner_address IS NOT NULL
GROUP BY n.owner_address;

-- 6. 记录到审计日志
INSERT INTO compliance_audit_log (event_type, description)
VALUES (
  'SWAP_MINING_NFT_BONUS_ENABLED',
  'SWAP 挖矿 NFT 加成系统已启用。基础奖励率从 0.00003 提高到 0.0003（10倍）。NFT 加成公式：加成% = 权重 × 10。Diamond Node (15 权重) 获得 +150% 加成，总倍数 2.5x。'
);

COMMIT;

-- 验证配置
SELECT 
  '✅ SWAP 挖矿配置已更新' as status,
  reward_rate as '基础奖励率',
  nft_bonus_enabled as 'NFT加成启用',
  nft_bonus_multiplier as '加成倍数',
  compliance_disclaimer as '合规声明'
FROM swap_mining_config 
WHERE id = 1;

-- 显示各等级加成
SELECT 
  '📊 各等级 SWAP 挖矿加成' as info;

SELECT 
  nl.name as '等级',
  nl.power as '权重',
  (nl.power * 10) as '加成%',
  (0.0003 * (1 + nl.power * 10 / 100)) as '最终奖励率',
  (1 + nl.power * 10 / 100) as '倍数'
FROM node_levels nl
ORDER BY nl.id;
