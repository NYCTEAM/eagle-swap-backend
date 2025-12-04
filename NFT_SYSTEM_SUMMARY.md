# NFT 全局 Token ID 系统 - 完整总结

## 🎯 系统概述

全新的 NFT 铸造系统，使用**后端控制的全局唯一 Token ID (1-13900)**，支持多链共享供应量。

### 核心特性

✅ **全局唯一 Token ID**
- 跨链唯一（X Layer、BSC、Solana）
- 范围：1-13900
- 顺序分配，不重复

✅ **后端签名铸造**
- 防止超卖
- 防止重复铸造
- 30分钟签名有效期

✅ **阶段衰减**
- Stage 1: 0-2780 (100%)
- Stage 2: 2780-5560 (95%)
- Stage 3: 5560-8340 (90%)
- Stage 4: 8340-11120 (85%)
- Stage 5: 11120-13900 (80%)

✅ **双重清理机制** ⚡
- **立即清理**：交易失败时马上释放 Token ID
- **自动清理**：30分钟后自动清理过期预留

---

## 📊 清理机制对比

### 1. 立即清理 ⚡ (新增)

**触发条件：**
- 用户拒绝交易
- 交易失败（余额不足、Gas 不足）
- 用户主动取消
- 合约调用失败

**特点：**
- ⚡ 立即释放 Token ID
- 🎯 精准清理
- 📈 高效利用
- 🔄 Token ID 连续

**API：**
```http
POST /api/nft/mark-failed
POST /api/nft/cancel-reservation
```

### 2. 自动清理 ⏰ (保底机制)

**触发条件：**
- 30分钟后自动检查
- 用户关闭浏览器
- 用户忘记完成交易
- 网络断开

**特点：**
- ⏰ 30分钟后自动清理
- 🔄 定期检查
- 🛡️ 保底机制

---

## 🔄 完整铸造流程

```
用户点击购买
    ↓
前端调用 POST /api/nft/request-mint
    ↓
后端分配全局 Token ID (1-13900)
    ↓
后端生成签名（30分钟有效期）
    ↓
返回 {globalTokenId, signature, deadline}
    ↓
前端检查 USDT 授权
    ↓
前端调用合约 mintWithSignature(...)
    ↓
┌─────────────────────────────────────┐
│ 成功 ✅                             │
│   ↓                                 │
│ 前端调用 POST /api/nft/confirm-mint│
│   ↓                                 │
│ 后端更新数据库（标记为已铸造）      │
│   ↓                                 │
│ 完成 ✅                             │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 失败 ❌                             │
│   ↓                                 │
│ 前端调用 POST /api/nft/mark-failed │
│   ↓                                 │
│ 后端立即清理 Token ID 🧹           │
│   ↓                                 │
│ Token ID 重新可用 🔄               │
└─────────────────────────────────────┘
```

---

## 📡 API 接口列表

### 1. 请求铸造 NFT
```http
POST /api/nft/request-mint
```
分配全局 Token ID 并生成签名

### 2. 确认铸造成功
```http
POST /api/nft/confirm-mint
```
标记 Token ID 为已铸造

### 3. 标记铸造失败（立即清理）⚡
```http
POST /api/nft/mark-failed
```
立即释放 Token ID

### 4. 取消预留（用户主动取消）⚡
```http
POST /api/nft/cancel-reservation
```
用户主动取消，立即释放

### 5. 获取全局统计
```http
GET /api/nft/global-stats
```
获取总铸造数、当前阶段等

### 6. 获取用户 NFT
```http
GET /api/nft/user/:address
```
获取用户持有的所有 NFT（跨链）

### 7. 获取等级信息
```http
GET /api/nft/levels
```
获取所有 NFT 等级信息

---

## 🗄️ 数据库表结构

### 1. nft_global_token_allocation
全局 Token ID 分配记录

| 字段 | 说明 |
|------|------|
| global_token_id | 全局 Token ID (1-13900) |
| chain_id | 链 ID (196=X Layer, 56=BSC) |
| owner_address | 持有者地址 |
| level | NFT 等级 (1-7) |
| status | reserved, minted, failed |
| minted_at | 铸造时间戳 |
| tx_hash | 交易哈希 |

### 2. nft_global_stats
全局统计（单行表）

| 字段 | 说明 |
|------|------|
| total_minted | 总铸造数 |
| total_reserved | 总预留数 |
| current_stage | 当前阶段 (1-5) |
| stage_efficiency | 阶段效率 (100-80) |
| last_token_id | 最后分配的 Token ID |
| xlayer_minted | X Layer 铸造数 |
| bsc_minted | BSC 铸造数 |

### 3. nft_level_stats
等级统计

| 字段 | 说明 |
|------|------|
| level | 等级 (1-7) |
| level_name | 等级名称 |
| total_supply | 总供应量 |
| minted | 已铸造数 |
| available | 可用数量 |
| weight | 挖矿权重 |
| price_usdt | USDT 价格 |

### 4. nft_token_reservations
Token ID 预留记录

| 字段 | 说明 |
|------|------|
| global_token_id | 全局 Token ID |
| user_address | 用户地址 |
| reserved_at | 预留时间 |
| expires_at | 过期时间 |
| status | active, used, expired, failed |

### 5. nft_holders
NFT 持有者（跨链）

| 字段 | 说明 |
|------|------|
| global_token_id | 全局 Token ID |
| chain_id | 链 ID |
| owner_address | 持有者地址 |
| level | NFT 等级 |
| weight | 基础权重 |
| effective_weight | 有效权重（考虑衰减） |
| stage | 铸造时的阶段 |

---

## 📂 文件结构

```
eagle-swap-backend/
├── src/
│   ├── database/
│   │   └── schema-nft-global-tokenid.sql      # 数据库 Schema
│   ├── services/
│   │   ├── nftTokenManager.ts                 # Token ID 管理服务
│   │   └── nftSignatureService.ts             # 签名生成服务
│   └── routes/
│       └── nftRoutes.ts                       # NFT API 路由
├── init-nft-global-system.js                  # 数据库初始化脚本
├── test-nft-mint-flow.js                      # 测试脚本
├── DEPLOY_NFT_SYSTEM.md                       # 部署指南
├── NFT_AUTO_CLEANUP_EXPLAINED.md              # 自动清理详解
├── NFT_IMMEDIATE_CLEANUP.md                   # 立即清理详解
└── NFT_SYSTEM_SUMMARY.md                      # 系统总结（本文件）
```

---

## 🚀 快速开始

### 1. 初始化数据库
```bash
cd eagle-swap-backend
node init-nft-global-system.js
```

### 2. 配置环境变量
```bash
# .env
XLAYER_NFT_ADDRESS=0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7
SIGNER_PRIVATE_KEY=e00bb4d50908b7bae5e3018ff1cbc3b1d39d2c4acd3fc56f8f92b54a1e344ae9
```

### 3. 启动服务
```bash
npm run dev
# 或
pm2 restart eagle-swap-backend
```

### 4. 测试
```bash
# 测试完整流程
node test-nft-mint-flow.js 1

# 测试立即清理
node test-nft-mint-flow.js 2

# 运行所有测试
node test-nft-mint-flow.js 3
```

---

## 💻 前端集成示例

```typescript
const handlePurchaseNFT = async (level: number) => {
  let mintData = null;

  try {
    // 1. 请求后端分配 Token ID
    const response = await fetch('/api/nft/request-mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: address, level, chainId: 196 })
    });

    mintData = await response.json();
    const { globalTokenId, signature, deadline, totalMinted } = mintData.data;

    // 2. 检查 USDT 授权
    const allowance = await checkUSDTAllowance();
    if (allowance < price) {
      await approveUSDT(price);
    }

    // 3. 调用合约铸造
    const tx = await contract.mintWithSignature(
      globalTokenId, level, totalMinted, deadline, signature
    );
    await tx.wait();

    // 4. 确认铸造成功
    await fetch('/api/nft/confirm-mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ globalTokenId, txHash: tx.hash, signature, deadline })
    });

    alert('NFT 铸造成功！');

  } catch (error: any) {
    // 🚨 关键：交易失败时立即清理 Token ID
    if (mintData?.data?.globalTokenId) {
      await fetch('/api/nft/mark-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globalTokenId: mintData.data.globalTokenId,
          reason: error.message || 'Transaction failed'
        })
      });
    }

    alert('购买失败: ' + error.message);
  }
};
```

---

## 📈 效果对比

### Token ID 分配对比

#### 旧系统（无立即清理）
```
用户 A: Token ID 1 ✅ 成功
用户 B: Token ID 2 ❌ 失败 → 等待 30 分钟
用户 C: Token ID 3 ✅ 成功
用户 D: Token ID 4 ❌ 失败 → 等待 30 分钟
用户 E: Token ID 5 ✅ 成功

结果：Token ID 2, 4 被浪费 30 分钟
新用户只能从 Token ID 6 开始
```

#### 新系统（有立即清理）⚡
```
用户 A: Token ID 1 ✅ 成功
用户 B: Token ID 2 ❌ 失败 → 立即释放 🧹
用户 C: Token ID 2 ✅ 成功（重新使用）
用户 D: Token ID 3 ❌ 失败 → 立即释放 🧹
用户 E: Token ID 3 ✅ 成功（重新使用）

结果：Token ID 连续 1, 2, 3...
无浪费，高效利用 ✅
```

---

## ⚠️ 注意事项

### 1. 前端必须实现错误处理
```typescript
// ✅ 正确
try {
  await mintNFT();
} catch (error) {
  await markAsFailed(globalTokenId); // 立即清理
}

// ❌ 错误
try {
  await mintNFT();
} catch (error) {
  // 没有清理，浪费 30 分钟
}
```

### 2. 判断错误类型
```typescript
if (error.code === 'ACTION_REJECTED') {
  // 用户拒绝 → 立即清理
  await markAsFailed(globalTokenId, 'User rejected');
} else if (error.code === 'INSUFFICIENT_FUNDS') {
  // 余额不足 → 立即清理
  await markAsFailed(globalTokenId, 'Insufficient funds');
} else {
  // 其他错误 → 等待自动清理（保险）
}
```

### 3. 签名有效期
- 30 分钟有效期
- 过期后需要重新请求
- 前端应显示倒计时

### 4. 并发控制
- 数据库使用事务
- 防止重复分配
- 定期清理过期记录

---

## 🔍 监控和调试

### 查看当前状态
```sql
-- 查看全局统计
SELECT * FROM nft_global_stats;

-- 查看活跃预留
SELECT * FROM nft_token_reservations WHERE status = 'active';

-- 查看失败记录
SELECT * FROM nft_token_reservations WHERE status = 'failed' ORDER BY reserved_at DESC LIMIT 10;
```

### 统计清理效率
```sql
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM nft_token_reservations) as percentage
FROM nft_token_reservations
GROUP BY status;
```

---

## 📞 相关文档

- [部署指南](./DEPLOY_NFT_SYSTEM.md) - 完整的部署步骤
- [自动清理详解](./NFT_AUTO_CLEANUP_EXPLAINED.md) - 30分钟自动清理机制
- [立即清理详解](./NFT_IMMEDIATE_CLEANUP.md) - 交易失败立即清理
- [迁移指南](../NFT_CONTRACT_MIGRATION_GUIDE.md) - 从旧系统迁移

---

## ✅ 系统优势

1. **Token ID 连续性** - 从 1 开始顺序分配，不断断续续
2. **高效利用** - 失败的 Token ID 立即可用，不浪费
3. **防止超卖** - 后端控制分配，绝对不会超过 13900
4. **跨链统一** - X Layer、BSC、Solana 共享供应量
5. **阶段衰减** - 自动计算挖矿效率
6. **双重保险** - 立即清理 + 自动清理
7. **用户体验** - 失败后立即可以重试

---

## 🎉 总结

这是一个完整的、生产就绪的 NFT 铸造系统：

✅ **后端完全控制** - Token ID 分配、签名生成
✅ **双重清理机制** - 立即清理 + 自动清理
✅ **Token ID 连续** - 不浪费，高效利用
✅ **跨链支持** - 多链共享供应量
✅ **阶段衰减** - 自动计算效率
✅ **完整文档** - 部署、测试、监控
✅ **生产就绪** - 经过测试，可直接部署

准备部署到生产环境！🚀
