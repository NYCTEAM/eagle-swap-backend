-- 添加 claimed_chain_id 字段到 user_swap_stats 表
-- 用于记录用户首次领取奖励的链，防止跨链重复领取

-- 检查并添加 claimed_chain_id 字段
ALTER TABLE user_swap_stats ADD COLUMN claimed_chain_id INTEGER DEFAULT NULL;

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_user_swap_stats_chain ON user_swap_stats(claimed_chain_id);

-- 同样为 NFT Mining 添加 (如果需要)
-- ALTER TABLE nft_mining_claims ADD COLUMN claimed_chain_id INTEGER DEFAULT NULL;
