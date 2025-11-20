-- ============================================
-- COMPLIANCE MIGRATION: NFT Terminology Update
-- ============================================
-- Purpose: Update all "mining", "rewards", "earnings" terminology 
-- to compliant "access", "participation", "allocation" terminology
-- to avoid regulatory issues with investment/security implications
-- 
-- Date: 2025-11-09
-- ============================================

-- 1. Rename tables to use compliant terminology
-- ============================================

-- Rename node_mining_rewards to node_participation_allocations
ALTER TABLE node_mining_rewards RENAME TO node_participation_allocations;

-- Rename mining_statistics to participation_statistics  
ALTER TABLE mining_statistics RENAME TO participation_statistics;

-- 2. Update column names in node_participation_allocations
-- ============================================

-- Rename reward columns to allocation columns
ALTER TABLE node_participation_allocations 
  RENAME COLUMN reward_amount TO allocation_amount;

ALTER TABLE node_participation_allocations 
  RENAME COLUMN total_rewards TO total_allocations;

-- Add compliance disclaimer column
ALTER TABLE node_participation_allocations 
  ADD COLUMN IF NOT EXISTS allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed. Actual amounts depend on network conditions and participation.';

-- 3. Update column names in participation_statistics
-- ============================================

ALTER TABLE participation_statistics 
  RENAME COLUMN total_mining_power TO total_participation_weight;

ALTER TABLE participation_statistics 
  RENAME COLUMN daily_reward_pool TO daily_allocation_pool;

ALTER TABLE participation_statistics 
  RENAME COLUMN total_rewards_distributed TO total_allocations_distributed;

-- 4. Update node_levels table terminology
-- ============================================

-- Rename columns in node_levels
ALTER TABLE node_levels 
  RENAME COLUMN daily_reward TO example_daily_allocation;

ALTER TABLE node_levels 
  RENAME COLUMN power TO participation_weight;

-- Add compliance columns
ALTER TABLE node_levels 
  ADD COLUMN IF NOT EXISTS allocation_variable BOOLEAN DEFAULT TRUE;

ALTER TABLE node_levels 
  ADD COLUMN IF NOT EXISTS allocation_disclaimer TEXT DEFAULT 'Example allocation only. Actual allocations are variable and not guaranteed.';

-- 5. Update user_nodes table
-- ============================================

ALTER TABLE user_nodes 
  RENAME COLUMN total_earned TO total_received;

ALTER TABLE user_nodes 
  RENAME COLUMN pending_rewards TO pending_allocations;

-- Add compliance tracking
ALTER TABLE user_nodes 
  ADD COLUMN IF NOT EXISTS participation_active BOOLEAN DEFAULT TRUE;

ALTER TABLE user_nodes 
  ADD COLUMN IF NOT EXISTS last_allocation_date TIMESTAMP;

-- 6. Update yearly_rewards to yearly_allocation_schedule
-- ============================================

ALTER TABLE yearly_rewards RENAME TO yearly_allocation_schedule;

ALTER TABLE yearly_allocation_schedule 
  RENAME COLUMN daily_pool TO daily_allocation_pool;

ALTER TABLE yearly_allocation_schedule 
  RENAME COLUMN total_year_pool TO total_year_allocation_pool;

-- 7. Update swap_mining tables to swap_participation
-- ============================================

ALTER TABLE swap_mining_transactions RENAME TO swap_participation_transactions;

ALTER TABLE swap_mining_statistics RENAME TO swap_participation_statistics;

ALTER TABLE swap_mining_transactions 
  RENAME COLUMN eagle_reward TO eagle_allocation;

ALTER TABLE swap_participation_statistics 
  RENAME COLUMN total_eagle_earned TO total_eagle_received;

-- 8. Remove or update referral-related tables (compliance risk)
-- ============================================

-- Option A: Drop referral tables entirely (recommended for full compliance)
-- DROP TABLE IF EXISTS referral_rewards CASCADE;
-- DROP TABLE IF EXISTS referrer_levels CASCADE;
-- DROP TABLE IF EXISTS user_referrals CASCADE;

-- Option B: Rename and add disclaimers (if keeping referral system)
ALTER TABLE referral_rewards RENAME TO referral_allocations;
ALTER TABLE referral_allocations 
  RENAME COLUMN reward_amount TO allocation_amount;
ALTER TABLE referral_allocations 
  ADD COLUMN IF NOT EXISTS allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.';

-- 9. Update community tables
-- ============================================

ALTER TABLE communities 
  RENAME COLUMN mining_bonus TO participation_parameter;

ALTER TABLE communities 
  RENAME COLUMN leader_bonus TO leader_parameter;

-- Add compliance columns
ALTER TABLE communities 
  ADD COLUMN IF NOT EXISTS parameter_variable BOOLEAN DEFAULT TRUE;

ALTER TABLE communities 
  ADD COLUMN IF NOT EXISTS parameter_disclaimer TEXT DEFAULT 'Parameters are variable and allocations are not guaranteed.';

-- 10. Create views with compliant terminology
-- ============================================

-- View: User participation summary (replaces mining summary)
CREATE OR REPLACE VIEW user_participation_summary AS
SELECT 
  un.user_address,
  COUNT(un.id) as active_access_count,
  SUM(nl.participation_weight) as total_participation_weight,
  SUM(un.total_received) as total_received_allocations,
  SUM(un.pending_allocations) as pending_allocations,
  MAX(un.last_allocation_date) as last_allocation_date
FROM user_nodes un
JOIN node_levels nl ON un.level = nl.level
WHERE un.participation_active = TRUE
GROUP BY un.user_address;

-- View: Daily allocation pool (replaces daily reward pool)
CREATE OR REPLACE VIEW daily_allocation_pool_view AS
SELECT 
  yas.year,
  yas.daily_allocation_pool,
  ps.total_participation_weight,
  CASE 
    WHEN ps.total_participation_weight > 0 
    THEN yas.daily_allocation_pool / ps.total_participation_weight 
    ELSE 0 
  END as allocation_per_weight_unit
FROM yearly_allocation_schedule yas
CROSS JOIN participation_statistics ps
WHERE yas.year = EXTRACT(YEAR FROM CURRENT_DATE) - 2024 + 1;

-- 11. Update functions and triggers
-- ============================================

-- Drop old mining-related functions
DROP FUNCTION IF EXISTS calculate_daily_mining_rewards CASCADE;
DROP FUNCTION IF EXISTS distribute_mining_rewards CASCADE;

-- Create new participation allocation functions
CREATE OR REPLACE FUNCTION calculate_participation_allocations()
RETURNS void AS $$
DECLARE
  current_year INTEGER;
  daily_pool NUMERIC;
  total_weight NUMERIC;
  allocation_per_weight NUMERIC;
BEGIN
  -- Get current year (1-10)
  current_year := EXTRACT(YEAR FROM CURRENT_DATE) - 2024 + 1;
  
  -- Get daily allocation pool for current year
  SELECT daily_allocation_pool INTO daily_pool
  FROM yearly_allocation_schedule
  WHERE year = current_year;
  
  -- Get total participation weight
  SELECT total_participation_weight INTO total_weight
  FROM participation_statistics;
  
  -- Calculate allocation per weight unit
  IF total_weight > 0 THEN
    allocation_per_weight := daily_pool / total_weight;
  ELSE
    allocation_per_weight := 0;
  END IF;
  
  -- Update pending allocations for each active node
  UPDATE user_nodes un
  SET 
    pending_allocations = pending_allocations + (nl.participation_weight * allocation_per_weight),
    last_allocation_date = CURRENT_DATE
  FROM node_levels nl
  WHERE un.level = nl.level
    AND un.participation_active = TRUE;
    
END;
$$ LANGUAGE plpgsql;

-- 12. Add compliance notices to all allocation tables
-- ============================================

COMMENT ON TABLE node_participation_allocations IS 
'Participation allocations are variable and NOT guaranteed. Amounts depend on network conditions, total participation, and program parameters. This is NOT an investment return.';

COMMENT ON TABLE yearly_allocation_schedule IS 
'Example allocation schedule. Actual allocations are variable and may differ significantly. No guaranteed returns.';

COMMENT ON TABLE user_nodes IS 
'NFT nodes grant network participation rights ONLY. They are utility items, NOT investments. Allocations are variable and not guaranteed.';

COMMENT ON COLUMN user_nodes.total_received IS 
'Total variable allocations received. Past allocations do not guarantee future allocations.';

COMMENT ON COLUMN user_nodes.pending_allocations IS 
'Pending allocations are variable and not guaranteed until claimed.';

-- 13. Create compliance audit log
-- ============================================

CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  description TEXT,
  user_address VARCHAR(42),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE compliance_audit_log IS 
'Audit log for compliance-related changes and terminology updates.';

-- Log this migration
INSERT INTO compliance_audit_log (event_type, description)
VALUES (
  'TERMINOLOGY_MIGRATION',
  'Updated all NFT mining/rewards terminology to compliant access/participation/allocation terminology to avoid regulatory issues.'
);

-- 14. Update indexes for renamed tables
-- ============================================

-- Drop old indexes
DROP INDEX IF EXISTS idx_node_mining_rewards_user;
DROP INDEX IF EXISTS idx_mining_statistics_date;

-- Create new indexes with compliant names
CREATE INDEX IF NOT EXISTS idx_node_participation_allocations_user 
  ON node_participation_allocations(user_address);

CREATE INDEX IF NOT EXISTS idx_participation_statistics_date 
  ON participation_statistics(date);

CREATE INDEX IF NOT EXISTS idx_user_nodes_participation_active 
  ON user_nodes(participation_active);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Compliance migration completed successfully.';
  RAISE NOTICE 'All "mining/rewards" terminology updated to "participation/allocation" terminology.';
  RAISE NOTICE 'Please update application code to use new table and column names.';
  RAISE NOTICE 'IMPORTANT: Review all user-facing text to ensure compliance with new terminology.';
END $$;
