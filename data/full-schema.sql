-- Eagle Swap Database Schema
-- Generated: 2025-11-20T21:34:04.971Z

CREATE TABLE admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    action TEXT NOT NULL,  -- 'create_user', 'update_community', 'change_leader', etc.
    target_type TEXT,  -- 'user', 'community', 'node', etc.
    target_id TEXT,
    details TEXT,  -- JSON 格式的详细信息
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id)
);

CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT DEFAULT 'admin',  -- 'super_admin', 'admin', 'operator'
    permissions TEXT,  -- JSON 格式的权限列表
    is_active BOOLEAN DEFAULT 1,
    last_login_at DATETIME,
    last_login_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE allocation_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE communities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_name TEXT NOT NULL,
    leader_address TEXT NOT NULL,
    community_code TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    total_value REAL DEFAULT 0,
    total_members INTEGER DEFAULT 0,
    community_level INTEGER DEFAULT 1,
    bonus_rate REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, leader_parameter REAL DEFAULT 0, parameter_variable INTEGER DEFAULT 1, parameter_disclaimer TEXT DEFAULT 'Parameters are variable and allocations are not guaranteed.');

CREATE TABLE community_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_address TEXT NOT NULL,
    old_community_id INTEGER,
    new_community_id INTEGER,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
, leave_reason TEXT, is_forced BOOLEAN DEFAULT 0);

CREATE TABLE community_creation_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_address TEXT NOT NULL,
    community_name TEXT NOT NULL,
    community_code TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    creation_type TEXT NOT NULL, -- 'nft_holder' 或 'voting'
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
    required_votes INTEGER DEFAULT 50, -- 需要的投票数
    current_votes INTEGER DEFAULT 0, -- 当前投票数
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    completed_at DATETIME,
    CHECK (creation_type IN ('nft_holder', 'voting')),
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed'))
);

CREATE TABLE community_creation_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    voter_address TEXT NOT NULL,
    vote_weight REAL DEFAULT 1.0, -- 投票权重（基于 NFT 等级）
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES community_creation_requests(id),
    UNIQUE(request_id, voter_address)
);

CREATE TABLE community_level_config (
    level INTEGER PRIMARY KEY,
    level_name TEXT NOT NULL,
    min_value REAL NOT NULL,
    member_bonus_rate REAL NOT NULL,
    leader_bonus_rate REAL NOT NULL,
    description TEXT
);

CREATE TABLE community_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL,
    member_address TEXT NOT NULL,
    node_value REAL DEFAULT 0,
    is_leader BOOLEAN DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, can_leave_at DATETIME,
    FOREIGN KEY (community_id) REFERENCES communities(id),
    UNIQUE(member_address)
);

CREATE TABLE community_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_date DATE NOT NULL,
    community_id INTEGER NOT NULL,
    total_members INTEGER DEFAULT 0,
    total_value REAL DEFAULT 0,
    community_level INTEGER DEFAULT 1,
    leader_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (community_id) REFERENCES communities(id)
);

CREATE TABLE compliance_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  description TEXT,
  user_address TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE config_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    config_key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id)
);

CREATE TABLE daily_swap_stats (
    stat_date TEXT PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    total_volume_usdt REAL DEFAULT 0,
    total_fee_collected REAL DEFAULT 0,
    total_eagle_distributed REAL DEFAULT 0,
    unique_traders INTEGER DEFAULT 0
  );

CREATE TABLE farms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_address TEXT UNIQUE NOT NULL,
  lp_token_address TEXT NOT NULL,
  reward_token_address TEXT NOT NULL,
  alloc_point INTEGER NOT NULL DEFAULT 0,
  total_staked TEXT NOT NULL DEFAULT '0',
  reward_per_block TEXT NOT NULL DEFAULT '0',
  start_block INTEGER NOT NULL,
  end_block INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lp_token_address) REFERENCES trading_pairs(pair_address),
  FOREIGN KEY (reward_token_address) REFERENCES tokens(address)
);

CREATE TABLE impeachment_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL,
    leader_address TEXT NOT NULL,
    impeachment_id INTEGER NOT NULL,
    impeached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ban_until DATETIME,
    FOREIGN KEY (community_id) REFERENCES communities(id),
    FOREIGN KEY (impeachment_id) REFERENCES impeachment_votes(id)
);

CREATE TABLE impeachment_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL,
    target_leader_address TEXT NOT NULL,
    initiator_address TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'active',
    total_votes_for REAL DEFAULT 0,
    total_votes_against REAL DEFAULT 0,
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (community_id) REFERENCES communities(id)
);

CREATE TABLE limit_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE, -- 链上订单ID
  user_address TEXT NOT NULL,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  amount_in TEXT NOT NULL,
  min_amount_out TEXT NOT NULL,
  limit_price TEXT NOT NULL, -- 18位精度
  expiry_time INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'filled', 'cancelled', 'expired'
  created_tx_hash TEXT,
  filled_tx_hash TEXT,
  filled_amount_out TEXT,
  filled_at_timestamp INTEGER,
  executor_address TEXT,
  executor_reward TEXT,
  platform_fee TEXT,
  created_at_timestamp INTEGER NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE liquidity_mining (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    pool_address TEXT NOT NULL,
    lp_amount REAL NOT NULL,
    staked_at DATETIME NOT NULL,
    unstaked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE liquidity_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,
  pair_address TEXT NOT NULL,
  lp_token_amount TEXT NOT NULL,
  token_a_amount TEXT NOT NULL,
  token_b_amount TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pair_address) REFERENCES trading_pairs(pair_address)
);

CREATE TABLE liquidity_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    reward_date DATE NOT NULL,
    lp_amount REAL NOT NULL,
    reward_amount REAL NOT NULL,
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE nft_multipliers (
    level INTEGER PRIMARY KEY,
    level_name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    swap_multiplier REAL NOT NULL,
    referral_multiplier REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nft_tier_privileges (
    tier_id INTEGER PRIMARY KEY,
    tier_name TEXT NOT NULL,
    can_create_community BOOLEAN DEFAULT 0,
    vote_weight REAL DEFAULT 1.0,
    description TEXT
);

CREATE TABLE node_level_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level_id INTEGER NOT NULL,
    stage INTEGER NOT NULL,
    stage_supply INTEGER NOT NULL,
    stage_minted INTEGER DEFAULT 0,
    difficulty_multiplier REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (level_id) REFERENCES node_levels(id),
    UNIQUE(level_id, stage)
);

CREATE TABLE node_levels (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    price_usdt REAL NOT NULL,
    power REAL NOT NULL,
    max_supply INTEGER NOT NULL,
    minted INTEGER DEFAULT 0,
    daily_reward_base REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, example_daily_allocation REAL DEFAULT 0, allocation_variable INTEGER DEFAULT 1, allocation_disclaimer TEXT DEFAULT 'Example allocation only. Actual allocations are variable and not guaranteed.');

CREATE TABLE node_mining_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL,
    owner_address TEXT NOT NULL,
    reward_date DATE NOT NULL,
    daily_pool REAL NOT NULL,             -- 当日奖励池
    node_power REAL NOT NULL,             -- 节点算力
    total_power REAL NOT NULL,            -- 全网算力
    difficulty_multiplier REAL NOT NULL,  -- 难度系数
    reward_amount REAL NOT NULL,          -- 奖励金额
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.',
    FOREIGN KEY (token_id) REFERENCES nodes(token_id)
);

CREATE TABLE node_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_address TEXT NOT NULL,
    node_level INTEGER NOT NULL,
    node_stage INTEGER NOT NULL,
    price_usdt REAL NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER UNIQUE NOT NULL,
    owner_address TEXT NOT NULL,
    level INTEGER NOT NULL,              -- 1-7 (Micro to Diamond)
    stage INTEGER NOT NULL,               -- 1-5 (阶段)
    difficulty_multiplier REAL NOT NULL,  -- 0.6-1.0
    power REAL NOT NULL,                  -- 算力
    mint_time DATETIME NOT NULL,
    tx_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, pending_allocations REAL DEFAULT 0, claimed_allocations REAL DEFAULT 0, participation_active INTEGER DEFAULT 1, last_allocation_date TIMESTAMP);

CREATE TABLE platform_revenue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revenue_date DATE NOT NULL UNIQUE,
    node_sales_count INTEGER DEFAULT 0,
    node_sales_revenue REAL DEFAULT 0,
    swap_fee_revenue REAL DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE referral_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_address TEXT NOT NULL,       -- 推荐人
    referee_address TEXT NOT NULL,        -- 被推荐人
    referral_code TEXT,                   -- 推荐码
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, confirmed_at DATETIME, is_confirmed BOOLEAN DEFAULT 0,
    UNIQUE(referee_address)
);

CREATE TABLE referral_reward_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_address TEXT NOT NULL,   -- 推荐人地址
  referee_address TEXT NOT NULL,    -- 被推荐人地址
  chain_id INTEGER NOT NULL DEFAULT 196,
  
  -- 奖励信息
  reward_type TEXT NOT NULL,        -- 奖励类型：swap, mining, nft
  reward_amount REAL NOT NULL,      -- 奖励数量（代币）
  reward_usd REAL NOT NULL,         -- 奖励价值（USD）
  reward_token TEXT,                -- 奖励代币地址
  
  -- 关联信息
  swap_tx_id INTEGER,               -- 关联的 Swap 交易 ID
  source_tx_hash TEXT,              -- 源交易哈希
  
  -- 状态
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, claimable, claimed
  claimed_at DATETIME,              -- 提取时间
  claim_tx_hash TEXT,               -- 提取交易哈希
  
  -- 时间戳
  timestamp INTEGER,                -- 区块链时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.',
  
  FOREIGN KEY (swap_tx_id) REFERENCES swap_transactions(id)
);

CREATE TABLE referral_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_address TEXT NOT NULL,
    referee_address TEXT NOT NULL,
    event_type TEXT NOT NULL,             -- 'node_purchase', 'swap_fee'
    amount_usdt REAL NOT NULL,            -- 事件金额
    commission_rate REAL NOT NULL,        -- 佣金比例 0.05-0.20
    reward_amount REAL NOT NULL,          -- 奖励金额
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE referrer_level_config (
    level INTEGER PRIMARY KEY,
    level_name TEXT NOT NULL,
    min_value REAL NOT NULL,
    swap_mining_bonus REAL NOT NULL,
    icon TEXT,
    description TEXT
);

CREATE TABLE reward_rate_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    level1_rate REAL NOT NULL DEFAULT 0.10,  -- 10%
    level2_rate REAL NOT NULL DEFAULT 0.05,  -- 5%
    level3_rate REAL NOT NULL DEFAULT 0.02,  -- 2%
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE staking_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,
  farm_id INTEGER NOT NULL,
  staked_amount TEXT NOT NULL DEFAULT '0',
  reward_debt TEXT NOT NULL DEFAULT '0',
  pending_rewards TEXT NOT NULL DEFAULT '0',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id)
);

CREATE TABLE supported_chains (
    chain_id INTEGER PRIMARY KEY,
    chain_name TEXT NOT NULL,
    native_token TEXT NOT NULL,
    rpc_url TEXT,
    explorer_url TEXT,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE swap_mining_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_rate REAL NOT NULL,
  base_amount_usdt REAL NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE swap_mining_nft_bonus_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    base_reward REAL NOT NULL,
    nft_weight REAL NOT NULL,
    bonus_percent REAL NOT NULL,
    bonus_amount REAL NOT NULL,
    final_reward REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE swap_mining_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address TEXT NOT NULL,
        reward_date DATE NOT NULL,
        chain_id INTEGER DEFAULT 196,
        total_trade_volume REAL NOT NULL,
        total_fee_paid REAL NOT NULL,
        eagle_earned REAL NOT NULL,
        claimed BOOLEAN DEFAULT 0,
        claimed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_address) REFERENCES users(wallet_address),
        UNIQUE(user_address, reward_date, chain_id)
      );

CREATE TABLE swap_referral_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      swap_id INTEGER,
      referrer_address TEXT NOT NULL,
      referee_address TEXT NOT NULL,
      reward_amount REAL DEFAULT 0.001,
      claimed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      claimed_at DATETIME,
      FOREIGN KEY (referrer_address) REFERENCES users(wallet_address),
      FOREIGN KEY (referee_address) REFERENCES users(wallet_address)
    );

CREATE TABLE swap_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    reward_date DATE NOT NULL,
    trading_volume_usdt REAL NOT NULL,    -- 交易量
    base_reward REAL NOT NULL,            -- 基础奖励
    node_multiplier REAL NOT NULL,        -- 节点加成 1.0-5.0
    final_reward REAL NOT NULL,           -- 最终奖励
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE swap_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT NOT NULL UNIQUE,
  user_address TEXT NOT NULL,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  amount_in TEXT NOT NULL,
  amount_out TEXT NOT NULL,
  dex_name TEXT NOT NULL, -- 'QuickSwap' or 'POTATO SWAP'
  platform_fee TEXT NOT NULL,
  execution_price TEXT NOT NULL,
  slippage TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  block_number INTEGER,
  timestamp INTEGER,
  chain_id INTEGER NOT NULL DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, trade_value_usdt REAL DEFAULT 0, fee_usdt REAL DEFAULT 0, eagle_reward REAL DEFAULT 0);

CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    achievement_type TEXT NOT NULL,
    achievement_name TEXT NOT NULL,
    description TEXT,
    reward_amount REAL DEFAULT 0,
    achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE TABLE team_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT,
    reward_pool REAL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE TABLE team_level_config (
    level INTEGER PRIMARY KEY,
    level_name TEXT NOT NULL,
    min_members INTEGER NOT NULL,
    reward_multiplier REAL NOT NULL,
    description TEXT
);

CREATE TABLE team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    member_address TEXT NOT NULL,
    referrer_address TEXT,
    member_level INTEGER NOT NULL,  -- 1, 2, 或 3
    total_volume REAL DEFAULT 0,
    total_rewards REAL DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (member_address) REFERENCES users(wallet_address),
    UNIQUE(team_id, member_address)
);

CREATE TABLE team_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    leader_address TEXT NOT NULL,
    member_address TEXT NOT NULL,
    member_level INTEGER NOT NULL,
    reward_amount REAL NOT NULL,
    reward_type TEXT NOT NULL,
    source_tx_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (leader_address) REFERENCES users(wallet_address),
    FOREIGN KEY (member_address) REFERENCES users(wallet_address)
);

CREATE TABLE team_stats (
    team_id INTEGER PRIMARY KEY,
    level1_members INTEGER DEFAULT 0,
    level2_members INTEGER DEFAULT 0,
    level3_members INTEGER DEFAULT 0,
    level1_volume REAL DEFAULT 0,
    level2_volume REAL DEFAULT 0,
    level3_volume REAL DEFAULT 0,
    level1_rewards REAL DEFAULT 0,
    level2_rewards REAL DEFAULT 0,
    level3_rewards REAL DEFAULT 0,
    total_volume REAL DEFAULT 0,
    total_rewards REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE TABLE teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL,
    leader_address TEXT NOT NULL,
    team_code TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    level INTEGER DEFAULT 1,
    total_members INTEGER DEFAULT 0,
    total_volume REAL DEFAULT 0,
    total_rewards REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (leader_address) REFERENCES users(wallet_address)
);

CREATE TABLE token_pair_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  total_swaps INTEGER NOT NULL DEFAULT 0,
  total_volume_in TEXT NOT NULL DEFAULT '0',
  total_volume_out TEXT NOT NULL DEFAULT '0',
  total_volume_usd REAL NOT NULL DEFAULT 0,
  last_swap_at DATETIME,
  chain_id INTEGER NOT NULL DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_in, token_out, chain_id)
);

CREATE TABLE token_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_address TEXT NOT NULL,
  price REAL NOT NULL,
  price_usd REAL NOT NULL,
  volume_24h REAL DEFAULT 0,
  market_cap REAL DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_address) REFERENCES tokens(address)
);

CREATE TABLE tokens (
  address TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  logo_uri TEXT,
  chain_id INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trading_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pair_address TEXT UNIQUE NOT NULL,
  token_a TEXT NOT NULL,
  token_b TEXT NOT NULL,
  reserve_a TEXT NOT NULL DEFAULT '0',
  reserve_b TEXT NOT NULL DEFAULT '0',
  total_supply TEXT NOT NULL DEFAULT '0',
  fee REAL NOT NULL DEFAULT 0.003,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_a) REFERENCES tokens(address),
  FOREIGN KEY (token_b) REFERENCES tokens(address)
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT UNIQUE NOT NULL,
  user_address TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('swap', 'add_liquidity', 'remove_liquidity', 'stake', 'unstake')),
  token_in TEXT,
  token_out TEXT,
  amount_in TEXT,
  amount_out TEXT,
  pair_address TEXT,
  lp_amount TEXT,
  gas_used TEXT NOT NULL,
  gas_price TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  block_number INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_in) REFERENCES tokens(address),
  FOREIGN KEY (token_out) REFERENCES tokens(address),
  FOREIGN KEY (pair_address) REFERENCES trading_pairs(pair_address)
);

CREATE TABLE twap_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  twap_order_id INTEGER NOT NULL,
  trade_number INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  amount_in TEXT NOT NULL,
  amount_out TEXT NOT NULL,
  executor_address TEXT NOT NULL,
  executor_reward TEXT NOT NULL,
  platform_fee TEXT NOT NULL,
  execution_price TEXT NOT NULL,
  timestamp INTEGER,
  block_number INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (twap_order_id) REFERENCES twap_orders(id)
);

CREATE TABLE twap_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE, -- 链上订单ID
  user_address TEXT NOT NULL,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  total_amount TEXT NOT NULL,
  amount_per_trade TEXT NOT NULL,
  total_trades INTEGER NOT NULL,
  executed_trades INTEGER NOT NULL DEFAULT 0,
  trade_interval INTEGER NOT NULL, -- 秒
  max_duration INTEGER NOT NULL, -- 秒
  order_type TEXT NOT NULL, -- 'market' or 'limit'
  min_amount_out TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'expired'
  created_tx_hash TEXT,
  created_at_timestamp INTEGER NOT NULL,
  last_execute_time INTEGER,
  chain_id INTEGER NOT NULL DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_referral_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 196,
  
  -- Swap 奖励
  swap_pending REAL NOT NULL DEFAULT 0,      -- 待确认的 Swap 奖励
  swap_claimable REAL NOT NULL DEFAULT 0,    -- 可提取的 Swap 奖励
  swap_claimed REAL NOT NULL DEFAULT 0,      -- 已提取的 Swap 奖励
  swap_total_earned REAL NOT NULL DEFAULT 0, -- 总共赚取的 Swap 奖励
  
  -- 统计信息
  total_referrals INTEGER NOT NULL DEFAULT 0,      -- 总推荐人数
  total_swap_volume_usd REAL NOT NULL DEFAULT 0,   -- 总 Swap 交易量（USD）
  last_reward_at DATETIME,                         -- 最后一次获得奖励时间
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, allocation_disclaimer TEXT DEFAULT 'Allocations are variable and not guaranteed.',
  
  UNIQUE(user_address, chain_id)
);

CREATE TABLE user_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_date DATE NOT NULL UNIQUE,
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,  -- 当日有交易的用户
    total_nodes INTEGER DEFAULT 0,
    total_node_value REAL DEFAULT 0,
    total_swap_volume REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE user_swap_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL UNIQUE,
  total_swaps INTEGER NOT NULL DEFAULT 0,
  total_volume_usd REAL NOT NULL DEFAULT 0,
  total_fees_paid_usd REAL NOT NULL DEFAULT 0,
  total_twap_orders INTEGER NOT NULL DEFAULT 0,
  total_limit_orders INTEGER NOT NULL DEFAULT 0,
  first_swap_at DATETIME,
  last_swap_at DATETIME,
  chain_id INTEGER NOT NULL DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "users" (
        id INTEGER PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    swap_mining_bonus REAL DEFAULT 0.05,
    username TEXT,
    avatar_url TEXT
      );

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

CREATE TABLE vote_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    impeachment_id INTEGER NOT NULL,
    voter_address TEXT NOT NULL,
    vote_weight REAL NOT NULL,
    vote_for BOOLEAN NOT NULL,
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (impeachment_id) REFERENCES impeachment_votes(id),
    UNIQUE(impeachment_id, voter_address)
);

CREATE TABLE year_multipliers (
    year INTEGER PRIMARY KEY,
    multiplier REAL NOT NULL,
    decay_rate TEXT,
    description TEXT
);

CREATE TABLE yearly_reward_multipliers (
    year INTEGER PRIMARY KEY,
    multiplier REAL NOT NULL,
    decay_rate REAL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE yearly_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    level_id INTEGER NOT NULL,
    stage INTEGER NOT NULL,
    daily_reward REAL NOT NULL,
    year_multiplier REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, allocation_variable INTEGER DEFAULT 1,
    FOREIGN KEY (level_id) REFERENCES node_levels(id),
    UNIQUE(year, level_id, stage)
);

