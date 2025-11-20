-- ============================================
-- 更新阶段奖励系数
-- 从 100%, 90%, 80%, 70%, 60%
-- 改为 100%, 95%, 90%, 85%, 80%
-- ============================================

BEGIN TRANSACTION;

-- 更新所有节点等级的阶段系数
-- Micro Node
UPDATE node_level_stages SET difficulty_multiplier = 1.00, description = 'Micro Stage 1 - 100% rewards' WHERE level_id = 1 AND stage = 1;
UPDATE node_level_stages SET difficulty_multiplier = 0.95, description = 'Micro Stage 2 - 95% rewards' WHERE level_id = 1 AND stage = 2;
UPDATE node_level_stages SET difficulty_multiplier = 0.90, description = 'Micro Stage 3 - 90% rewards' WHERE level_id = 1 AND stage = 3;
UPDATE node_level_stages SET difficulty_multiplier = 0.85, description = 'Micro Stage 4 - 85% rewards' WHERE level_id = 1 AND stage = 4;
UPDATE node_level_stages SET difficulty_multiplier = 0.80, description = 'Micro Stage 5 - 80% rewards' WHERE level_id = 1 AND stage = 5;

-- Mini Node
UPDATE node_level_stages SET difficulty_multiplier = 1.00, description = 'Mini Stage 1 - 100% rewards' WHERE level_id = 2 AND stage = 1;
UPDATE node_level_stages SET difficulty_multiplier = 0.95, description = 'Mini Stage 2 - 95% rewards' WHERE level_id = 2 AND stage = 2;
UPDATE node_level_stages SET difficulty_multiplier = 0.90, description = 'Mini Stage 3 - 90% rewards' WHERE level_id = 2 AND stage = 3;
UPDATE node_level_stages SET difficulty_multiplier = 0.85, description = 'Mini Stage 4 - 85% rewards' WHERE level_id = 2 AND stage = 4;
UPDATE node_level_stages SET difficulty_multiplier = 0.80, description = 'Mini Stage 5 - 80% rewards' WHERE level_id = 2 AND stage = 5;

-- Bronze Node
UPDATE node_level_stages SET difficulty_multiplier = 1.00, description = 'Bronze Stage 1 - 100% rewards' WHERE level_id = 3 AND stage = 1;
UPDATE node_level_stages SET difficulty_multiplier = 0.95, description = 'Bronze Stage 2 - 95% rewards' WHERE level_id = 3 AND stage = 2;
UPDATE node_level_stages SET difficulty_multiplier = 0.90, description = 'Bronze Stage 3 - 90% rewards' WHERE level_id = 3 AND stage = 3;
UPDATE node_level_stages SET difficulty_multiplier = 0.85, description = 'Bronze Stage 4 - 85% rewards' WHERE level_id = 3 AND stage = 4;
UPDATE node_level_stages SET difficulty_multiplier = 0.80, description = 'Bronze Stage 5 - 80% rewards' WHERE level_id = 3 AND stage = 5;

-- Silver Node
UPDATE node_level_stages SET difficulty_multiplier = 1.00, description = 'Silver Stage 1 - 100% rewards' WHERE level_id = 4 AND stage = 1;
UPDATE node_level_stages SET difficulty_multiplier = 0.95, description = 'Silver Stage 2 - 95% rewards' WHERE level_id = 4 AND stage = 2;
UPDATE node_level_stages SET difficulty_multiplier = 0.90, description = 'Silver Stage 3 - 90% rewards' WHERE level_id = 4 AND stage = 3;
UPDATE node_level_stages SET difficulty_multiplier = 0.85, description = 'Silver Stage 4 - 85% rewards' WHERE level_id = 4 AND stage = 4;
UPDATE node_level_stages SET difficulty_multiplier = 0.80, description = 'Silver Stage 5 - 80% rewards' WHERE level_id = 4 AND stage = 5;

-- Gold Node
UPDATE node_level_stages SET difficulty_multiplier = 1.00, description = 'Gold Stage 1 - 100% rewards' WHERE level_id = 5 AND stage = 1;
UPDATE node_level_stages SET difficulty_multiplier = 0.95, description = 'Gold Stage 2 - 95% rewards' WHERE level_id = 5 AND stage = 2;
UPDATE node_level_stages SET difficulty_multiplier = 0.90, description = 'Gold Stage 3 - 90% rewards' WHERE level_id = 5 AND stage = 3;
UPDATE node_level_stages SET difficulty_multiplier = 0.85, description = 'Gold Stage 4 - 85% rewards' WHERE level_id = 5 AND stage = 4;
UPDATE node_level_stages SET difficulty_multiplier = 0.80, description = 'Gold Stage 5 - 80% rewards' WHERE level_id = 5 AND stage = 5;

-- Platinum Node
UPDATE node_level_stages SET difficulty_multiplier = 1.00, description = 'Platinum Stage 1 - 100% rewards' WHERE level_id = 6 AND stage = 1;
UPDATE node_level_stages SET difficulty_multiplier = 0.95, description = 'Platinum Stage 2 - 95% rewards' WHERE level_id = 6 AND stage = 2;
UPDATE node_level_stages SET difficulty_multiplier = 0.90, description = 'Platinum Stage 3 - 90% rewards' WHERE level_id = 6 AND stage = 3;
UPDATE node_level_stages SET difficulty_multiplier = 0.85, description = 'Platinum Stage 4 - 85% rewards' WHERE level_id = 6 AND stage = 4;
UPDATE node_level_stages SET difficulty_multiplier = 0.80, description = 'Platinum Stage 5 - 80% rewards' WHERE level_id = 6 AND stage = 5;

-- Diamond Node
UPDATE node_level_stages SET difficulty_multiplier = 1.00, description = 'Diamond Stage 1 - 100% rewards' WHERE level_id = 7 AND stage = 1;
UPDATE node_level_stages SET difficulty_multiplier = 0.95, description = 'Diamond Stage 2 - 95% rewards' WHERE level_id = 7 AND stage = 2;
UPDATE node_level_stages SET difficulty_multiplier = 0.90, description = 'Diamond Stage 3 - 90% rewards' WHERE level_id = 7 AND stage = 3;
UPDATE node_level_stages SET difficulty_multiplier = 0.85, description = 'Diamond Stage 4 - 85% rewards' WHERE level_id = 7 AND stage = 4;
UPDATE node_level_stages SET difficulty_multiplier = 0.80, description = 'Diamond Stage 5 - 80% rewards' WHERE level_id = 7 AND stage = 5;

COMMIT;

-- 验证更新
SELECT 
    nl.name as node_name,
    nls.stage,
    nls.difficulty_multiplier,
    nls.description
FROM node_level_stages nls
JOIN node_levels nl ON nls.level_id = nl.id
ORDER BY nl.id, nls.stage;
