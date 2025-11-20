-- ============================================
-- COMPLIANCE MIGRATION: NFT Terminology Update (SQLite Version)
-- ============================================
-- Purpose: Update all "mining", "rewards", "earnings" terminology 
-- to compliant "access", "participation", "allocation" terminology
-- 
-- Date: 2025-11-09
-- Database: SQLite
-- ============================================

-- SQLite doesn't support ALTER TABLE RENAME COLUMN directly in older versions
-- We need to use the recreate table approach

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

-- ============================================
-- 1. Rename node_mining_rewards to node_participation_allocations
-- ============================================

-- Create new table with compliant names
CREATE TABLE IF NOT EXISTS node_participation_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,
  node_id INTEGER,
  allocation_amount REAL DEFAULT 0,
  total_allocations REAL DEFAULT 0,
  allocation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending',
  allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed. Actual amounts depend on network conditions and participation.',
  FOREIGN KEY (node_id) REFERENCES user_nodes(id)
);

-- Copy data from old table if it exists
INSERT INTO node_participation_allocations (id, user_address, node_id, allocation_amount, total_allocations, allocation_date, status)
SELECT id, user_address, node_id, reward_amount, total_rewards, reward_date, status
FROM node_mining_rewards
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='node_mining_rewards');

-- Drop old table
DROP TABLE IF EXISTS node_mining_rewards;

-- ============================================
-- 2. Rename mining_statistics to participation_statistics
-- ============================================

CREATE TABLE IF NOT EXISTS participation_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE DEFAULT CURRENT_DATE,
  total_participation_weight REAL DEFAULT 0,
  daily_allocation_pool REAL DEFAULT 0,
  total_allocations_distributed REAL DEFAULT 0,
  active_participants INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table if it exists
INSERT INTO participation_statistics (id, date, total_participation_weight, daily_allocation_pool, total_allocations_distributed, active_participants, created_at)
SELECT id, date, total_mining_power, daily_reward_pool, total_rewards_distributed, active_miners, created_at
FROM mining_statistics
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='mining_statistics');

-- Drop old table
DROP TABLE IF EXISTS mining_statistics;

-- ============================================
-- 3. Update user_nodes table
-- ============================================

-- Create new user_nodes table with compliant columns
CREATE TABLE IF NOT EXISTS user_nodes_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  total_received REAL DEFAULT 0,
  pending_allocations REAL DEFAULT 0,
  claimed_allocations REAL DEFAULT 0,
  participation_active INTEGER DEFAULT 1,
  last_allocation_date TIMESTAMP,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  chain_id INTEGER DEFAULT 196
);

-- Copy data from old table
INSERT INTO user_nodes_new (id, user_address, token_id, level, total_received, pending_allocations, claimed_allocations, participation_active, purchased_at, chain_id)
SELECT id, user_address, token_id, level, 
       COALESCE(total_earned, 0), 
       COALESCE(pending_rewards, 0), 
       COALESCE(claimed_rewards, 0),
       1,
       purchased_at,
       COALESCE(chain_id, 196)
FROM user_nodes
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_nodes');

-- Drop old table and rename new one
DROP TABLE IF EXISTS user_nodes;
ALTER TABLE user_nodes_new RENAME TO user_nodes;

-- ============================================
-- 4. Update node_levels table
-- ============================================

CREATE TABLE IF NOT EXISTS node_levels_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  participation_weight INTEGER NOT NULL,
  example_daily_allocation REAL,
  multiplier REAL DEFAULT 1.0,
  max_supply INTEGER,
  current_supply INTEGER DEFAULT 0,
  allocation_variable INTEGER DEFAULT 1,
  allocation_disclaimer TEXT DEFAULT 'Example allocation only. Actual allocations are variable and not guaranteed.'
);

-- Copy data from old table
INSERT INTO node_levels_new (id, level, name, price, participation_weight, example_daily_allocation, multiplier, max_supply, current_supply, allocation_variable)
SELECT id, level, name, price, 
       COALESCE(power, 0),
       COALESCE(daily_reward, 0),
       COALESCE(multiplier, 1.0),
       max_supply,
       COALESCE(current_supply, 0),
       1
FROM node_levels
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='node_levels');

-- Drop old table and rename new one
DROP TABLE IF EXISTS node_levels;
ALTER TABLE node_levels_new RENAME TO node_levels;

-- ============================================
-- 5. Update yearly_rewards to yearly_allocation_schedule
-- ============================================

CREATE TABLE IF NOT EXISTS yearly_allocation_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER UNIQUE NOT NULL,
  daily_allocation_pool REAL NOT NULL,
  total_year_allocation_pool REAL NOT NULL,
  start_date DATE,
  end_date DATE
);

-- Copy data from old table if it exists
INSERT INTO yearly_allocation_schedule (id, year, daily_allocation_pool, total_year_allocation_pool, start_date, end_date)
SELECT id, year, daily_pool, total_year_pool, start_date, end_date
FROM yearly_rewards
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='yearly_rewards');

-- Drop old table
DROP TABLE IF EXISTS yearly_rewards;

-- ============================================
-- 6. Update swap_mining tables to swap_participation
-- ============================================

CREATE TABLE IF NOT EXISTS swap_participation_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  from_token TEXT NOT NULL,
  to_token TEXT NOT NULL,
  trade_value_usdt REAL NOT NULL,
  fee_usdt REAL NOT NULL,
  eagle_allocation REAL DEFAULT 0,
  chain_id INTEGER DEFAULT 196,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table if it exists
INSERT INTO swap_participation_transactions (id, user_address, tx_hash, from_token, to_token, trade_value_usdt, fee_usdt, eagle_allocation, chain_id, timestamp)
SELECT id, user_address, tx_hash, from_token, to_token, trade_value_usdt, fee_usdt, eagle_reward, chain_id, timestamp
FROM swap_mining_transactions
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='swap_mining_transactions');

-- Drop old table
DROP TABLE IF EXISTS swap_mining_transactions;

-- Create swap_participation_statistics
CREATE TABLE IF NOT EXISTS swap_participation_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT UNIQUE NOT NULL,
  total_trades INTEGER DEFAULT 0,
  total_volume_usdt REAL DEFAULT 0,
  total_fee_paid REAL DEFAULT 0,
  total_eagle_received REAL DEFAULT 0,
  total_eagle_claimed REAL DEFAULT 0,
  tier_name TEXT DEFAULT 'Bronze',
  tier_multiplier REAL DEFAULT 1.0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table if it exists
INSERT INTO swap_participation_statistics (id, user_address, total_trades, total_volume_usdt, total_fee_paid, total_eagle_received, total_eagle_claimed, tier_name, tier_multiplier, last_updated)
SELECT id, user_address, total_trades, total_volume_usdt, total_fee_paid, total_eagle_earned, total_eagle_claimed, tier_name, tier_multiplier, last_updated
FROM swap_mining_statistics
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='swap_mining_statistics');

-- Drop old table
DROP TABLE IF EXISTS swap_mining_statistics;

-- ============================================
-- 7. Update communities table
-- ============================================

CREATE TABLE IF NOT EXISTS communities_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  leader_address TEXT NOT NULL,
  total_value REAL DEFAULT 0,
  member_count INTEGER DEFAULT 0,
  participation_parameter REAL DEFAULT 0,
  leader_parameter REAL DEFAULT 0,
  parameter_variable INTEGER DEFAULT 1,
  parameter_disclaimer TEXT DEFAULT 'Parameters are variable and allocations are not guaranteed.',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table
INSERT INTO communities_new (id, code, name, leader_address, total_value, member_count, participation_parameter, leader_parameter, parameter_variable, created_at)
SELECT id, code, name, leader_address, total_value, member_count,
       COALESCE(mining_bonus, 0),
       COALESCE(leader_bonus, 0),
       1,
       created_at
FROM communities
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='communities');

-- Drop old table and rename new one
DROP TABLE IF EXISTS communities;
ALTER TABLE communities_new RENAME TO communities;

-- ============================================
-- 8. Handle referral tables (Option: Rename with disclaimers)
-- ============================================

-- Option A: Drop referral tables (uncomment if you want to remove them)
-- DROP TABLE IF EXISTS referral_rewards;
-- DROP TABLE IF EXISTS referrer_levels;
-- DROP TABLE IF EXISTS user_referrals;

-- Option B: Rename referral_rewards to referral_allocations
CREATE TABLE IF NOT EXISTS referral_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_address TEXT NOT NULL,
  referee_address TEXT NOT NULL,
  allocation_type TEXT NOT NULL,
  allocation_amount REAL NOT NULL,
  allocation_usd REAL,
  status TEXT DEFAULT 'pending',
  allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table if it exists
INSERT INTO referral_allocations (id, referrer_address, referee_address, allocation_type, allocation_amount, allocation_usd, status, timestamp)
SELECT id, referrer_address, referee_address, reward_type, reward_amount, reward_usd, status, timestamp
FROM referral_rewards
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='referral_rewards');

-- Drop old table
DROP TABLE IF EXISTS referral_rewards;

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
  'TERMINOLOGY_MIGRATION',
  'Updated all NFT mining/rewards terminology to compliant access/participation/allocation terminology to avoid regulatory issues. SQLite version.'
);

-- ============================================
-- 10. Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_node_participation_allocations_user 
  ON node_participation_allocations(user_address);

CREATE INDEX IF NOT EXISTS idx_participation_statistics_date 
  ON participation_statistics(date);

CREATE INDEX IF NOT EXISTS idx_user_nodes_participation_active 
  ON user_nodes(participation_active);

CREATE INDEX IF NOT EXISTS idx_user_nodes_address 
  ON user_nodes(user_address);

CREATE INDEX IF NOT EXISTS idx_swap_participation_transactions_user 
  ON swap_participation_transactions(user_address);

CREATE INDEX IF NOT EXISTS idx_swap_participation_transactions_hash 
  ON swap_participation_transactions(tx_hash);

-- ============================================
-- 11. Create views with compliant terminology
-- ============================================

-- View: User participation summary
CREATE VIEW IF NOT EXISTS user_participation_summary AS
SELECT 
  un.user_address,
  COUNT(un.id) as active_access_count,
  SUM(nl.participation_weight) as total_participation_weight,
  SUM(un.total_received) as total_received_allocations,
  SUM(un.pending_allocations) as pending_allocations,
  MAX(un.last_allocation_date) as last_allocation_date
FROM user_nodes un
JOIN node_levels nl ON un.level = nl.level
WHERE un.participation_active = 1
GROUP BY un.user_address;

-- View: Daily allocation pool
CREATE VIEW IF NOT EXISTS daily_allocation_pool_view AS
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
WHERE yas.year = CAST(strftime('%Y', 'now') AS INTEGER) - 2024 + 1;

COMMIT;

PRAGMA foreign_keys=ON;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

SELECT 'Compliance migration completed successfully.' as message;
SELECT 'All "mining/rewards" terminology updated to "participation/allocation" terminology.' as message;
SELECT 'Please update application code to use new table and column names.' as message;
