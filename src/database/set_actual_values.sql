-- ============================================
-- 设置实际原始分配值（基于图片中的真实数据）
-- 添加合规表述
-- ============================================

BEGIN TRANSACTION;

-- 更新为图片中显示的实际值
UPDATE node_levels SET 
  daily_reward_base = 0.27,
  example_daily_allocation = 0.27,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：0.27 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 1; -- Micro Node ($10, 0.1x)

UPDATE node_levels SET 
  daily_reward_base = 0.82,
  example_daily_allocation = 0.82,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：0.82 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 2; -- Mini Node ($25, 0.3x)

UPDATE node_levels SET 
  daily_reward_base = 1.36,
  example_daily_allocation = 1.36,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：1.36 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 3; -- Bronze Node ($50, 0.5x)

UPDATE node_levels SET 
  daily_reward_base = 2.72,
  example_daily_allocation = 2.72,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：2.72 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 4; -- Silver Node ($100, 1x)

UPDATE node_levels SET 
  daily_reward_base = 8.15,
  example_daily_allocation = 8.15,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：8.15 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 5; -- Gold Node ($250, 3x)

UPDATE node_levels SET 
  daily_reward_base = 19.01,
  example_daily_allocation = 19.01,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：19.01 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 6; -- Platinum Node ($500, 7x)

UPDATE node_levels SET 
  daily_reward_base = 40.75,
  example_daily_allocation = 40.75,
  allocation_variable = 1,
  allocation_disclaimer = '当前分配参数：40.75 EAGLE/天。此参数可能根据网络条件和代币经济学调整，不保证未来维持相同参数。'
WHERE id = 7; -- Diamond Node ($1000, 15x)

-- 记录审计日志
INSERT INTO compliance_audit_log (event_type, description)
VALUES (
  'ACTUAL_VALUES_SET',
  '设置实际原始分配参数（基于图片数据）。Micro: 0.27, Mini: 0.82, Bronze: 1.36, Silver: 2.72, Gold: 8.15, Platinum: 19.01, Diamond: 40.75 EAGLE/天。所有值标记为可变参数并添加合规免责声明。'
);

COMMIT;

SELECT '✅ 实际分配值已设置（带合规表述）' as status;
