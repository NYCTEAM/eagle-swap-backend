# Eagle Swap Backend

Eagle Swap Backend 是一个基于 Node.js 和 TypeScript 的 DEX (去中心化交易所) 后端服务，提供代币交易、流动性管理、农场质押等功能。

## 🚀 特性

- **代币管理**: 支持多链代币信息管理和价格查询
- **交易系统**: 提供代币交换、路由优化和交易历史
- **流动性管理**: 支持流动性添加/移除和收益计算
- **农场质押**: 提供质押挖矿和奖励分发功能
- **用户管理**: 用户数据管理和偏好设置
- **价格服务**: 实时价格数据和历史价格查询
- **多链支持**: 支持 Ethereum、BSC、Polygon 等多个区块链网络

## 🏗️ 技术架构

- **后端框架**: Express.js + TypeScript
- **数据库**: SQLite3
- **区块链集成**: 通过 Eagle RPC Backend (端口 3000) 进行区块链交互
- **索引服务**: 集成 Eagle Swap Indexer (端口 3002) 获取链上数据
- **安全**: Helmet、CORS、Rate Limiting
- **日志**: Winston 日志系统

## 📋 系统要求

- Node.js >= 16.0.0
- npm >= 8.0.0 或 pnpm >= 7.0.0
- Eagle RPC Backend (运行在端口 3000)
- Eagle Swap Indexer (可选，运行在端口 3002)

## 🛠️ 安装和设置

### 1. 克隆项目

```bash
git clone <repository-url>
cd eagle-swap-backend
```

### 2. 快速设置 (Windows)

运行设置脚本：

```bash
scripts\setup.bat
```

### 3. 手动设置

#### 安装依赖

```bash
npm install
# 或
pnpm install
```

#### 环境配置

复制环境变量文件并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下关键参数：

```env
# 服务器配置
PORT=3001
HOST=localhost
NODE_ENV=development

# Eagle RPC Backend 集成
EAGLE_RPC_URL=http://localhost:3000

# 数据库路径
DATABASE_PATH=./data/eagle-swap.db
```

#### 初始化数据库

```bash
npm run db:init
npm run db:seed
```

## 🚀 启动服务

### 开发模式

```bash
npm run dev
# 或使用脚本
scripts\dev.bat
```

### 生产模式

```bash
npm run build
npm start
# 或使用脚本
scripts\start.bat
```

服务将在 `http://localhost:3001` 启动

## 📚 API 文档

### 基础信息

- **Base URL**: `http://localhost:3001`
- **API Version**: v1
- **Content-Type**: `application/json`

### 健康检查

```http
GET /health
```

响应：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### 代币管理 API

#### 获取代币列表

```http
GET /api/tokens?page=1&limit=20&chain_id=1
```

#### 搜索代币

```http
GET /api/tokens/search?q=USDC&chain_id=1
```

#### 获取代币详情

```http
GET /api/tokens/:address?chain_id=1
```

#### 添加代币

```http
POST /api/tokens
Content-Type: application/json

{
  "address": "0x...",
  "chain_id": 1
}
```

### 交易系统 API

#### 获取交换报价

```http
GET /api/swap/quote?tokenIn=0x...&tokenOut=0x...&amountIn=1000000&chainId=1
```

#### 执行交换

```http
POST /api/swap/execute
Content-Type: application/json

{
  "user_address": "0x...",
  "token_in": "0x...",
  "token_out": "0x...",
  "amount_in": "1000000",
  "amount_out_min": "950000",
  "chain_id": 1,
  "slippage": 0.5
}
```

#### 获取交易历史

```http
GET /api/swap/history/:userAddress?page=1&limit=20&chain_id=1
```

### 流动性管理 API

#### 添加流动性

```http
POST /api/liquidity/add
Content-Type: application/json

{
  "user_address": "0x...",
  "token_a": "0x...",
  "token_b": "0x...",
  "amount_a": "1000000",
  "amount_b": "2000000",
  "chain_id": 1
}
```

#### 移除流动性

```http
POST /api/liquidity/remove
Content-Type: application/json

{
  "user_address": "0x...",
  "pair_address": "0x...",
  "liquidity_amount": "500000",
  "chain_id": 1
}
```

#### 获取用户流动性位置

```http
GET /api/liquidity/positions/:userAddress?chain_id=1
```

### 农场质押 API

#### 获取农场列表

```http
GET /api/farms?page=1&limit=20&chain_id=1
```

#### 质押代币

```http
POST /api/farms/stake
Content-Type: application/json

{
  "user_address": "0x...",
  "farm_id": 1,
  "amount": "1000000"
}
```

#### 取消质押

```http
POST /api/farms/unstake
Content-Type: application/json

{
  "user_address": "0x...",
  "farm_id": 1,
  "amount": "500000"
}
```

#### 收获奖励

```http
POST /api/farms/harvest
Content-Type: application/json

{
  "user_address": "0x...",
  "farm_id": 1
}
```

### 用户管理 API

#### 获取用户信息

```http
GET /api/users/:address
```

#### 更新用户信息

```http
PUT /api/users/:address
Content-Type: application/json

{
  "username": "new_username",
  "email": "user@example.com",
  "preferences": {
    "defaultChain": 1,
    "slippageTolerance": 0.5
  }
}
```

#### 获取用户投资组合

```http
GET /api/users/:address/portfolio
```

### 价格服务 API

#### 获取代币价格

```http
GET /api/prices/:tokenAddress?chain_id=1
```

#### 批量获取价格

```http
POST /api/prices/batch
Content-Type: application/json

{
  "tokens": [
    {"address": "0x...", "chain_id": 1},
    {"address": "0x...", "chain_id": 56}
  ]
}
```

#### 获取价格历史

```http
GET /api/prices/:tokenAddress/history?chain_id=1&timeframe=24h
```

## 🔧 配置说明

### 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | `3001` |
| `HOST` | 服务主机 | `localhost` |
| `NODE_ENV` | 运行环境 | `development` |
| `DATABASE_PATH` | 数据库文件路径 | `./data/eagle-swap.db` |
| `EAGLE_RPC_URL` | Eagle RPC Backend URL | `http://localhost:3000` |
| `EAGLE_INDEXER_URL` | Eagle Indexer URL | `http://localhost:3002` |
| `JWT_SECRET` | JWT 密钥 | - |
| `CORS_ORIGINS` | CORS 允许的源 | `http://localhost:3000,http://localhost:3001,http://localhost:5173` |

### 支持的区块链网络

| Chain ID | 网络名称 | 符号 |
|----------|----------|------|
| `1` | Ethereum Mainnet | `ETH` |
| `56` | BSC Mainnet | `BNB` |
| `137` | Polygon Mainnet | `MATIC` |
| `42161` | Arbitrum One | `ETH` |

## 🧪 测试

运行测试：

```bash
npm test
```

运行测试覆盖率：

```bash
npm run test:coverage
```

## 📝 开发脚本

| 脚本 | 描述 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm start` | 启动生产服务器 |
| `npm run db:init` | 初始化数据库 |
| `npm run db:seed` | 填充示例数据 |
| `npm run lint` | 代码检查 |
| `npm run lint:fix` | 自动修复代码问题 |
| `npm test` | 运行测试 |

## 🐛 故障排除

### 常见问题

1. **端口冲突**
   - 确保端口 3001 未被占用
   - 修改 `.env` 文件中的 `PORT` 配置

2. **数据库连接失败**
   - 检查 `data` 目录是否存在
   - 运行 `npm run db:init` 重新初始化数据库

3. **Eagle RPC Backend 连接失败**
   - 确保 Eagle RPC Backend 在端口 3000 正常运行
   - 检查 `EAGLE_RPC_URL` 配置

4. **依赖安装失败**
   - 清除 node_modules: `rm -rf node_modules package-lock.json`
   - 重新安装: `npm install`

### 日志查看

日志文件位置：`./logs/eagle-swap.log`

查看实时日志：

```bash
tail -f logs/eagle-swap.log
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如有问题或建议，请：

1. 查看 [FAQ](docs/FAQ.md)
2. 提交 [Issue](https://github.com/your-repo/eagle-swap-backend/issues)
3. 联系开发团队

## 🔗 相关项目

- [Eagle RPC Backend](https://github.com/your-org/eagle-rpc-backend) - 区块链 RPC 服务
- [Eagle Swap Indexer](https://github.com/your-org/eagle-swap-indexer) - 链上数据索引服务
- [Eagle Swap Frontend](https://github.com/your-org/eagle-swap-frontend) - 前端界面