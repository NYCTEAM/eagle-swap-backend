-- 完整的 Swap 挖矿系统
-- VIP 等级（基于交易量）+ NFT 等级加成

-- 1. 更新 VIP 等级表（基于累计交易量）
DROP TABLE IF EXISTS vip_levels;
CREATE TABLE vip_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vip_level INTEGER NOT NULL UNIQUE,
  vip_name VARCHAR(50) NOT NULL,
  min_volume_usdt REAL NOT NULL,
  max_volume_usdt REAL,
  boost_percentage INTEGER NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO vip_levels (vip_level, vip_name, min_volume_usdt, max_volume_usdt, boost_percentage, description) VALUES
(0, 'VIP 0', 0, 9999.99, 100, 'Cumulative volume: $0 - $9,999'),
(1, 'VIP 1', 10000, 19999.99, 125, 'Cumulative volume: $10,000 - $19,999'),
(2, 'VIP 2', 20000, 34999.99, 150, 'Cumulative volume: $20,000 - $34,999'),
(3, 'VIP 3', 35000, 59999.99, 200, 'Cumulative volume: $35,000 - $59,999'),
(4, 'VIP 4', 60000, 99999.99, 250, 'Cumulative volume: $60,000 - $99,999'),
(5, 'VIP 5', 100000, NULL, 300, 'Cumulative volume: $100,000+');

CREATE INDEX IF NOT EXISTS idx_vip_levels_volume ON vip_levels(min_volume_usdt);

-- 2. 更新 NFT 等级加成（额外加成，不是倍数）
DROP TABLE IF EXISTS nft_level_bonus;
CREATE TABLE nft_level_bonus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nft_level INTEGER NOT NULL UNIQUE,
  nft_tier_name VARCHAR(50) NOT NULL,
  nft_tier_id INTEGER NOT NULL,
  bonus_percentage INTEGER NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (nft_tier_id) REFERENCES nodes(id)
);

INSERT INTO nft_level_bonus (nft_level, nft_tier_name, nft_tier_id, bonus_percentage, description) VALUES
(1, 'Micro', 1, 105, 'NFT Level 1 - Total boost: 105%'),
(2, 'Mini', 2, 120, 'NFT Level 2 - Total boost: 120%'),
(3, 'Bronze', 3, 135, 'NFT Level 3 - Total boost: 135%'),
(4, 'Silver', 4, 150, 'NFT Level 4 - Total boost: 150%'),
(5, 'Gold', 5, 170, 'NFT Level 5 - Total boost: 170%'),
(6, 'Platinum', 6, 185, 'NFT Level 6 - Total boost: 185%'),
(7, 'Diamond', 7, 250, 'NFT Level 7 - Total boost: 250%');

CREATE INDEX IF NOT EXISTS idx_nft_level_bonus_level ON nft_level_bonus(nft_level);

-- 3. Swap 挖矿配置表
DROP TABLE IF EXISTS swap_mining_config;
CREATE TABLE swap_mining_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_rate REAL NOT NULL,
  base_amount_usdt REAL NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO swap_mining_config (base_rate, base_amount_usdt, enabled) VALUES
(0.003, 100, 1);

-- 4. 用户 Swap 挖矿状态表
DROP TABLE IF EXISTS user_swap_mining_status;
CREATE TABLE user_swap_mining_status (
  user_address VARCHAR(42) PRIMARY KEY,
  cumulative_volume_usdt REAL DEFAULT 0,
  current_vip_level INTEGER DEFAULT 0,
  vip_boost_percentage INTEGER DEFAULT 100,
  highest_nft_level INTEGER DEFAULT 0,
  nft_bonus_percentage INTEGER DEFAULT 0,
  total_boost_percentage INTEGER DEFAULT 100,
  total_eagle_earned REAL DEFAULT 0,
  total_eagle_claimed REAL DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_swap_status_vip ON user_swap_mining_status(current_vip_level);
CREATE INDEX IF NOT EXISTS idx_user_swap_status_volume ON user_swap_mining_status(cumulative_volume_usdt);

-- 5. Swap 挖矿奖励计算示例视图
CREATE VIEW IF NOT EXISTS swap_mining_calculation_example AS
SELECT 
  v.vip_level,
  v.vip_name,
  v.boost_percentage as vip_boost,
  n.nft_level,
  n.nft_tier_name,
  n.bonus_percentage as nft_bonus,
  (v.boost_percentage + n.bonus_percentage) as total_boost,
  ROUND(0.003 * (v.boost_percentage + n.bonus_percentage) / 100, 6) as eagle_per_100_usdt
FROM vip_levels v
CROSS JOIN nft_level_bonus n
ORDER BY v.vip_level, n.nft_level;
