-- ============================================
-- 安全的多链支持升级脚本
-- 会检查字段是否已存在，避免重复添加
-- ============================================

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

-- 插入支持的链（使用 INSERT OR REPLACE 避免重复）
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
-- 创建索引（IF NOT EXISTS 避免重复）
-- ============================================
CREATE INDEX IF NOT EXISTS idx_swap_tx_chain ON swap_transactions(chain_id);
CREATE INDEX IF NOT EXISTS idx_swap_tx_user_chain ON swap_transactions(user_address, chain_id);
CREATE INDEX IF NOT EXISTS idx_swap_rewards_chain ON swap_mining_rewards(chain_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_chain ON referral_rewards(chain_id);

-- ============================================
-- 多链统计视图
-- ============================================

-- 用户在各链上的交易统计
DROP VIEW IF EXISTS user_multichain_stats;

CREATE VIEW user_multichain_stats AS
SELECT 
    user_address,
    COALESCE(chain_id, 196) as chain_id,
    sc.chain_name,
    COUNT(*) as total_trades,
    SUM(trade_value_usdt) as total_volume_usdt,
    SUM(eagle_reward) as total_eagle_earned
FROM swap_transactions st
LEFT JOIN supported_chains sc ON COALESCE(st.chain_id, 196) = sc.chain_id
GROUP BY user_address, COALESCE(chain_id, 196);

-- 用户跨链总统计
DROP VIEW IF EXISTS user_total_stats;

CREATE VIEW user_total_stats AS
SELECT 
    user_address,
    COUNT(DISTINCT COALESCE(chain_id, 196)) as chains_used,
    COUNT(*) as total_trades,
    SUM(trade_value_usdt) as total_volume_usdt,
    SUM(eagle_reward) as total_eagle_earned
FROM swap_transactions
GROUP BY user_address;

-- 各链的平台统计
DROP VIEW IF EXISTS chain_platform_stats;

CREATE VIEW chain_platform_stats AS
SELECT 
    COALESCE(st.chain_id, 196) as chain_id,
    sc.chain_name,
    COUNT(DISTINCT st.user_address) as unique_users,
    COUNT(*) as total_trades,
    SUM(st.trade_value_usdt) as total_volume_usdt,
    SUM(st.eagle_reward) as total_eagle_distributed
FROM swap_transactions st
LEFT JOIN supported_chains sc ON COALESCE(st.chain_id, 196) = sc.chain_id
GROUP BY COALESCE(st.chain_id, 196);

-- ============================================
-- 完成
-- ============================================

SELECT '✅ 多链支持配置完成' as status;
