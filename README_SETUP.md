# EAGLE SWAP 后端设置指南

## 🚀 快速开始

### 1. 安装依赖

```bash
cd G:\NEW_EAGLE\new4\new\eagle-swap-backend
npm install
npm install better-sqlite3 node-cron
npm install --save-dev @types/better-sqlite3 @types/node-cron
```

### 2. 配置环境变量

编辑 `.env` 文件：

```env
# 服务器配置
PORT=3001
NODE_ENV=development

# 数据库
DATABASE_PATH=./data/database.sqlite

# X Layer 网络配置
CHAIN_ID=196
RPC_URL=https://rpc.xlayer.tech
EXPLORER_URL=https://www.okx.com/web3/explorer/xlayer

# 智能合约地址（部署后填写）
EAGLE_TOKEN_ADDRESS=
NODE_NFT_ADDRESS=
NODE_MINING_ADDRESS=

# 后端私钥（用于签名）
BACKEND_PRIVATE_KEY=

# CORS 配置
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002
```

### 3. 初始化数据库

数据库会在首次启动时自动初始化。

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

---

## 📁 新增文件说明

### 数据库相关

```
src/database/
├── index.ts - 数据库连接和初始化
└── schema.sql - 数据库表结构
```

**功能：**
- SQLite 数据库连接
- 自动创建表结构
- 索引优化
- 数据库统计

### 路由相关

```
src/routes/
├── nodes.ts - 节点管理 API
├── mining.ts - 挖矿奖励 API
└── referral.ts - 推荐系统 API
```

**节点管理 API：**
- `GET /api/nodes/levels` - 获取节点等级信息
- `GET /api/nodes/my-nodes/:address` - 获取用户节点
- `GET /api/nodes/:tokenId` - 获取节点详情
- `GET /api/nodes/statistics/overview` - 节点统计
- `GET /api/nodes/leaderboard` - 节点排行榜

**挖矿奖励 API：**
- `GET /api/mining/rewards/:address` - 获取挖矿历史
- `GET /api/mining/pending/:address` - 获取待领取奖励
- `POST /api/mining/claim` - 领取奖励
- `GET /api/mining/statistics/:address` - 挖矿统计
- `GET /api/mining/daily-pool` - 每日奖励池
- `GET /api/mining/calculator` - 收益计算器

**推荐系统 API：**
- `POST /api/referral/bind` - 绑定推荐关系
- `GET /api/referral/code/:address` - 获取推荐码
- `GET /api/referral/my-referrals/:address` - 获取推荐列表
- `GET /api/referral/rewards/:address` - 获取推荐奖励
- `GET /api/referral/pending/:address` - 待领取奖励
- `GET /api/referral/statistics/:address` - 推荐统计
- `GET /api/referral/leaderboard` - 推荐排行榜
- `GET /api/referral/check/:address` - 检查绑定状态

### 服务相关

```
src/services/
├── blockchainListener.ts - 区块链监听服务
└── miningService.ts - 挖矿计算服务
```

**区块链监听服务：**
- 监听节点铸造事件
- 自动同步节点数据到数据库
- 自动记录推荐奖励
- 历史数据同步

**挖矿计算服务：**
- 每日自动计算挖矿奖励
- 10年释放计划
- 算力统计
- 奖励分配

---

## 🔧 启动流程

### 1. 数据库初始化

首次启动时会自动：
- 创建 `data/database.sqlite` 文件
- 创建所有表结构
- 创建索引
- 插入初始配置

### 2. 启动区块链监听

在 `src/server.ts` 中添加：

```typescript
import { blockchainListener } from './services/blockchainListener';
import { miningService } from './services/miningService';

// 启动服务后
blockchainListener.start();
miningService.start();
```

### 3. 测试 API

```bash
# 测试健康检查
curl http://localhost:3001/health

# 测试节点等级
curl http://localhost:3001/api/nodes/levels

# 测试挖矿统计
curl http://localhost:3001/api/mining/statistics/0x...
```

---

## 📊 数据库表结构

### 核心表

1. **users** - 用户表
2. **nodes** - 节点表
3. **node_mining_rewards** - 节点挖矿奖励
4. **swap_transactions** - SWAP 交易
5. **swap_rewards** - SWAP 奖励
6. **referral_relationships** - 推荐关系
7. **referral_rewards** - 推荐奖励
8. **liquidity_mining** - 流动性挖矿
9. **liquidity_rewards** - 流动性奖励
10. **system_config** - 系统配置

---

## 🎯 下一步

### 1. 部署智能合约

```bash
cd ../eagleswap-frontend/contracts
npm install
npx hardhat run scripts/deploy.ts --network xlayerTestnet
```

### 2. 更新合约地址

将部署后的合约地址填入 `.env`：

```env
EAGLE_TOKEN_ADDRESS=0x...
NODE_NFT_ADDRESS=0x...
NODE_MINING_ADDRESS=0x...
```

### 3. 启动监听服务

重启后端服务，区块链监听会自动开始。

### 4. 测试完整流程

1. 在前端购买节点
2. 后端监听到铸造事件
3. 自动保存节点数据
4. 每日计算挖矿奖励
5. 用户领取奖励

---

## 🐛 故障排除

### 数据库连接失败

```bash
# 检查 data 目录是否存在
mkdir -p data

# 检查文件权限
chmod 755 data
```

### 区块链监听失败

```bash
# 检查 RPC URL 是否可访问
curl https://rpc.xlayer.tech

# 检查合约地址是否正确
# 检查网络是否正确（Chain ID: 196）
```

### API 返回错误

```bash
# 查看日志
tail -f logs/app.log

# 检查数据库
sqlite3 data/database.sqlite
.tables
SELECT * FROM nodes LIMIT 5;
```

---

## 📝 开发建议

### 1. 使用 TypeScript

所有新代码都使用 TypeScript 编写，确保类型安全。

### 2. 错误处理

所有 API 都应该有完善的错误处理：

```typescript
try {
  // 业务逻辑
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    error: 'Error message',
  });
}
```

### 3. 日志记录

使用统一的日志格式：

```typescript
console.log('✅ Success message');
console.log('⚠️ Warning message');
console.error('❌ Error message');
```

### 4. 数据验证

所有用户输入都应该验证：

```typescript
if (!address || address.length !== 42) {
  return res.status(400).json({
    success: false,
    error: 'Invalid address',
  });
}
```

---

## 🎉 完成！

后端服务已经准备就绪！现在可以：

1. ✅ 处理节点管理请求
2. ✅ 监听区块链事件
3. ✅ 计算挖矿奖励
4. ✅ 管理推荐系统
5. ✅ 提供统计数据

下一步：开发前端页面！🚀
