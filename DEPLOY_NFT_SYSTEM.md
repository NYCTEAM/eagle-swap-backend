# NFT 全局 Token ID 系统部署指南

## 📋 系统概述

新的 NFT 系统使用**后端控制的全局唯一 Token ID (1-13900)**，支持多链共享供应量。

### 核心特性
- ✅ 全局唯一 Token ID（跨 X Layer、BSC、Solana）
- ✅ 后端签名铸造（防止超卖和重复）
- ✅ 阶段衰减（100% → 95% → 90% → 85% → 80%）
- ✅ 30分钟签名有效期
- ✅ 自动清理过期预留

---

## 🚀 部署步骤

### 1. 初始化数据库

```bash
cd eagle-swap-backend

# 运行初始化脚本
node init-nft-global-system.js
```

**预期输出:**
```
🚀 初始化 NFT 全局 Token ID 管理系统...
✅ 数据库表创建成功！

📋 已创建的表:
  - nft_global_stats: 1 行
  - nft_global_token_allocation: 0 行
  - nft_holders: 0 行
  - nft_level_stats: 7 行
  - nft_token_reservations: 0 行

📊 全局统计:
  总铸造数: 0
  总预留数: 0
  当前阶段: 1
  阶段效率: 100%
  最后 Token ID: 0
```

### 2. 配置环境变量

编辑 `.env` 文件：

```bash
# NFT 合约地址
XLAYER_NFT_ADDRESS=0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7
BSC_NFT_ADDRESS=0xB6966D11898D7c6bC0cC942C013e314e2b4C4d15

# 后端签名者（与 SWAP Mining 使用同一个）
SIGNER_PRIVATE_KEY=e00bb4d50908b7bae5e3018ff1cbc3b1d39d2c4acd3fc56f8f92b54a1e344ae9
SIGNER_ADDRESS=0x4B53d659aC917a175315c3D38249edd55a8C963e
```

### 3. 启动后端服务

```bash
# 开发模式
npm run dev

# 生产模式
pm2 restart eagle-swap-backend
```

### 4. 测试 API

```bash
# 测试铸造流程
node test-nft-mint-flow.js
```

**预期输出:**
```
🧪 测试 NFT 铸造流程

1️⃣ 获取全局统计...
✅ 全局统计:
   总铸造: 0
   总预留: 0
   当前阶段: 1
   阶段效率: 100%

2️⃣ 请求铸造 NFT...
✅ 铸造请求成功:
   Global Token ID: 1
   Level: 1
   Current Stage: 1
   Stage Efficiency: 100%
   Contract: 0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7
   Chain: X Layer
   Signature: 0x1234...

3️⃣ 模拟确认铸造...
✅ 铸造确认成功

4️⃣ 验证统计更新...
✅ 更新后的统计:
   总铸造: 1
   总预留: 0
   最后 Token ID: 1
```

---

## 📡 API 接口

### 1. 请求铸造 NFT
```http
POST /api/nft/request-mint
Content-Type: application/json

{
  "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "level": 1,
  "chainId": 196
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "globalTokenId": 1,
    "level": 1,
    "totalMinted": 0,
    "deadline": 1733342400,
    "signature": "0x1234...",
    "contractAddress": "0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7",
    "chainId": 196,
    "chainName": "X Layer",
    "currentStage": 1,
    "stageEfficiency": 100,
    "expiresAt": "2025-12-04T17:00:00.000Z"
  }
}
```

### 2. 确认铸造
```http
POST /api/nft/confirm-mint
Content-Type: application/json

{
  "globalTokenId": 1,
  "txHash": "0xabc123...",
  "signature": "0x1234...",
  "deadline": 1733342400
}
```

### 3. 获取全局统计
```http
GET /api/nft/global-stats
```

### 4. 获取用户 NFT
```http
GET /api/nft/user/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

---

## 🔄 铸造流程

### 完整流程图

```
用户点击购买
    ↓
前端调用 /api/nft/request-mint
    ↓
后端分配全局 Token ID (1-13900)
    ↓
后端生成签名（30分钟有效期）
    ↓
返回 {globalTokenId, signature, deadline}
    ↓
前端检查 USDT 授权
    ↓
前端调用合约 mintWithSignature(globalTokenId, level, totalMinted, deadline, signature)
    ↓
合约验证签名
    ↓
合约铸造 NFT
    ↓
前端调用 /api/nft/confirm-mint
    ↓
后端更新数据库（标记为已铸造）
    ↓
完成 ✅
```

### 关键点

1. **Token ID 唯一性**
   - 后端维护全局 Token ID 计数器
   - 每次分配前检查是否已使用
   - 跨链共享，不会重复

2. **签名验证**
   - 后端使用私钥签名
   - 合约验证签名者地址
   - 包含 chainId 防止跨链重放

3. **过期处理**
   - 签名 30 分钟后过期
   - 自动清理过期的预留
   - 释放未使用的 Token ID

4. **阶段计算**
   - 基于全局总铸造数量
   - Stage 1: 0-2780 (100%)
   - Stage 2: 2780-5560 (95%)
   - Stage 3: 5560-8340 (90%)
   - Stage 4: 8340-11120 (85%)
   - Stage 5: 11120-13900 (80%)

---

## 🗄️ 数据库表

### nft_global_token_allocation
存储所有 Token ID 的分配记录

| 字段 | 类型 | 说明 |
|------|------|------|
| global_token_id | INTEGER | 全局 Token ID (1-13900) |
| chain_id | INTEGER | 链 ID (196=X Layer, 56=BSC) |
| owner_address | TEXT | 持有者地址 |
| level | INTEGER | NFT 等级 (1-7) |
| status | TEXT | 状态 (reserved, minted, failed) |
| minted_at | INTEGER | 铸造时间戳 |
| tx_hash | TEXT | 交易哈希 |

### nft_global_stats
全局统计（单行表）

| 字段 | 类型 | 说明 |
|------|------|------|
| total_minted | INTEGER | 总铸造数 |
| total_reserved | INTEGER | 总预留数 |
| current_stage | INTEGER | 当前阶段 (1-5) |
| stage_efficiency | INTEGER | 阶段效率 (100-80) |
| last_token_id | INTEGER | 最后分配的 Token ID |
| xlayer_minted | INTEGER | X Layer 铸造数 |
| bsc_minted | INTEGER | BSC 铸造数 |

### nft_level_stats
等级统计

| 字段 | 类型 | 说明 |
|------|------|------|
| level | INTEGER | 等级 (1-7) |
| level_name | TEXT | 等级名称 |
| total_supply | INTEGER | 总供应量 |
| minted | INTEGER | 已铸造数 |
| available | INTEGER | 可用数量 |
| weight | INTEGER | 挖矿权重 |
| price_usdt | INTEGER | USDT 价格 (6 decimals) |

---

## ⚠️ 注意事项

1. **私钥安全**
   - `SIGNER_PRIVATE_KEY` 必须妥善保管
   - 不要提交到 Git
   - 使用环境变量管理

2. **Token ID 范围**
   - 最大 13900 个
   - 跨链共享
   - 用完后无法继续铸造

3. **签名过期**
   - 30 分钟有效期
   - 过期后需要重新请求
   - 自动清理过期预留

4. **并发控制**
   - 使用数据库事务
   - 防止重复分配
   - 定期清理过期记录

---

## 🔧 故障排查

### 问题 1: Token ID 已被使用
```
Error: Token ID 123 is already reserved
```
**解决**: Token ID 已被预留，等待30分钟自动清理或手动清理过期预留

### 问题 2: 签名验证失败
```
Error: Invalid signature
```
**解决**: 检查 `SIGNER_PRIVATE_KEY` 是否正确，确保与合约中的 `backendSigner` 一致

### 问题 3: 等级售罄
```
Error: Level 1 is sold out
```
**解决**: 该等级已售罄，选择其他等级

---

## 📊 监控

### 关键指标

1. **总铸造数**: 监控是否接近 13900
2. **预留数**: 过多表示有大量未完成的交易
3. **当前阶段**: 影响挖矿效率
4. **各链分布**: X Layer、BSC、Solana 的铸造分布

### 查询命令

```sql
-- 查看全局统计
SELECT * FROM nft_global_stats;

-- 查看等级统计
SELECT * FROM nft_level_stats;

-- 查看最近铸造
SELECT * FROM nft_global_token_allocation 
WHERE status = 'minted' 
ORDER BY minted_at DESC 
LIMIT 10;

-- 查看过期预留
SELECT COUNT(*) FROM nft_token_reservations 
WHERE status = 'active' AND expires_at < strftime('%s', 'now');
```

---

## ✅ 部署检查清单

- [ ] 数据库表已创建
- [ ] 环境变量已配置
- [ ] 后端服务已启动
- [ ] API 测试通过
- [ ] 签名验证正常
- [ ] Token ID 分配正常
- [ ] 前端已更新
- [ ] 合约地址已更新

---

## 📞 支持

如有问题，请查看：
- 迁移指南: `NFT_CONTRACT_MIGRATION_GUIDE.md`
- 合约源码: `contracts-deploy/EagleAccessNFT_MultiChain_Global.sol`
- 测试脚本: `test-nft-mint-flow.js`
