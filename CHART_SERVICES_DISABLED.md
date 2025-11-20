# 图表服务已禁用

## 更改说明

由于前端已经移除了 CHART 功能，后端的价格收集服务也已被禁用。

## 已禁用的服务

### 1. Price Collector (`priceCollector`)
- **功能**：收集交易对的实时价格数据
- **状态**：已禁用
- **文件**：`src/services/priceCollector.ts`

### 2. Hot Pairs Monitor (`hotPairsMonitor`)
- **功能**：扫描和监控热门交易对
- **状态**：已禁用
- **文件**：`src/services/hotPairsMonitor.ts`

## 修改的文件

### `src/server.ts`
```typescript
// 图表功能已移除 - 不需要价格收集服务
// import { priceCollector } from './services/priceCollector';
// import { hotPairsMonitor } from './services/hotPairsMonitor';

// ...

// 图表功能已移除 - 禁用价格收集服务
// priceCollector.start();
// hotPairsMonitor.start();
```

## 影响

### ✅ 优点
1. **减少 RPC 调用**：不再频繁扫描链上数据
2. **降低服务器负载**：不再运行定时任务
3. **减少错误日志**：不会再看到 "RPC request failed" 错误
4. **节省资源**：不再存储大量价格历史数据

### ⚠️ 注意事项
1. 图表相关的 API 端点仍然存在，但不会有新数据
2. 数据库中的历史价格数据仍然保留
3. 如果将来需要恢复图表功能，只需取消注释这些代码

## 仍在运行的服务

### ✅ Daily Settlement
- **功能**：每日结算用户奖励
- **状态**：正常运行
- **说明**：这是核心功能，必须保持运行

### ✅ API 服务
- **功能**：用户注册、个人资料、交易记录等
- **状态**：正常运行
- **说明**：前端需要这些 API

## 重启后端服务

禁用这些服务后，需要重启后端：

```bash
# 停止当前后端服务 (Ctrl+C)
# 重新启动
npm run dev
```

## 验证

重启后，您应该看到：
- ✅ 服务器正常启动
- ✅ 没有 "Found 20929 total pairs" 日志
- ✅ 没有 "Scanning pairs..." 日志
- ✅ 没有 "RPC request failed" 错误

## 如何恢复图表功能

如果将来需要恢复图表功能：

1. 在 `src/server.ts` 中取消注释：
```typescript
import { priceCollector } from './services/priceCollector';
import { hotPairsMonitor } from './services/hotPairsMonitor';

// ...

priceCollector.start();
hotPairsMonitor.start();
```

2. 在前端恢复图表组件
3. 重启前后端服务

## 数据库清理（可选）

如果想清理历史价格数据以节省空间：

```bash
# 备份数据库
cp eagle_swap.db eagle_swap.db.backup

# 清理价格数据（可选）
# 注意：这会删除所有历史价格数据
sqlite3 eagle_swap.db "DELETE FROM price_snapshots;"
sqlite3 eagle_swap.db "DELETE FROM candles;"
sqlite3 eagle_swap.db "VACUUM;"
```

⚠️ **警告**：只有在确定不需要历史数据时才执行清理操作！

## 总结

✅ **已完成**：
- 禁用了价格收集服务
- 禁用了热门交易对监控
- 减少了不必要的 RPC 调用和错误日志

🎯 **结果**：
- 后端更轻量级
- 日志更清晰
- 资源消耗更少
- Swap 核心功能不受影响
