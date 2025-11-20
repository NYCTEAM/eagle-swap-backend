-- ============================================
-- 设置基于权重的分配系统
-- 每权重 = 2.72 EAGLE/天（固定参数）
-- ============================================

BEGIN TRANSACTION;

-- 创建或更新分配配置表
CREATE TABLE IF NOT EXISTS allocation_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 设置核心配置：每权重分配
INSERT OR REPLACE INTO allocation_config (config_key, config_value, description) VALUES
  ('allocation_method', 'fixed_per_weight', '分配方法：固定每权重'),
  ('allocation_per_weight', '2.72', '每权重每日分配（EAGLE）- 当前参数'),
  ('allocation_disclaimer', '当前参数：每权重 2.72 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。', '合规免责声明'),
  ('last_updated', datetime('now'), '最后更新时间');

-- 更新 node_levels 表，确保所有值都基于权重计算
-- 公式：每日分配 = 权重 × 2.72

UPDATE node_levels SET 
  daily_reward_base = power * 2.72,
  example_daily_allocation = power * 2.72,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数基于权重计算：' || (power * 2.72) || ' EAGLE/天 (' || power || ' 权重 × 2.72)。此参数可能根据网络条件调整。'
WHERE id = 1; -- Micro: 0.1 × 2.72 = 0.272

UPDATE node_levels SET 
  daily_reward_base = power * 2.72,
  example_daily_allocation = power * 2.72,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数基于权重计算：' || (power * 2.72) || ' EAGLE/天 (' || power || ' 权重 × 2.72)。此参数可能根据网络条件调整。'
WHERE id = 2; -- Mini: 0.3 × 2.72 = 0.816

UPDATE node_levels SET 
  daily_reward_base = power * 2.72,
  example_daily_allocation = power * 2.72,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数基于权重计算：' || (power * 2.72) || ' EAGLE/天 (' || power || ' 权重 × 2.72)。此参数可能根据网络条件调整。'
WHERE id = 3; -- Bronze: 0.5 × 2.72 = 1.36

UPDATE node_levels SET 
  daily_reward_base = power * 2.72,
  example_daily_allocation = power * 2.72,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数基于权重计算：' || (power * 2.72) || ' EAGLE/天 (' || power || ' 权重 × 2.72)。此参数可能根据网络条件调整。'
WHERE id = 4; -- Silver: 1.0 × 2.72 = 2.72

UPDATE node_levels SET 
  daily_reward_base = power * 2.72,
  example_daily_allocation = power * 2.72,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数基于权重计算：' || (power * 2.72) || ' EAGLE/天 (' || power || ' 权重 × 2.72)。此参数可能根据网络条件调整。'
WHERE id = 5; -- Gold: 3.0 × 2.72 = 8.16

UPDATE node_levels SET 
  daily_reward_base = power * 2.72,
  example_daily_allocation = power * 2.72,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数基于权重计算：' || (power * 2.72) || ' EAGLE/天 (' || power || ' 权重 × 2.72)。此参数可能根据网络条件调整。'
WHERE id = 6; -- Platinum: 7.0 × 2.72 = 19.04

UPDATE node_levels SET 
  daily_reward_base = power * 2.72,
  example_daily_allocation = power * 2.72,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数基于权重计算：' || (power * 2.72) || ' EAGLE/天 (' || power || ' 权重 × 2.72)。此参数可能根据网络条件调整。'
WHERE id = 7; -- Diamond: 15.0 × 2.72 = 40.8

-- 记录到审计日志
INSERT INTO compliance_audit_log (event_type, description)
VALUES (
  'WEIGHT_BASED_ALLOCATION_SET',
  '设置基于权重的分配系统。当前参数：每权重 2.72 EAGLE/天。所有等级的分配 = 权重 × 2.72。这确保了早期和后期持有者的公平性。'
);

COMMIT;

SELECT '✅ 基于权重的分配系统已设置（每权重 2.72 EAGLE/天）' as status;
