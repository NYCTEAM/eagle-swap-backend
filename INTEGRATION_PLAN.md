# EAGLE SWAP 后端整合方案

## 🎯 项目结构

### 现有后端
```
G:\NEW_EAGLE\new4\new\eagle-swap-backend\
```

### 前端
```
G:\NEW_EAGLE\new4\new\eagleswap-frontend\
```

**一个后端服务所有功能！**

---

## 📊 现有功能

### 已有的路由
```
src/routes/
├─ farms.ts          # 流动性挖矿
├─ liquidity.ts      # 流动性管理
├─ prices.ts         # 价格查询
├─ swap.ts           # SWAP 交易
├─ tokens.ts         # 代币信息
└─ users.ts          # 用户管理
```

---

## 🆕 需要添加的功能

### 新增路由

```
src/routes/
├─ nodes.ts          # 节点管理 (新增)
├─ mining.ts         # 节点挖矿 (新增)
├─ referral.ts       # 推荐系统 (新增)
└─ statistics.ts     # 数据统计 (新增)
```

---

## 🗄️ SQLite 数据库设计

### 数据库位置
```
G:\NEW_EAGLE\new4\new\eagle-swap-backend\data\database.sqlite
```

### 新增表结构

```sql
-- 1. 节点表（缓存链上数据）
CREATE TABLE IF NOT EXISTS nodes (
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
);

-- 2. 节点挖矿奖励表
CREATE TABLE IF NOT EXISTS node_mining_rewards (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES nodes(token_id)
);

-- 3. SWAP 奖励表
CREATE TABLE IF NOT EXISTS swap_rewards (
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

-- 4. 推荐关系表
CREATE TABLE IF NOT EXISTS referral_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_address TEXT NOT NULL,       -- 推荐人
    referee_address TEXT NOT NULL,        -- 被推荐人
    referral_code TEXT,                   -- 推荐码
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referee_address)
);

-- 5. 推荐奖励表
CREATE TABLE IF NOT EXISTS referral_rewards (
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

-- 6. 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_nodes_owner ON nodes(owner_address);
CREATE INDEX IF NOT EXISTS idx_nodes_token ON nodes(token_id);
CREATE INDEX IF NOT EXISTS idx_mining_rewards_owner ON node_mining_rewards(owner_address);
CREATE INDEX IF NOT EXISTS idx_mining_rewards_date ON node_mining_rewards(reward_date);
CREATE INDEX IF NOT EXISTS idx_swap_rewards_user ON swap_rewards(user_address);
CREATE INDEX IF NOT EXISTS idx_swap_rewards_date ON swap_rewards(reward_date);
CREATE INDEX IF NOT EXISTS idx_referral_referrer ON referral_relationships(referrer_address);
CREATE INDEX IF NOT EXISTS idx_referral_referee ON referral_relationships(referee_address);
```

---

## 📁 新增文件结构

```
eagle-swap-backend/
├─ src/
│  ├─ routes/
│  │  ├─ nodes.ts              # 节点管理路由 (新增)
│  │  ├─ mining.ts             # 挖矿奖励路由 (新增)
│  │  ├─ referral.ts           # 推荐系统路由 (新增)
│  │  └─ statistics.ts         # 数据统计路由 (新增)
│  │
│  ├─ services/
│  │  ├─ nodeService.ts        # 节点服务 (新增)
│  │  ├─ miningService.ts      # 挖矿计算服务 (新增)
│  │  ├─ referralService.ts    # 推荐服务 (新增)
│  │  └─ blockchainListener.ts # 区块链监听 (新增)
│  │
│  ├─ database/
│  │  └─ migrations/
│  │     └─ 001_add_node_tables.sql  # 数据库迁移 (新增)
│  │
│  └─ types/
│     ├─ node.ts               # 节点类型定义 (新增)
│     └─ reward.ts             # 奖励类型定义 (新增)
│
└─ data/
   └─ database.sqlite          # SQLite 数据库文件
```

---

## 🔧 实现步骤

### Step 1: 数据库迁移

创建 `src/database/migrations/001_add_node_tables.sql`

```sql
-- 执行上面的所有 CREATE TABLE 语句
```

### Step 2: 创建节点路由

创建 `src/routes/nodes.ts`

```typescript
import { Router } from 'express';
import { db } from '../database';

const router = Router();

// 节点等级配置
const NODE_LEVELS = [
  { id: 1, name: 'Micro', price: 10, supply: 5000, power: 0.1 },
  { id: 2, name: 'Mini', price: 25, supply: 3000, power: 0.3 },
  { id: 3, name: 'Bronze', price: 50, supply: 2000, power: 0.5 },
  { id: 4, name: 'Silver', price: 100, supply: 1500, power: 1 },
  { id: 5, name: 'Gold', price: 250, supply: 800, power: 3 },
  { id: 6, name: 'Platinum', price: 500, supply: 400, power: 7 },
  { id: 7, name: 'Diamond', price: 1000, supply: 200, power: 15 },
];

/**
 * GET /api/nodes/levels
 * 获取所有节点等级信息（包含当前阶段和剩余数量）
 */
router.get('/levels', async (req, res) => {
  try {
    const levelsWithStatus = NODE_LEVELS.map(level => {
      // 查询已售数量
      const result = db.prepare(`
        SELECT COUNT(*) as minted 
        FROM nodes 
        WHERE level = ?
      `).get(level.id) as { minted: number };
      
      const minted = result?.minted || 0;
      const percentage = (minted / level.supply) * 100;
      
      // 计算当前阶段和难度
      let stage = 1;
      let multiplier = 1.0;
      if (percentage >= 80) { stage = 5; multiplier = 0.6; }
      else if (percentage >= 60) { stage = 4; multiplier = 0.7; }
      else if (percentage >= 40) { stage = 3; multiplier = 0.8; }
      else if (percentage >= 20) { stage = 2; multiplier = 0.9; }
      
      return {
        ...level,
        minted,
        remaining: level.supply - minted,
        percentage: percentage.toFixed(2),
        stage,
        multiplier,
        soldOut: minted >= level.supply,
      };
    });
    
    res.json({
      success: true,
      data: levelsWithStatus,
    });
  } catch (error) {
    console.error('Error fetching node levels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node levels',
    });
  }
});

/**
 * GET /api/nodes/my-nodes/:address
 * 获取用户的所有节点
 */
router.get('/my-nodes/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const nodes = db.prepare(`
      SELECT 
        n.*,
        COALESCE(SUM(r.reward_amount), 0) as total_rewards,
        COALESCE(SUM(CASE WHEN r.claimed = 0 THEN r.reward_amount ELSE 0 END), 0) as pending_rewards
      FROM nodes n
      LEFT JOIN node_mining_rewards r ON n.token_id = r.token_id
      WHERE n.owner_address = ?
      GROUP BY n.id
      ORDER BY n.mint_time DESC
    `).all(address.toLowerCase());
    
    res.json({
      success: true,
      data: nodes,
    });
  } catch (error) {
    console.error('Error fetching user nodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user nodes',
    });
  }
});

/**
 * GET /api/nodes/:tokenId
 * 获取节点详情
 */
router.get('/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    const node = db.prepare(`
      SELECT * FROM nodes WHERE token_id = ?
    `).get(tokenId);
    
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found',
      });
    }
    
    res.json({
      success: true,
      data: node,
    });
  } catch (error) {
    console.error('Error fetching node:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node',
    });
  }
});

/**
 * GET /api/nodes/statistics/overview
 * 获取节点统计概览
 */
router.get('/statistics/overview', async (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_nodes,
        COUNT(DISTINCT owner_address) as total_owners,
        SUM(power) as total_power
      FROM nodes
    `).get();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching node statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

export default router;
```

### Step 3: 创建挖矿路由

创建 `src/routes/mining.ts`

```typescript
import { Router } from 'express';
import { db } from '../database';

const router = Router();

/**
 * GET /api/mining/rewards/:address
 * 获取用户挖矿收益历史
 */
router.get('/rewards/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 30, offset = 0 } = req.query;
    
    const rewards = db.prepare(`
      SELECT 
        r.*,
        n.level,
        n.stage
      FROM node_mining_rewards r
      JOIN nodes n ON r.token_id = n.token_id
      WHERE r.owner_address = ?
      ORDER BY r.reward_date DESC
      LIMIT ? OFFSET ?
    `).all(address.toLowerCase(), limit, offset);
    
    res.json({
      success: true,
      data: rewards,
    });
  } catch (error) {
    console.error('Error fetching mining rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mining rewards',
    });
  }
});

/**
 * GET /api/mining/pending/:address
 * 获取待领取奖励
 */
router.get('/pending/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const result = db.prepare(`
      SELECT 
        COALESCE(SUM(reward_amount), 0) as total
      FROM node_mining_rewards
      WHERE owner_address = ? AND claimed = 0
    `).get(address.toLowerCase()) as { total: number };
    
    res.json({
      success: true,
      data: {
        pending: result.total,
      },
    });
  } catch (error) {
    console.error('Error fetching pending rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending rewards',
    });
  }
});

/**
 * POST /api/mining/claim
 * 领取挖矿奖励
 */
router.post('/claim', async (req, res) => {
  try {
    const { address, signature } = req.body;
    
    if (!address || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }
    
    // TODO: 验证签名
    
    // 获取待领取金额
    const result = db.prepare(`
      SELECT COALESCE(SUM(reward_amount), 0) as total
      FROM node_mining_rewards
      WHERE owner_address = ? AND claimed = 0
    `).get(address.toLowerCase()) as { total: number };
    
    if (!result.total || result.total === 0) {
      return res.status(400).json({
        success: false,
        error: 'No pending rewards',
      });
    }
    
    // TODO: 调用智能合约铸造 EAGLE
    const txHash = '0x...'; // 交易哈希
    
    // 标记为已领取
    db.prepare(`
      UPDATE node_mining_rewards
      SET claimed = 1, claimed_at = CURRENT_TIMESTAMP, tx_hash = ?
      WHERE owner_address = ? AND claimed = 0
    `).run(txHash, address.toLowerCase());
    
    res.json({
      success: true,
      data: {
        amount: result.total,
        txHash,
      },
    });
  } catch (error) {
    console.error('Error claiming rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim rewards',
    });
  }
});

/**
 * GET /api/mining/statistics/:address
 * 获取用户挖矿统计
 */
router.get('/statistics/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT token_id) as node_count,
        COALESCE(SUM(reward_amount), 0) as total_earned,
        COALESCE(SUM(CASE WHEN claimed = 1 THEN reward_amount ELSE 0 END), 0) as total_claimed,
        COALESCE(SUM(CASE WHEN claimed = 0 THEN reward_amount ELSE 0 END), 0) as total_pending
      FROM node_mining_rewards
      WHERE owner_address = ?
    `).get(address.toLowerCase());
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching mining statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

export default router;
```

### Step 4: 创建推荐路由

创建 `src/routes/referral.ts`

```typescript
import { Router } from 'express';
import { db } from '../database';
import { generateReferralCode } from '../utils/helpers';

const router = Router();

/**
 * POST /api/referral/bind
 * 绑定推荐关系
 */
router.post('/bind', async (req, res) => {
  try {
    const { refereeAddress, referralCode } = req.body;
    
    if (!refereeAddress || !referralCode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }
    
    // 查找推荐人
    const referrer = db.prepare(`
      SELECT wallet_address FROM users WHERE referral_code = ?
    `).get(referralCode) as { wallet_address: string } | undefined;
    
    if (!referrer) {
      return res.status(404).json({
        success: false,
        error: 'Invalid referral code',
      });
    }
    
    // 检查是否已绑定
    const existing = db.prepare(`
      SELECT id FROM referral_relationships WHERE referee_address = ?
    `).get(refereeAddress.toLowerCase());
    
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Already bound to a referrer',
      });
    }
    
    // 创建推荐关系
    db.prepare(`
      INSERT INTO referral_relationships (referrer_address, referee_address, referral_code)
      VALUES (?, ?, ?)
    `).run(referrer.wallet_address.toLowerCase(), refereeAddress.toLowerCase(), referralCode);
    
    res.json({
      success: true,
      message: 'Referral relationship created',
    });
  } catch (error) {
    console.error('Error binding referral:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bind referral',
    });
  }
});

/**
 * GET /api/referral/my-referrals/:address
 * 获取我的推荐列表
 */
router.get('/my-referrals/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const referrals = db.prepare(`
      SELECT 
        r.*,
        COUNT(n.id) as node_count,
        COALESCE(SUM(rw.reward_amount), 0) as total_rewards
      FROM referral_relationships r
      LEFT JOIN nodes n ON r.referee_address = n.owner_address
      LEFT JOIN referral_rewards rw ON r.referee_address = rw.referee_address
      WHERE r.referrer_address = ?
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `).all(address.toLowerCase());
    
    res.json({
      success: true,
      data: referrals,
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch referrals',
    });
  }
});

/**
 * GET /api/referral/rewards/:address
 * 获取推荐奖励
 */
router.get('/rewards/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const rewards = db.prepare(`
      SELECT * FROM referral_rewards
      WHERE referrer_address = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(address.toLowerCase());
    
    res.json({
      success: true,
      data: rewards,
    });
  } catch (error) {
    console.error('Error fetching referral rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch referral rewards',
    });
  }
});

/**
 * GET /api/referral/statistics/:address
 * 获取推荐统计
 */
router.get('/statistics/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT r.referee_address) as total_referrals,
        COALESCE(SUM(rw.reward_amount), 0) as total_earned,
        COALESCE(SUM(CASE WHEN rw.claimed = 1 THEN rw.reward_amount ELSE 0 END), 0) as total_claimed,
        COALESCE(SUM(CASE WHEN rw.claimed = 0 THEN rw.reward_amount ELSE 0 END), 0) as total_pending
      FROM referral_relationships r
      LEFT JOIN referral_rewards rw ON r.referrer_address = rw.referrer_address
      WHERE r.referrer_address = ?
    `).get(address.toLowerCase());
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching referral statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

export default router;
```

### Step 5: 更新 app.ts

在 `src/app.ts` 中添加新路由：

```typescript
import nodeRoutes from './routes/nodes';
import miningRoutes from './routes/mining';
import referralRoutes from './routes/referral';

// 添加到现有路由后面
app.use('/api/nodes', nodeRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/referral', referralRoutes);
```

---

## 🎯 API 端点总结

### 现有端点
```
/api/swap/*          # SWAP 交易
/api/liquidity/*     # 流动性管理
/api/farms/*         # 流动性挖矿
/api/tokens/*        # 代币信息
/api/prices/*        # 价格查询
/api/users/*         # 用户管理
```

### 新增端点
```
/api/nodes/*         # 节点管理
├─ GET  /levels                    # 获取节点等级信息
├─ GET  /my-nodes/:address         # 获取用户节点
├─ GET  /:tokenId                  # 获取节点详情
└─ GET  /statistics/overview       # 节点统计

/api/mining/*        # 挖矿奖励
├─ GET  /rewards/:address          # 获取挖矿历史
├─ GET  /pending/:address          # 获取待领取奖励
├─ POST /claim                     # 领取奖励
└─ GET  /statistics/:address       # 挖矿统计

/api/referral/*      # 推荐系统
├─ POST /bind                      # 绑定推荐关系
├─ GET  /my-referrals/:address     # 获取推荐列表
├─ GET  /rewards/:address          # 获取推荐奖励
└─ GET  /statistics/:address       # 推荐统计
```

---

## 🚀 部署配置

### 环境变量 (.env)

```env
# 现有配置
PORT=3001
NODE_ENV=development

# 新增配置
DATABASE_PATH=./data/database.sqlite

# 智能合约地址
EAGLE_TOKEN_ADDRESS=0x...
NODE_NFT_ADDRESS=0x...
NODE_MINING_ADDRESS=0x...

# RPC 节点
RPC_URL=https://...
CHAIN_ID=1

# 私钥（用于后端签名）
BACKEND_PRIVATE_KEY=0x...
```

---

## 📦 依赖包

### 需要安装的新包

```bash
cd G:\NEW_EAGLE\new4\new\eagle-swap-backend

npm install better-sqlite3
npm install @types/better-sqlite3 --save-dev
```

---

## 🎯 总结

### 统一后端架构

```
✅ 一个后端服务 (eagle-swap-backend)
✅ 一个 SQLite 数据库
✅ 所有功能的 API 端点
✅ 统一的错误处理和日志
```

### 核心优势

```
✅ 代码集中管理
✅ 统一的数据库
✅ 共享的工具函数
✅ 一致的 API 风格
✅ 简化部署和维护
```

### 前后端通信

```
前端: G:\NEW_EAGLE\new4\new\eagleswap-frontend
后端: G:\NEW_EAGLE\new4\new\eagle-swap-backend
数据库: G:\NEW_EAGLE\new4\new\eagle-swap-backend\data\database.sqlite

前端调用: http://localhost:3001/api/*
```

---

**所有功能整合到一个后端，使用 SQLite 数据库！** 🦅✨
