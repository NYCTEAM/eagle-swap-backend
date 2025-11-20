-- ============================================
-- CORRECT COMPLIANCE MIGRATION (Based on actual DB structure)
-- ============================================
-- Date: 2025-11-09
-- Database: SQLite
-- ============================================

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

-- ============================================
-- 1. Update node_levels table (actual structure)
-- ============================================
-- Columns: id, level, name, price, daily_reward, power, multiplier, max_supply, current_supply

ALTER TABLE node_levels ADD COLUMN participation_weight REAL DEFAULT 0;
ALTER TABLE node_levels ADD COLUMN example_daily_allocation REAL DEFAULT 0;
ALTER TABLE node_levels ADD COLUMN allocation_variable INTEGER DEFAULT 1;
ALTER TABLE node_levels ADD COLUMN allocation_disclaimer TEXT DEFAULT 'Example allocation only. Actual allocations are variable and not guaranteed.';

-- Copy existing data to new columns
UPDATE node_levels SET participation_weight = COALESCE(power, 0);
UPDATE node_levels SET example_daily_allocation = COALESCE(daily_reward, 0);
UPDATE node_levels SET allocation_variable = 1;

-- ============================================
-- 2. Update nodes table (user's NFT nodes)
-- ============================================
-- Columns: id, wallet_address, token_id, level, total_earned, pending_rewards, claimed_rewards, purchased_at, chain_id

ALTER TABLE nodes ADD COLUMN total_received REAL DEFAULT 0;
ALTER TABLE nodes ADD COLUMN pending_allocations REAL DEFAULT 0;
ALTER TABLE nodes ADD COLUMN claimed_allocations REAL DEFAULT 0;
ALTER TABLE nodes ADD COLUMN participation_active INTEGER DEFAULT 1;
ALTER TABLE nodes ADD COLUMN last_allocation_date TIMESTAMP;

-- Copy existing data
UPDATE nodes SET total_received = COALESCE(total_earned, 0);
UPDATE nodes SET pending_allocations = COALESCE(pending_rewards, 0);
UPDATE nodes SET claimed_allocations = COALESCE(claimed_rewards, 0);
UPDATE nodes SET participation_active = 1;

-- ============================================
-- 3. Update communities table
-- ============================================

ALTER TABLE communities ADD COLUMN participation_parameter REAL DEFAULT 0;
ALTER TABLE communities ADD COLUMN parameter_variable INTEGER DEFAULT 1;
ALTER TABLE communities ADD COLUMN parameter_disclaimer TEXT DEFAULT 'Parameters are variable and allocations are not guaranteed.';

-- Copy bonus_rate to participation_parameter if it exists
UPDATE communities SET participation_parameter = COALESCE(bonus_rate, 0) WHERE bonus_rate IS NOT NULL;

-- ============================================
-- 4. Update swap_transactions table
-- ============================================

ALTER TABLE swap_transactions ADD COLUMN eagle_allocation REAL DEFAULT 0;

-- Copy eagle_reward to eagle_allocation
UPDATE swap_transactions SET eagle_allocation = COALESCE(eagle_reward, 0) WHERE eagle_reward IS NOT NULL;

-- ============================================
-- 5. Update node_mining_rewards table
-- ============================================

ALTER TABLE node_mining_rewards ADD COLUMN allocation_amount REAL DEFAULT 0;
ALTER TABLE node_mining_rewards ADD COLUMN allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.';

-- Copy reward_amount to allocation_amount
UPDATE node_mining_rewards SET allocation_amount = COALESCE(reward_amount, 0) WHERE reward_amount IS NOT NULL;

-- ============================================
-- 6. Update referral_reward_details table
-- ============================================

ALTER TABLE referral_reward_details ADD COLUMN allocation_amount TEXT DEFAULT '0';
ALTER TABLE referral_reward_details ADD COLUMN allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.';

-- Copy reward_amount
UPDATE referral_reward_details SET allocation_amount = COALESCE(reward_amount, '0') WHERE reward_amount IS NOT NULL;

-- ============================================
-- 7. Update user_referral_rewards table
-- ============================================

ALTER TABLE user_referral_rewards ADD COLUMN swap_total_received REAL DEFAULT 0;
ALTER TABLE user_referral_rewards ADD COLUMN allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.';

-- Copy swap_total_earned
UPDATE user_referral_rewards SET swap_total_received = COALESCE(swap_total_earned, 0) WHERE swap_total_earned IS NOT NULL;

-- ============================================
-- 8. Create compliance_audit_log table
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
  'Added compliant terminology columns. Tables updated: node_levels, nodes, communities, swap_transactions, node_mining_rewards, referral_reward_details, user_referral_rewards. Original columns preserved for backward compatibility.'
);

-- ============================================
-- 9. Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_nodes_participation_active ON nodes(participation_active);
CREATE INDEX IF NOT EXISTS idx_nodes_wallet_address ON nodes(wallet_address);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_event_type ON compliance_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_created_at ON compliance_audit_log(created_at);

-- ============================================
-- 10. Create compliant views
-- ============================================

DROP VIEW IF EXISTS user_participation_summary;
DROP VIEW IF EXISTS node_allocation_summary;

-- View: User participation summary
CREATE VIEW user_participation_summary AS
SELECT 
  n.wallet_address as user_address,
  COUNT(n.id) as active_access_count,
  SUM(nl.participation_weight) as total_participation_weight,
  SUM(n.total_received) as total_received_allocations,
  SUM(n.pending_allocations) as pending_allocations,
  MAX(n.last_allocation_date) as last_allocation_date
FROM nodes n
JOIN node_levels nl ON n.level = nl.level
WHERE n.participation_active = 1
GROUP BY n.wallet_address;

-- View: Node allocation summary
CREATE VIEW node_allocation_summary AS
SELECT 
  nl.level,
  nl.name,
  nl.participation_weight,
  nl.example_daily_allocation,
  nl.allocation_disclaimer,
  nl.allocation_variable,
  COUNT(n.id) as active_count,
  SUM(n.total_received) as total_allocated
FROM node_levels nl
LEFT JOIN nodes n ON nl.level = n.level AND n.participation_active = 1
GROUP BY nl.level, nl.name, nl.participation_weight, nl.example_daily_allocation, nl.allocation_disclaimer, nl.allocation_variable;

COMMIT;

PRAGMA foreign_keys=ON;

SELECT 'Correct compliance migration completed successfully!' as status;
