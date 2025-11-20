# Eagle Swap Backend API 文档

## 概述

Eagle Swap Backend 提供完整的 DEX 功能 API，包括代币管理、交易、流动性、农场质押、用户管理和价格服务。

## 基础信息

- **Base URL**: `http://localhost:3001`
- **API Version**: v1
- **Content-Type**: `application/json`
- **认证**: 暂不需要（后续可添加 JWT 认证）

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "message": "操作成功"
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {}
  }
}
```

### 分页响应

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

## 健康检查 API

### GET /health

检查服务健康状态

**响应示例:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "database": "connected",
  "rpcBackend": "connected"
}
```

## 代币管理 API

### GET /api/tokens

获取代币列表

**查询参数:**
- `page` (number, optional): 页码，默认 1
- `limit` (number, optional): 每页数量，默认 20
- `chain_id` (number, optional): 链 ID
- `verified` (boolean, optional): 是否只显示已验证代币

**响应示例:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "address": "0x0000000000000000000000000000000000000000",
        "name": "Ethereum",
        "symbol": "ETH",
        "decimals": 18,
        "chain_id": 1,
        "logo_url": "https://cryptologos.cc/logos/ethereum-eth-logo.png",
        "is_verified": true,
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### GET /api/tokens/search

搜索代币

**查询参数:**
- `q` (string, required): 搜索关键词
- `chain_id` (number, optional): 链 ID
- `limit` (number, optional): 返回数量限制，默认 10

### GET /api/tokens/:address

获取代币详情

**路径参数:**
- `address` (string): 代币合约地址

**查询参数:**
- `chain_id` (number, required): 链 ID

### POST /api/tokens

添加新代币

**请求体:**
```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "chain_id": 1
}
```

### PUT /api/tokens/:address

更新代币信息

**请求体:**
```json
{
  "name": "New Token Name",
  "symbol": "NTN",
  "logo_url": "https://example.com/logo.png",
  "is_verified": true
}
```

### DELETE /api/tokens/:address

删除代币

**查询参数:**
- `chain_id` (number, required): 链 ID

### GET /api/tokens/popular

获取热门代币

**查询参数:**
- `chain_id` (number, optional): 链 ID
- `limit` (number, optional): 返回数量，默认 10

### GET /api/tokens/:address/balance/:userAddress

获取用户代币余额

**路径参数:**
- `address`: 代币地址
- `userAddress`: 用户地址

**查询参数:**
- `chain_id` (number, required): 链 ID

## 交易系统 API

### GET /api/swap/quote

获取交换报价

**查询参数:**
- `tokenIn` (string, required): 输入代币地址
- `tokenOut` (string, required): 输出代币地址
- `amountIn` (string, required): 输入数量
- `chainId` (number, required): 链 ID
- `slippage` (number, optional): 滑点容忍度，默认 0.5

**响应示例:**
```json
{
  "success": true,
  "data": {
    "amountIn": "1000000000000000000",
    "amountOut": "1950000000",
    "amountOutMin": "1930500000",
    "priceImpact": "0.25",
    "route": [
      {
        "address": "0x...",
        "symbol": "ETH"
      },
      {
        "address": "0x...",
        "symbol": "USDC"
      }
    ],
    "gasEstimate": "150000"
  }
}
```

### POST /api/swap/execute

执行代币交换

**请求体:**
```json
{
  "user_address": "0x742d35cc6634c0532925a3b8d0c9e3e8d4c4c4c4",
  "token_in": "0x0000000000000000000000000000000000000000",
  "token_out": "0xa0b86a33e6441e6c7b4b1b248e0b0b4b1b1b1b1b",
  "amount_in": "1000000000000000000",
  "amount_out_min": "1930500000",
  "chain_id": 1,
  "slippage": 0.5
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "transaction_hash": "0xabcdef...",
    "status": "pending",
    "amount_in": "1000000000000000000",
    "amount_out": "1950000000"
  }
}
```

### GET /api/swap/history/:userAddress

获取用户交易历史

**路径参数:**
- `userAddress`: 用户地址

**查询参数:**
- `page` (number, optional): 页码
- `limit` (number, optional): 每页数量
- `chain_id` (number, optional): 链 ID
- `status` (string, optional): 交易状态

### GET /api/swap/transaction/:hash

获取交易详情

**路径参数:**
- `hash`: 交易哈希

### PUT /api/swap/transaction/:hash/status

更新交易状态

**请求体:**
```json
{
  "status": "completed",
  "gas_used": "145000",
  "gas_price": "20000000000"
}
```

## 流动性管理 API

### POST /api/liquidity/add

添加流动性

**请求体:**
```json
{
  "user_address": "0x742d35cc6634c0532925a3b8d0c9e3e8d4c4c4c4",
  "token_a": "0x0000000000000000000000000000000000000000",
  "token_b": "0xa0b86a33e6441e6c7b4b1b248e0b0b4b1b1b1b1b",
  "amount_a": "1000000000000000000",
  "amount_b": "2000000000",
  "amount_a_min": "950000000000000000",
  "amount_b_min": "1900000000",
  "chain_id": 1
}
```

### POST /api/liquidity/remove

移除流动性

**请求体:**
```json
{
  "user_address": "0x742d35cc6634c0532925a3b8d0c9e3e8d4c4c4c4",
  "pair_address": "0x1234567890123456789012345678901234567890",
  "liquidity_amount": "500000000000000000",
  "amount_a_min": "450000000000000000",
  "amount_b_min": "900000000",
  "chain_id": 1
}
```

### GET /api/liquidity/positions/:userAddress

获取用户流动性位置

**路径参数:**
- `userAddress`: 用户地址

**查询参数:**
- `chain_id` (number, optional): 链 ID
- `active` (boolean, optional): 是否只显示活跃位置

### GET /api/liquidity/position/:positionId

获取特定流动性位置

**路径参数:**
- `positionId`: 位置 ID

### GET /api/liquidity/reserves/:pairAddress

获取交易对储备量

**路径参数:**
- `pairAddress`: 交易对地址

**查询参数:**
- `chain_id` (number, required): 链 ID

## 农场质押 API

### GET /api/farms

获取农场列表

**查询参数:**
- `page` (number, optional): 页码
- `limit` (number, optional): 每页数量
- `chain_id` (number, optional): 链 ID
- `active` (boolean, optional): 是否只显示活跃农场

**响应示例:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "ETH-USDC LP Farm",
        "contract_address": "0x4567890123456789012345678901234567890123",
        "staking_token": "0x1234567890123456789012345678901234567890",
        "reward_token": "0x0000000000000000000000000000000000000000",
        "chain_id": 1,
        "apy": 25.5,
        "total_staked": "1000000000000000000000",
        "start_block": 18500000,
        "end_block": 19000000,
        "reward_per_block": "100000000000000000",
        "is_active": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "totalPages": 1
    }
  }
}
```

### GET /api/farms/:farmId

获取农场详情

**路径参数:**
- `farmId`: 农场 ID

### POST /api/farms/stake

质押代币

**请求体:**
```json
{
  "user_address": "0x742d35cc6634c0532925a3b8d0c9e3e8d4c4c4c4",
  "farm_id": 1,
  "amount": "1000000000000000000"
}
```

### POST /api/farms/unstake

取消质押

**请求体:**
```json
{
  "user_address": "0x742d35cc6634c0532925a3b8d0c9e3e8d4c4c4c4",
  "farm_id": 1,
  "amount": "500000000000000000"
}
```

### POST /api/farms/harvest

收获奖励

**请求体:**
```json
{
  "user_address": "0x742d35cc6634c0532925a3b8d0c9e3e8d4c4c4c4",
  "farm_id": 1
}
```

### GET /api/farms/positions/:userAddress

获取用户质押位置

**路径参数:**
- `userAddress`: 用户地址

**查询参数:**
- `farm_id` (number, optional): 农场 ID
- `active` (boolean, optional): 是否只显示活跃位置

### GET /api/farms/rewards/:userAddress/:farmId

获取待收获奖励

**路径参数:**
- `userAddress`: 用户地址
- `farmId`: 农场 ID

## 用户管理 API

### GET /api/users

获取用户列表

**查询参数:**
- `page` (number, optional): 页码
- `limit` (number, optional): 每页数量
- `search` (string, optional): 搜索关键词

### GET /api/users/search

搜索用户

**查询参数:**
- `q` (string, required): 搜索关键词
- `limit` (number, optional): 返回数量限制

### GET /api/users/:address

获取用户信息

**路径参数:**
- `address`: 用户地址

### POST /api/users

创建用户

**请求体:**
```json
{
  "address": "0x742d35cc6634c0532925a3b8d0c9e3e8d4c4c4c4",
  "username": "alice_trader",
  "email": "alice@example.com",
  "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=alice"
}
```

### PUT /api/users/:address

更新用户信息

**请求体:**
```json
{
  "username": "new_username",
  "email": "newemail@example.com",
  "avatar_url": "https://example.com/avatar.png",
  "preferences": {
    "defaultChain": 1,
    "slippageTolerance": 0.5,
    "theme": "dark"
  }
}
```

### DELETE /api/users/:address

删除用户（软删除）

### GET /api/users/:address/portfolio

获取用户投资组合

**路径参数:**
- `address`: 用户地址

**响应示例:**
```json
{
  "success": true,
  "data": {
    "totalValueUSD": "10000.50",
    "balances": [
      {
        "chain_id": 1,
        "symbol": "ETH",
        "balance": "5.0",
        "valueUSD": "10000.00"
      }
    ]
  }
}
```

### GET /api/users/:address/transactions

获取用户交易历史

**查询参数:**
- `page` (number, optional): 页码
- `limit` (number, optional): 每页数量
- `chain_id` (number, optional): 链 ID
- `type` (string, optional): 交易类型

## 价格服务 API

### GET /api/prices/:tokenAddress

获取代币价格

**路径参数:**
- `tokenAddress`: 代币地址

**查询参数:**
- `chain_id` (number, required): 链 ID

**响应示例:**
```json
{
  "success": true,
  "data": {
    "token_address": "0x0000000000000000000000000000000000000000",
    "chain_id": 1,
    "price_usd": "2000.50",
    "price_change_24h": 2.5,
    "market_cap": "240000000000",
    "volume_24h": "15000000000",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /api/prices/batch

批量获取代币价格

**请求体:**
```json
{
  "tokens": [
    {
      "address": "0x0000000000000000000000000000000000000000",
      "chain_id": 1
    },
    {
      "address": "0xa0b86a33e6441e6c7b4b1b248e0b0b4b1b1b1b1b",
      "chain_id": 1
    }
  ]
}
```

### PUT /api/prices/:tokenAddress

更新代币价格

**请求体:**
```json
{
  "chain_id": 1,
  "price_usd": "2100.00",
  "price_change_24h": 5.0,
  "market_cap": "252000000000",
  "volume_24h": "18000000000"
}
```

### GET /api/prices/:tokenAddress/history

获取价格历史

**查询参数:**
- `chain_id` (number, required): 链 ID
- `timeframe` (string, optional): 时间范围 (1h, 24h, 7d, 30d)
- `limit` (number, optional): 返回数量限制

### POST /api/prices/sync

同步价格数据

**请求体:**
```json
{
  "tokens": [
    {
      "address": "0x0000000000000000000000000000000000000000",
      "chain_id": 1
    }
  ]
}
```

## 错误代码

| 错误代码 | 描述 |
|----------|------|
| `VALIDATION_ERROR` | 请求参数验证失败 |
| `TOKEN_NOT_FOUND` | 代币未找到 |
| `USER_NOT_FOUND` | 用户未找到 |
| `FARM_NOT_FOUND` | 农场未找到 |
| `INSUFFICIENT_BALANCE` | 余额不足 |
| `INVALID_SLIPPAGE` | 无效的滑点设置 |
| `TRANSACTION_FAILED` | 交易执行失败 |
| `RPC_ERROR` | RPC 服务错误 |
| `DATABASE_ERROR` | 数据库错误 |
| `RATE_LIMIT_EXCEEDED` | 请求频率超限 |
| `INTERNAL_SERVER_ERROR` | 内部服务器错误 |

## 状态码

| 状态码 | 描述 |
|--------|------|
| `200` | 请求成功 |
| `201` | 创建成功 |
| `400` | 请求参数错误 |
| `404` | 资源未找到 |
| `429` | 请求频率超限 |
| `500` | 内部服务器错误 |
| `503` | 服务不可用 |

## 认证（未来功能）

未来版本将支持 JWT 认证：

```http
Authorization: Bearer <jwt_token>
```

## 限流

API 实施了限流机制：
- 每个 IP 每 15 分钟最多 100 个请求
- 超出限制将返回 429 状态码

## WebSocket 支持（未来功能）

未来版本将支持 WebSocket 实时数据推送：
- 价格更新
- 交易状态变更
- 流动性变化
- 农场奖励更新