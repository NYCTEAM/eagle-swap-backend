-- NFT 用户等级系统
-- 用户等级 = 持有的最高等级 NFT（不叠加）

CREATE TABLE IF NOT EXISTS nft_user_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level INTEGER NOT NULL UNIQUE,
  nft_tier_name VARCHAR(50) NOT NULL,
  nft_tier_id INTEGER NOT NULL,
  boost_percentage INTEGER NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (nft_tier_id) REFERENCES nodes(id)
);

-- 插入 7 个等级，对应 7 个 NFT 等级
INSERT INTO nft_user_levels (level, nft_tier_name, nft_tier_id, boost_percentage, description) VALUES
(1, 'Micro', 1, 105, 'Level 1 - Own at least 1 Micro NFT'),
(2, 'Mini', 2, 120, 'Level 2 - Own at least 1 Mini NFT'),
(3, 'Bronze', 3, 135, 'Level 3 - Own at least 1 Bronze NFT'),
(4, 'Silver', 4, 150, 'Level 4 - Own at least 1 Silver NFT'),
(5, 'Gold', 5, 170, 'Level 5 - Own at least 1 Gold NFT'),
(6, 'Platinum', 6, 185, 'Level 6 - Own at least 1 Platinum NFT'),
(7, 'Diamond', 7, 200, 'Level 7 - Own at least 1 Diamond NFT');

CREATE INDEX IF NOT EXISTS idx_nft_user_levels_level ON nft_user_levels(level);
CREATE INDEX IF NOT EXISTS idx_nft_user_levels_tier ON nft_user_levels(nft_tier_id);

-- 用户 NFT 持有记录缓存表
CREATE TABLE IF NOT EXISTS user_nft_holdings (
  user_address VARCHAR(42) NOT NULL,
  nft_tier_id INTEGER NOT NULL,
  nft_tier_name VARCHAR(50) NOT NULL,
  nft_count INTEGER DEFAULT 1,
  highest_tier_level INTEGER NOT NULL,
  boost_percentage INTEGER NOT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_address, nft_tier_id),
  FOREIGN KEY (nft_tier_id) REFERENCES nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_user_nft_holdings_user ON user_nft_holdings(user_address);
CREATE INDEX IF NOT EXISTS idx_user_nft_holdings_tier ON user_nft_holdings(highest_tier_level);

-- 用户最高等级视图
CREATE VIEW IF NOT EXISTS user_highest_nft_level AS
SELECT 
  user_address,
  MAX(highest_tier_level) as user_level,
  MAX(boost_percentage) as boost_percentage
FROM user_nft_holdings
GROUP BY user_address;
