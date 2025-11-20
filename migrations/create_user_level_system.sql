-- 用户等级系统表
-- User Level System for Swap Mining Boost

CREATE TABLE IF NOT EXISTS user_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level INTEGER NOT NULL UNIQUE,
  level_name VARCHAR(50) NOT NULL,
  min_nft_count INTEGER NOT NULL,
  min_total_weight REAL NOT NULL,
  boost_percentage INTEGER NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入等级数据
-- Level 1-5 基于 NFT 持有数量和总权重
INSERT INTO user_levels (level, level_name, min_nft_count, min_total_weight, boost_percentage, description) VALUES
(1, 'Bronze', 1, 0.1, 105, 'Entry level - Own at least 1 NFT'),
(2, 'Silver', 2, 0.5, 120, 'Silver level - Own at least 2 NFTs with 0.5+ total weight'),
(3, 'Gold', 3, 1.5, 150, 'Gold level - Own at least 3 NFTs with 1.5+ total weight'),
(4, 'Platinum', 5, 5.0, 180, 'Platinum level - Own at least 5 NFTs with 5.0+ total weight'),
(5, 'Diamond', 7, 15.0, 200, 'Diamond level - Own at least 7 NFTs with 15.0+ total weight');

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_levels_level ON user_levels(level);
CREATE INDEX IF NOT EXISTS idx_user_levels_min_weight ON user_levels(min_total_weight);

-- 用户等级缓存表（存储每个用户当前的等级）
CREATE TABLE IF NOT EXISTS user_level_cache (
  user_address VARCHAR(42) PRIMARY KEY,
  current_level INTEGER NOT NULL,
  nft_count INTEGER NOT NULL,
  total_weight REAL NOT NULL,
  boost_percentage INTEGER NOT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (current_level) REFERENCES user_levels(level)
);

CREATE INDEX IF NOT EXISTS idx_user_level_cache_level ON user_level_cache(current_level);
CREATE INDEX IF NOT EXISTS idx_user_level_cache_updated ON user_level_cache(last_updated);

-- Swap 挖矿记录表
CREATE TABLE IF NOT EXISTS swap_mining_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address VARCHAR(42) NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL,
  swap_amount_usd REAL NOT NULL,
  user_level INTEGER NOT NULL,
  boost_percentage INTEGER NOT NULL,
  base_reward REAL NOT NULL,
  boosted_reward REAL NOT NULL,
  claimed BOOLEAN DEFAULT 0,
  claimed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_swap_mining_user ON swap_mining_records(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_mining_tx ON swap_mining_records(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_swap_mining_chain ON swap_mining_records(chain_id);
CREATE INDEX IF NOT EXISTS idx_swap_mining_claimed ON swap_mining_records(claimed);
CREATE INDEX IF NOT EXISTS idx_swap_mining_created ON swap_mining_records(created_at);
