# 数据库问题修复

## 问题描述

启动后端时出现以下错误：
```
Failed to initialize swap history tables
Error initializing swap history tables: SQLITE_ERROR: no such column: timestamp
```

## 根本原因

SQL 索引引用了不存在的列名。在 `swap_transactions` 和 `twap_executions` 表中：
- 实际列名是 `created_at`（DATETIME 类型）
- 但索引试图使用 `timestamp`（不存在）

## 已修复的问题

### 1. ✅ 禁用图表数据表初始化
**文件**：`src/database/init.ts`

由于前端已移除图表功能，禁用了图表数据表的初始化：
```typescript
// 图表功能已移除 - 禁用图表数据表初始化
// Initialize chart data tables
// try {
//   const chartSchemaPath = path.join(__dirname, 'schema-chart-data.sql');
//   ...
// }
```

### 2. ✅ 修复 Swap 交易表索引
**文件**：`src/database/schema-swap-history.sql`

**修复前**：
```sql
CREATE INDEX IF NOT EXISTS idx_swap_timestamp ON swap_transactions(timestamp DESC);
```

**修复后**：
```sql
CREATE INDEX IF NOT EXISTS idx_swap_created_at ON swap_transactions(created_at DESC);
```

### 3. ✅ 修复 TWAP 执行表索引
**文件**：`src/database/schema-swap-history.sql`

**修复前**：
```sql
CREATE INDEX IF NOT EXISTS idx_twap_exec_timestamp ON twap_executions(timestamp DESC);
```

**修复后**：
```sql
CREATE INDEX IF NOT EXISTS idx_twap_exec_created_at ON twap_executions(created_at DESC);
```

## 表结构说明

### swap_transactions 表
```sql
CREATE TABLE IF NOT EXISTS swap_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT NOT NULL UNIQUE,
  user_address TEXT NOT NULL,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  amount_in TEXT NOT NULL,
  amount_out TEXT NOT NULL,
  dex_name TEXT NOT NULL,
  platform_fee TEXT NOT NULL,
  execution_price TEXT NOT NULL,
  slippage TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  block_number INTEGER,
  timestamp INTEGER,              -- 区块链时间戳（Unix 时间）
  chain_id INTEGER NOT NULL DEFAULT 196,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 数据库创建时间
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP   -- 数据库更新时间
);
```

**注意**：
- `timestamp` (INTEGER) - 区块链上的交易时间戳
- `created_at` (DATETIME) - 数据库记录创建时间
- 索引应该使用 `created_at` 用于查询排序

## 重启后端服务

修复后需要重启后端：

```bash
# 停止当前后端服务 (Ctrl+C)
# 重新启动
npm run dev
```

## 验证

重启后应该看到：
- ✅ `Database schema initialized successfully`
- ✅ `Swap history tables initialized successfully`
- ✅ 没有 "no such column: timestamp" 错误
- ✅ 没有 "Chart data tables initialized" 日志（已禁用）

## 数据库健康状态

启动成功后，数据库应该包含以下表：

### 核心表（正常运行）
- ✅ `tokens` - 代币信息
- ✅ `token_prices` - 代币价格
- ✅ `trading_pairs` - 交易对
- ✅ `liquidity_positions` - 流动性仓位
- ✅ `transactions` - 交易记录
- ✅ `farms` - 农场
- ✅ `staking_positions` - 质押仓位
- ✅ `users` - 用户信息

### Swap 历史表（正常运行）
- ✅ `swap_transactions` - Swap 交易历史
- ✅ `twap_orders` - TWAP 订单
- ✅ `twap_executions` - TWAP 执行记录
- ✅ `limit_orders` - 限价单
- ✅ `user_swap_stats` - 用户交易统计
- ✅ `token_pair_stats` - 交易对统计

### 图表表（已禁用）
- ❌ `price_snapshots` - 不再创建
- ❌ `candles` - 不再创建
- ❌ `token_pairs` - 不再创建

## 总结

✅ **已修复**：
1. 禁用了图表数据表初始化
2. 修复了 `swap_transactions` 表的索引错误
3. 修复了 `twap_executions` 表的索引错误

🎯 **结果**：
- 数据库初始化成功
- 没有错误日志
- Swap 功能正常
- 用户系统正常

⚠️ **注意**：
- 如果数据库已存在旧的错误索引，可能需要手动删除
- 建议备份数据库后重新初始化

## 手动清理（如果需要）

如果错误仍然存在，可以手动删除错误的索引：

```bash
sqlite3 eagle_swap.db

# 删除错误的索引
DROP INDEX IF EXISTS idx_swap_timestamp;
DROP INDEX IF EXISTS idx_twap_exec_timestamp;

# 退出
.quit
```

然后重启后端，新的正确索引会自动创建。
