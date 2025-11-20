-- ============================================
-- ADAPTIVE COMPLIANCE MIGRATION (SQLite)
-- ============================================
-- This script adapts to existing table structures
-- Date: 2025-11-09
-- ============================================

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

-- ============================================
-- 1. Update node_levels table (add compliant columns)
-- ============================================

-- Add new compliant columns if they don't exist
ALTER TABLE node_levels ADD COLUMN participation_weight INTEGER DEFAULT 0;
ALTER TABLE node_levels ADD COLUMN example_daily_allocation REAL DEFAULT 0;
ALTER TABLE node_levels ADD COLUMN allocation_variable INTEGER DEFAULT 1;
ALTER TABLE node_levels ADD COLUMN allocation_disclaimer TEXT DEFAULT 'Example allocation only. Actual allocations are variable and not guaranteed.';

-- Copy power to participation_weight if power exists
UPDATE node_levels SET participation_weight = power WHERE power IS NOT NULL;

-- Copy daily_reward to example_daily_allocation if it exists
UPDATE node_levels SET example_daily_allocation = daily_reward WHERE daily_reward IS NOT NULL;

-- ============================================
-- 2. Update user_nodes table (add compliant columns)
-- ============================================

ALTER TABLE user_nodes ADD COLUMN total_received REAL DEFAULT 0;
ALTER TABLE user_nodes ADD COLUMN pending_allocations REAL DEFAULT 0;
ALTER TABLE user_nodes ADD COLUMN claimed_allocations REAL DEFAULT 0;
ALTER TABLE user_nodes ADD COLUMN participation_active INTEGER DEFAULT 1;
ALTER TABLE user_nodes ADD COLUMN last_allocation_date TIMESTAMP;

-- Copy existing data to new columns
UPDATE user_nodes SET total_received = COALESCE(total_earned, 0) WHERE total_earned IS NOT NULL;
UPDATE user_nodes SET pending_allocations = COALESCE(pending_rewards, 0) WHERE pending_rewards IS NOT NULL;
UPDATE user_nodes SET claimed_allocations = COALESCE(claimed_rewards, 0) WHERE claimed_rewards IS NOT NULL;

-- ============================================
-- 3. Update communities table (add compliant columns)
-- ============================================

ALTER TABLE communities ADD COLUMN participation_parameter REAL DEFAULT 0;
ALTER TABLE communities ADD COLUMN leader_parameter REAL DEFAULT 0;
ALTER TABLE communities ADD COLUMN parameter_variable INTEGER DEFAULT 1;
ALTER TABLE communities ADD COLUMN parameter_disclaimer TEXT DEFAULT 'Parameters are variable and allocations are not guaranteed.';

-- Copy existing bonus data
UPDATE communities SET participation_parameter = COALESCE(bonus_rate, 0) WHERE bonus_rate IS NOT NULL;

-- ============================================
-- 4. Update swap_transactions table (add allocation column)
-- ============================================

ALTER TABLE swap_transactions ADD COLUMN eagle_allocation REAL DEFAULT 0;

-- Copy eagle_reward to eagle_allocation
UPDATE swap_transactions SET eagle_allocation = COALESCE(eagle_reward, 0) WHERE eagle_reward IS NOT NULL;

-- ============================================
-- 5. Update node_rewards table (add allocation columns)
-- ============================================

ALTER TABLE node_rewards ADD COLUMN allocation_amount REAL DEFAULT 0;
ALTER TABLE node_rewards ADD COLUMN allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.';

-- Copy reward_amount to allocation_amount
UPDATE node_rewards SET allocation_amount = COALESCE(reward_amount, 0) WHERE reward_amount IS NOT NULL;

-- ============================================
-- 6. Update referral_reward_details (add allocation columns)
-- ============================================

ALTER TABLE referral_reward_details ADD COLUMN allocation_amount TEXT DEFAULT '0';
ALTER TABLE referral_reward_details ADD COLUMN allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.';

-- Copy reward_amount to allocation_amount
UPDATE referral_reward_details SET allocation_amount = COALESCE(reward_amount, '0') WHERE reward_amount IS NOT NULL;

-- ============================================
-- 7. Update user_referral_rewards (rename conceptually)
-- ============================================

ALTER TABLE user_referral_rewards ADD COLUMN swap_total_received REAL DEFAULT 0;
ALTER TABLE user_referral_rewards ADD COLUMN allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.';

-- Copy swap_total_earned to swap_total_received
UPDATE user_referral_rewards SET swap_total_received = COALESCE(swap_total_earned, 0) WHERE swap_total_earned IS NOT NULL;

-- ============================================
-- 8. Update yearly_rewards table (add allocation columns)
-- ============================================

ALTER TABLE yearly_rewards ADD COLUMN example_daily_allocation REAL DEFAULT 0;
ALTER TABLE yearly_rewards ADD COLUMN allocation_variable INTEGER DEFAULT 1;

-- Copy daily_reward to example_daily_allocation
UPDATE yearly_rewards SET example_daily_allocation = COALESCE(daily_reward, 0) WHERE daily_reward IS NOT NULL;

-- ============================================
-- 9. Create compliance audit log
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

-- Log this migration
INSERT INTO compliance_audit_log (event_type, description)
VALUES (
  'TERMINOLOGY_UPDATE',
  'Added compliant terminology columns to existing tables. Original columns preserved for backward compatibility. Updated: node_levels, user_nodes, communities, swap_transactions, node_rewards, referral_reward_details, user_referral_rewards, yearly_rewards.'
);

-- ============================================
-- 10. Create views with compliant terminology
-- ============================================

-- Drop existing views if they exist
DROP VIEW IF EXISTS user_participation_summary;
DROP VIEW IF EXISTS daily_allocation_pool_view;

-- View: User participation summary
CREATE VIEW user_participation_summary AS
SELECT 
  un.wallet_address as user_address,
  COUNT(un.id) as active_access_count,
  SUM(nl.participation_weight) as total_participation_weight,
  SUM(un.total_received) as total_received_allocations,
  SUM(un.pending_allocations) as pending_allocations,
  MAX(un.last_allocation_date) as last_allocation_date
FROM user_nodes un
JOIN node_levels nl ON un.level = nl.level
WHERE un.participation_active = 1
GROUP BY un.wallet_address;

-- View: Node allocation summary (compliant naming)
CREATE VIEW IF NOT EXISTS node_allocation_summary AS
SELECT 
  nl.level,
  nl.name,
  nl.participation_weight,
  nl.example_daily_allocation,
  nl.allocation_disclaimer,
  COUNT(un.id) as active_count,
  SUM(un.total_received) as total_allocated
FROM node_levels nl
LEFT JOIN user_nodes un ON nl.level = un.level AND un.participation_active = 1
GROUP BY nl.level, nl.name, nl.participation_weight, nl.example_daily_allocation, nl.allocation_disclaimer;

-- ============================================
-- 11. Create indexes for new columns
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_nodes_participation_active 
  ON user_nodes(participation_active);

CREATE INDEX IF NOT EXISTS idx_user_nodes_wallet_address 
  ON user_nodes(wallet_address);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_event_type 
  ON compliance_audit_log(event_type);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_created_at 
  ON compliance_audit_log(created_at);

COMMIT;

PRAGMA foreign_keys=ON;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

SELECT 'Adaptive compliance migration completed successfully.' as message;
SELECT 'New compliant columns added to existing tables.' as message;
SELECT 'Original columns preserved for backward compatibility.' as message;
SELECT 'Views created with compliant terminology.' as message;
