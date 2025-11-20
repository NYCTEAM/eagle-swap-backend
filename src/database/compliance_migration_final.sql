-- ============================================
-- FINAL COMPLIANCE MIGRATION (SQLite)
-- Based on actual database structure inspection
-- ============================================

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

-- ============================================
-- 1. Update node_levels table
-- ============================================

ALTER TABLE node_levels ADD COLUMN participation_weight INTEGER DEFAULT 0;
ALTER TABLE node_levels ADD COLUMN example_daily_allocation REAL DEFAULT 0;
ALTER TABLE node_levels ADD COLUMN allocation_variable INTEGER DEFAULT 1;
ALTER TABLE node_levels ADD COLUMN allocation_disclaimer TEXT DEFAULT 'Example allocation only. Actual allocations are variable and not guaranteed.';

UPDATE node_levels SET participation_weight = COALESCE(power, 0);
UPDATE node_levels SET example_daily_allocation = COALESCE(daily_reward, 0);

-- ============================================
-- 2. Update nft_nodes table (actual table name)
-- ============================================

ALTER TABLE nft_nodes ADD COLUMN total_received REAL DEFAULT 0;
ALTER TABLE nft_nodes ADD COLUMN pending_allocations REAL DEFAULT 0;
ALTER TABLE nft_nodes ADD COLUMN claimed_allocations REAL DEFAULT 0;
ALTER TABLE nft_nodes ADD COLUMN participation_active INTEGER DEFAULT 1;
ALTER TABLE nft_nodes ADD COLUMN last_allocation_date TIMESTAMP;

UPDATE nft_nodes SET total_received = COALESCE(total_earned, 0);
UPDATE nft_nodes SET pending_allocations = COALESCE(pending_rewards, 0);
UPDATE nft_nodes SET participation_active = 1;

-- ============================================
-- 3. Update communities table
-- ============================================

ALTER TABLE communities ADD COLUMN participation_parameter REAL DEFAULT 0;
ALTER TABLE communities ADD COLUMN leader_parameter REAL DEFAULT 0;
ALTER TABLE communities ADD COLUMN parameter_variable INTEGER DEFAULT 1;
ALTER TABLE communities ADD COLUMN parameter_disclaimer TEXT DEFAULT 'Parameters are variable and allocations are not guaranteed.';

UPDATE communities SET participation_parameter = COALESCE(bonus_rate, 0);

-- ============================================
-- 4. Update swap_transactions table
-- ============================================

ALTER TABLE swap_transactions ADD COLUMN eagle_allocation REAL DEFAULT 0;

UPDATE swap_transactions SET eagle_allocation = COALESCE(eagle_reward, 0);

-- ============================================
-- 5. Update referral_reward_details table
-- ============================================

ALTER TABLE referral_reward_details ADD COLUMN allocation_amount TEXT DEFAULT '0';
ALTER TABLE referral_reward_details ADD COLUMN allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.';

UPDATE referral_reward_details SET allocation_amount = COALESCE(reward_amount, '0');

-- ============================================
-- 6. Update user_referral_rewards table
-- ============================================

ALTER TABLE user_referral_rewards ADD COLUMN swap_total_received REAL DEFAULT 0;
ALTER TABLE user_referral_rewards ADD COLUMN allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.';

UPDATE user_referral_rewards SET swap_total_received = COALESCE(swap_total_earned, 0);

-- ============================================
-- 7. Update yearly_rewards table
-- ============================================

ALTER TABLE yearly_rewards ADD COLUMN example_daily_allocation REAL DEFAULT 0;
ALTER TABLE yearly_rewards ADD COLUMN allocation_variable INTEGER DEFAULT 1;

UPDATE yearly_rewards SET example_daily_allocation = COALESCE(daily_reward, 0);

-- ============================================
-- 8. Create compliance audit log
-- ============================================

CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  description TEXT,
  user_address TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO compliance_audit_log (event_type, description)
VALUES (
  'TERMINOLOGY_UPDATE',
  'Added compliant terminology columns. Tables updated: node_levels, nft_nodes, communities, swap_transactions, referral_reward_details, user_referral_rewards, yearly_rewards. Original columns preserved for backward compatibility.'
);

-- ============================================
-- 9. Create indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_nft_nodes_participation_active ON nft_nodes(participation_active);
CREATE INDEX IF NOT EXISTS idx_nft_nodes_wallet_address ON nft_nodes(wallet_address);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_event_type ON compliance_audit_log(event_type);

-- ============================================
-- 10. Create compliant views
-- ============================================

DROP VIEW IF EXISTS user_participation_summary;
DROP VIEW IF EXISTS node_allocation_summary;

CREATE VIEW user_participation_summary AS
SELECT 
  nn.wallet_address as user_address,
  COUNT(nn.id) as active_access_count,
  SUM(nl.participation_weight) as total_participation_weight,
  SUM(nn.total_received) as total_received_allocations,
  SUM(nn.pending_allocations) as pending_allocations,
  MAX(nn.last_allocation_date) as last_allocation_date
FROM nft_nodes nn
JOIN node_levels nl ON nn.level = nl.level
WHERE nn.participation_active = 1
GROUP BY nn.wallet_address;

CREATE VIEW node_allocation_summary AS
SELECT 
  nl.level,
  nl.name,
  nl.participation_weight,
  nl.example_daily_allocation,
  nl.allocation_disclaimer,
  COUNT(nn.id) as active_count,
  SUM(nn.total_received) as total_allocated
FROM node_levels nl
LEFT JOIN nft_nodes nn ON nl.level = nn.level AND nn.participation_active = 1
GROUP BY nl.level;

COMMIT;

PRAGMA foreign_keys=ON;

SELECT 'Final compliance migration completed successfully!' as status;
