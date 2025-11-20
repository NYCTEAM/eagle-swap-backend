-- ============================================
-- 恢复原始分配值（基于图片中的数据）
-- 添加合规表述以避免法律问题
-- ============================================

BEGIN TRANSACTION;

-- 更新 node_levels 表，设置原始的每日分配值
-- 使用 daily_reward_base 和 example_daily_allocation 列

UPDATE node_levels SET 
  daily_reward_base = 0.37,
  example_daily_allocation = 0.37,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：0.37 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 1; -- Micro Node

UPDATE node_levels SET 
  daily_reward_base = 0.93,
  example_daily_allocation = 0.93,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：0.93 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 2; -- Mini Node

UPDATE node_levels SET 
  daily_reward_base = 1.98,
  example_daily_allocation = 1.98,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：1.98 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 3; -- Bronze Node

UPDATE node_levels SET 
  daily_reward_base = 6.18,
  example_daily_allocation = 6.18,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：6.18 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 4; -- Silver Node

UPDATE node_levels SET 
  daily_reward_base = 16.01,
  example_daily_allocation = 16.01,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：16.01 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 5; -- Gold Node

UPDATE node_levels SET 
  daily_reward_base = 40.75,
  example_daily_allocation = 40.75,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：40.75 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 6; -- Platinum Node

UPDATE node_levels SET 
  daily_reward_base = 122.2,
  example_daily_allocation = 122.2,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：122.2 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 7; -- Diamond Node

-- 记录到审计日志
INSERT INTO compliance_audit_log (event_type, description)
VALUES (
  'ALLOCATION_VALUES_RESTORED',
  '恢复原始分配参数值。Micro: 0.37, Mini: 0.93, Bronze: 1.98, Silver: 6.18, Gold: 16.01, Platinum: 40.75, Diamond: 122.2 EAGLE/天。所有值标记为可变参数，添加合规免责声明。'
);

COMMIT;

-- 验证更新
SELECT 
  id,
  name,
  power as '权重',
  daily_reward_base as '每日基础',
  example_daily_allocation as '示例分配',
  allocation_variable as '可变',
  SUBSTR(allocation_disclaimer, 1, 30) || '...' as '免责声明'
FROM node_levels
ORDER BY id;

SELECT '✅ 原始分配值已恢复，并添加合规表述' as status;
