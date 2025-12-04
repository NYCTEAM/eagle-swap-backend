# NFT Token ID 立即清理机制

## 🚀 新功能：交易失败立即释放 Token ID

### 问题
之前的机制：
```
用户请求铸造 → 分配 Token ID #1 → 交易失败 ❌
                                    ↓
                            等待 30 分钟才清理 ⏰
                                    ↓
                            Token ID #1 被浪费 30 分钟
```

### 解决方案
现在的机制：
```
用户请求铸造 → 分配 Token ID #1 → 交易失败 ❌
                                    ↓
                            前端立即通知后端 ⚡
                                    ↓
                            后端立即清理 🧹
                                    ↓
                            Token ID #1 马上可用 ✅
```

---

## 📊 清理机制对比

### 方式 1: 自动清理（30分钟）

**适用场景：**
- 用户关闭浏览器
- 用户忘记完成交易
- 网络断开

**特点：**
- ⏰ 30 分钟后自动清理
- 🔄 定期检查过期预留
- 🛡️ 保底机制

### 方式 2: 立即清理（新增）⚡

**适用场景：**
- 用户拒绝交易
- 交易失败（余额不足、Gas 不足等）
- 用户主动取消
- 合约调用失败

**特点：**
- ⚡ 立即释放 Token ID
- 🎯 精准清理
- 📈 提高 Token ID 利用率

---

## 🔧 API 接口

### 1. 标记铸造失败（立即清理）

```http
POST /api/nft/mark-failed
Content-Type: application/json

{
  "globalTokenId": 1,
  "reason": "User rejected transaction"
}
```

**响应：**
```json
{
  "success": true,
  "message": "Token ID 1 released and available for next user"
}
```

**使用场景：**
- ❌ 用户拒绝交易
- ❌ 交易失败
- ❌ 合约调用失败
- ❌ Gas 估算失败

### 2. 取消预留（用户主动取消）

```http
POST /api/nft/cancel-reservation
Content-Type: application/json

{
  "globalTokenId": 1,
  "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**响应：**
```json
{
  "success": true,
  "message": "Reservation cancelled, Token ID 1 is now available"
}
```

**使用场景：**
- 🚫 用户点击"取消"按钮
- 🚫 用户关闭购买弹窗
- 🚫 用户改变主意

---

## 💻 前端集成示例

### React/TypeScript 示例

```typescript
// 购买 NFT 流程
const handlePurchaseNFT = async (level: number) => {
  let mintData = null;

  try {
    // 1. 请求后端分配 Token ID
    const response = await fetch('/api/nft/request-mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: address,
        level,
        chainId: 196
      })
    });

    mintData = await response.json();
    const { globalTokenId, signature, deadline } = mintData.data;

    console.log(`✅ Token ID ${globalTokenId} reserved`);

    // 2. 检查 USDT 授权
    const allowance = await checkUSDTAllowance();
    if (allowance < price) {
      await approveUSDT(price);
    }

    // 3. 调用合约铸造
    const tx = await contract.mintWithSignature(
      globalTokenId,
      level,
      totalMinted,
      deadline,
      signature
    );

    console.log('⏳ Waiting for transaction...');
    await tx.wait();

    // 4. 确认铸造成功
    await fetch('/api/nft/confirm-mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        globalTokenId,
        txHash: tx.hash,
        signature,
        deadline
      })
    });

    console.log('✅ NFT minted successfully!');
    alert('NFT 铸造成功！');

  } catch (error: any) {
    console.error('❌ Purchase failed:', error);

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

      console.log('🧹 Token ID released immediately');
    }

    alert('购买失败: ' + error.message);
  }
};

// 用户取消购买
const handleCancelPurchase = async (globalTokenId: number) => {
  try {
    await fetch('/api/nft/cancel-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        globalTokenId,
        userAddress: address
      })
    });

    console.log('🚫 Purchase cancelled, Token ID released');
  } catch (error) {
    console.error('Cancel error:', error);
  }
};
```

---

## 📈 效果对比

### 场景：高峰期 100 个用户同时购买

#### 旧机制（只有 30 分钟自动清理）

```
12:00 PM - 100 个用户请求铸造
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

分配 Token ID 1-100

结果:
✅ 50 个成功铸造 (Token ID 1-50)
❌ 50 个失败（余额不足、拒绝等）(Token ID 51-100)

Token ID 51-100 状态:
⏰ 等待 30 分钟才能释放
⛔ 12:00-12:30 期间无法使用
⛔ 新用户只能从 Token ID 101 开始

影响:
- Token ID 不连续：1-50, 101-150...
- 浪费 30 分钟 × 50 个 Token ID
```

#### 新机制（立即清理）⚡

```
12:00 PM - 100 个用户请求铸造
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

分配 Token ID 1-100

结果:
✅ 50 个成功铸造 (Token ID 1-50)
❌ 50 个失败 → 立即清理 🧹 (Token ID 51-100)

Token ID 51-100 状态:
⚡ 立即释放
✅ 马上可用

12:01 PM - 新用户请求铸造
分配 Token ID 51 ✅ (刚才释放的)

影响:
- Token ID 连续：1, 2, 3, 4, 5...
- 无浪费
- 高效利用
```

---

## 🎯 Token ID 分配策略

### 优先使用最小的可用 Token ID

```typescript
static getNextAvailableTokenId(): number {
  const stats = db.prepare('SELECT last_token_id FROM nft_global_stats WHERE id = 1').get();
  let nextId = stats.last_token_id + 1;

  // 从 1 开始查找第一个可用的 Token ID
  while (nextId <= MAX_TOKEN_ID) {
    const existing = db.prepare(`
      SELECT global_token_id FROM nft_global_token_allocation 
      WHERE global_token_id = ?
    `).get(nextId);

    if (!existing) {
      return nextId; // 找到可用的 Token ID
    }

    nextId++;
  }

  throw new Error('No available Token IDs');
}
```

**效果：**
```
Token ID 分配顺序:
1 → 2 → 3 → 4 → 5 (失败，立即清理) → 5 (重新分配) → 6 → 7...

而不是:
1 → 2 → 3 → 4 → 5 (失败) → 6 → 7 → ... → 30分钟后 → 5 可用
```

---

## 🔍 监控和统计

### 查看立即清理的记录

```sql
-- 查看失败的预留
SELECT 
  global_token_id,
  user_address,
  datetime(reserved_at, 'unixepoch') as reserved_time,
  status
FROM nft_token_reservations
WHERE status = 'failed'
ORDER BY reserved_at DESC
LIMIT 20;
```

### 统计清理效率

```sql
-- 统计各种状态的数量
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM nft_token_reservations) as percentage
FROM nft_token_reservations
GROUP BY status;

-- 结果示例:
-- status   | count | percentage
-- ---------|-------|------------
-- used     | 1000  | 70%        (成功铸造)
-- failed   | 300   | 21%        (立即清理)
-- expired  | 100   | 7%         (30分钟清理)
-- active   | 30    | 2%         (进行中)
```

---

## ⚙️ 配置建议

### 何时使用立即清理

✅ **推荐使用：**
- 用户拒绝交易
- 交易失败（明确的错误）
- 用户主动取消
- 合约调用失败

❌ **不推荐使用：**
- 网络超时（可能还在处理）
- 不确定的错误
- 交易 pending 状态

### 错误处理最佳实践

```typescript
try {
  const tx = await contract.mintWithSignature(...);
  await tx.wait();
} catch (error: any) {
  // 判断错误类型
  if (error.code === 'ACTION_REJECTED') {
    // 用户拒绝 → 立即清理
    await markAsFailed(globalTokenId, 'User rejected');
  } else if (error.code === 'INSUFFICIENT_FUNDS') {
    // 余额不足 → 立即清理
    await markAsFailed(globalTokenId, 'Insufficient funds');
  } else if (error.code === 'CALL_EXCEPTION') {
    // 合约调用失败 → 立即清理
    await markAsFailed(globalTokenId, 'Contract call failed');
  } else {
    // 其他错误 → 等待 30 分钟自动清理（保险机制）
    console.warn('Unknown error, will auto-cleanup in 30 minutes');
  }
}
```

---

## 📊 数据库状态变化

### 立即清理流程

```
初始状态:
┌─────────────────────────────────────┐
│ Token ID: 1                         │
│ 状态: reserved                      │
│ 用户: 0xABC...                      │
│ 过期时间: 12:30 PM                  │
└─────────────────────────────────────┘

用户交易失败 (12:05 PM):
  ↓
前端调用 /api/nft/mark-failed
  ↓
后端立即清理:
  1. DELETE FROM nft_global_token_allocation WHERE global_token_id = 1
  2. UPDATE nft_token_reservations SET status = 'failed'
  3. UPDATE nft_global_stats SET total_reserved = total_reserved - 1
  ↓
Token ID 1 重新可用 (12:05 PM) ✅

下一个用户 (12:06 PM):
  ↓
分配 Token ID 1 ✅ (刚才释放的)
```

---

## ✅ 总结

### 双重清理机制

1. **立即清理** ⚡
   - 交易失败时立即触发
   - 前端主动调用 API
   - 精准、高效

2. **自动清理** ⏰
   - 30 分钟后自动触发
   - 后端定期检查
   - 保底机制

### 优势

✅ **Token ID 连续性**
- 避免断断续续
- 从小到大顺序分配

✅ **高效利用**
- 失败的 Token ID 立即可用
- 不浪费 30 分钟

✅ **用户体验**
- 失败后立即可以重试
- 不用等待

✅ **系统稳定**
- 双重保险
- 不会遗漏

### 实现要点

1. 前端必须在交易失败时调用 `mark-failed` API
2. 后端保留 30 分钟自动清理作为保底
3. 优先分配最小的可用 Token ID
4. 记录失败原因便于分析

---

## 🔗 相关文档

- [自动清理机制详解](./NFT_AUTO_CLEANUP_EXPLAINED.md)
- [部署指南](./DEPLOY_NFT_SYSTEM.md)
- [迁移指南](../NFT_CONTRACT_MIGRATION_GUIDE.md)
