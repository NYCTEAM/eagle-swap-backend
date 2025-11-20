-- ============================================
-- 多链支持升级脚本
-- 添加 chain_id 字段支持多条 EVM 链
-- ============================================

-- 1. 为 swap_transactions 表添加 chain_id
ALTER TABLE swap_transactions ADD COLUMN chain_id INTEGER DEFAULT 196;

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_swap_tx_chain ON swap_transactions(chain_id);
CREATE INDEX IF NOT EXISTS idx_swap_tx_user_chain ON swap_transactions(user_address, chain_id);

-- 3. 为 swap_mining_rewards 表添加 chain_id
ALTER TABLE swap_mining_rewards ADD COLUMN chain_id INTEGER DEFAULT 196;
CREATE INDEX IF NOT EXISTS idx_swap_rewards_chain ON swap_mining_rewards(chain_id);

-- 4. 为 referral_rewards 表添加 chain_id
ALTER TABLE referral_rewards ADD COLUMN chain_id INTEGER DEFAULT 196;
CREATE INDEX IF NOT EXISTS idx_referral_rewards_chain ON referral_rewards(chain_id);

-- ============================================
-- 支持的链配置表
-- ============================================
CREATE TABLE IF NOT EXISTS supported_chains (
    chain_id INTEGER PRIMARY KEY,
    chain_name TEXT NOT NULL,
    native_token TEXT NOT NULL,
    rpc_url TEXT,
    explorer_url TEXT,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入支持的链
INSERT OR REPLACE INTO supported_chains (chain_id, chain_name, native_token, explorer_url, enabled) VALUES
(1, 'Ethereum', 'ETH', 'https://etherscan.io', 1),
(56, 'BNB Chain', 'BNB', 'https://bscscan.com', 1),
(137, 'Polygon', 'MATIC', 'https://polygonscan.com', 1),
(42161, 'Arbitrum', 'ETH', 'https://arbiscan.io', 1),
(10, 'Optimism', 'ETH', 'https://optimistic.etherscan.io', 1),
(43114, 'Avalanche', 'AVAX', 'https://snowtrace.io', 1),
(196, 'X Layer', 'OKB', 'https://www.oklink.com/xlayer', 1),
(8453, 'Base', 'ETH', 'https://basescan.org', 1),
(324, 'zkSync Era', 'ETH', 'https://explorer.zksync.io', 1),
(59144, 'Linea', 'ETH', 'https://lineascan.build', 1);

-- ============================================
-- 多链统计视图
-- ============================================

-- 用户在各链上的交易统计
DROP VIEW IF EXISTS user_multichain_stats;

CREATE VIEW user_multichain_stats AS
SELECT 
    user_address,
    chain_id,
    sc.chain_name,
    COUNT(*) as total_trades,
    SUM(trade_value_usdt) as total_volume_usdt,
    SUM(eagle_reward) as total_eagle_earned
FROM swap_transactions st
LEFT JOIN supported_chains sc ON st.chain_id = sc.chain_id
GROUP BY user_address, chain_id;

-- 用户跨链总统计
DROP VIEW IF EXISTS user_total_stats;

CREATE VIEW user_total_stats AS
SELECT 
    user_address,
    COUNT(DISTINCT chain_id) as chains_used,
    COUNT(*) as total_trades,
    SUM(trade_value_usdt) as total_volume_usdt,
    SUM(eagle_reward) as total_eagle_earned
FROM swap_transactions
GROUP BY user_address;

-- 各链的平台统计
DROP VIEW IF EXISTS chain_platform_stats;

CREATE VIEW chain_platform_stats AS
SELECT 
    st.chain_id,
    sc.chain_name,
    COUNT(DISTINCT st.user_address) as unique_users,
    COUNT(*) as total_trades,
    SUM(st.trade_value_usdt) as total_volume_usdt,
    SUM(st.eagle_reward) as total_eagle_distributed
FROM swap_transactions st
LEFT JOIN supported_chains sc ON st.chain_id = sc.chain_id
GROUP BY st.chain_id;

-- ============================================
-- 查询示例
-- ============================================

-- 查询用户在所有链上的统计
-- SELECT * FROM user_total_stats WHERE user_address = '0x...';

-- 查询用户在各链上的详细统计
-- SELECT * FROM user_multichain_stats WHERE user_address = '0x...';

-- 查询各链的平台统计
-- SELECT * FROM chain_platform_stats ORDER BY total_volume_usdt DESC;

-- 查询用户在特定链上的交易
-- SELECT * FROM swap_transactions WHERE user_address = '0x...' AND chain_id = 56;

-- ============================================
-- 完成
-- ============================================
