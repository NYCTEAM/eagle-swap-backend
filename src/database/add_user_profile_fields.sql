-- 添加用户资料字段
-- 用户名和头像

-- 检查并添加 username 字段
ALTER TABLE users ADD COLUMN username TEXT;

-- 检查并添加 avatar_url 字段
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- 创建用户资料视图
DROP VIEW IF EXISTS user_profiles;

CREATE VIEW user_profiles AS
SELECT 
  id,
  wallet_address,
  username,
  avatar_url,
  referral_code,
  referrer_level,
  swap_mining_bonus,
  referral_value,
  created_at
FROM users;
