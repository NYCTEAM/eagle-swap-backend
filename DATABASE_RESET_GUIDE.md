# 数据库重置指南

## 问题说明

启动后端时仍然出现错误：
```
Error initializing swap history tables: SQLITE_ERROR: no such column: status
```

## 根本原因

数据库中已经存在**旧版本的表结构**，这些表缺少新增的列（如 `status`）。

即使我们更新了 SQL 脚本，`CREATE TABLE IF NOT EXISTS` 语句不会修改已存在的表结构。

## 解决方案

需要删除旧表并重新创建。我已经创建了一个自动化脚本来完成这个操作。

---

## 🚀 快速修复（推荐）

### 步骤 1：停止后端服务器
```bash
# 按 Ctrl+C 停止后端
```

### 步骤 2：运行数据库重置脚本
```bash
# 在后端目录中运行
node reset-database.js
```

脚本会自动：
1. ✅ 备份当前数据库
2. ✅ 删除旧的 Swap 历史表
3. ✅ 删除旧的图表数据表
4. ✅ 优化数据库（VACUUM）

### 步骤 3：重启后端服务器
```bash
npm run dev
```

后端会自动重新创建所有表，使用最新的表结构。

---

## 📋 脚本执行示例

```bash
$ node reset-database.js

📦 备份当前数据库...
✅ 数据库已备份到: ./data/backups/eagle-swap-backup-2025-11-05T06-17-35-123Z.db

✅ 已连接到数据库

🗑️  删除旧的 Swap 历史表...
✅ DROP TABLE IF EXISTS twap_executions
✅ DROP TABLE IF EXISTS twap_orders
✅ DROP TABLE IF EXISTS limit_orders
✅ DROP TABLE IF EXISTS swap_transactions
✅ DROP TABLE IF EXISTS user_swap_stats
✅ DROP TABLE IF EXISTS token_pair_stats

🗑️  删除旧的图表数据表...
✅ DROP TABLE IF EXISTS price_snapshots
✅ DROP TABLE IF EXISTS candles
✅ DROP TABLE IF EXISTS token_pairs

✅ 数据库已优化 (VACUUM)
✅ 数据库连接已关闭

🎉 数据库重置完成！

📝 下一步：
   1. 重启后端服务器: npm run dev
   2. 数据库表将自动重新创建
   3. 如果需要恢复数据，请使用备份文件

💾 备份位置: ./data/backups/eagle-swap-backup-2025-11-05T06-17-35-123Z.db
```

---

## ⚠️ 注意事项

### 数据丢失
运行此脚本会删除以下数据：
- ❌ Swap 交易历史
- ❌ TWAP 订单记录
- ❌ 限价单记录
- ❌ 用户交易统计
- ❌ 代币对统计
- ❌ 图表价格数据

### 保留的数据
以下数据**不会**被删除：
- ✅ 用户信息 (`users` 表)
- ✅ 代币信息 (`tokens` 表)
- ✅ 交易对信息 (`trading_pairs` 表)
- ✅ 流动性仓位 (`liquidity_positions` 表)
- ✅ 其他核心表

### 备份
脚本会自动备份数据库到 `./data/backups/` 目录。如果需要恢复：
```bash
# 恢复备份
cp ./data/backups/eagle-swap-backup-TIMESTAMP.db ./data/eagle-swap.db
```

---

## 🔧 手动修复（高级用户）

如果不想使用自动脚本，可以手动执行：

```bash
# 1. 备份数据库
cp ./data/eagle-swap.db ./data/eagle-swap.db.backup

# 2. 打开数据库
sqlite3 ./data/eagle-swap.db

# 3. 删除旧表
DROP TABLE IF EXISTS twap_executions;
DROP TABLE IF EXISTS twap_orders;
DROP TABLE IF EXISTS limit_orders;
DROP TABLE IF EXISTS swap_transactions;
DROP TABLE IF EXISTS user_swap_stats;
DROP TABLE IF EXISTS token_pair_stats;
DROP TABLE IF EXISTS price_snapshots;
DROP TABLE IF EXISTS candles;
DROP TABLE IF EXISTS token_pairs;

# 4. 优化数据库
VACUUM;

# 5. 退出
.quit

# 6. 重启后端
npm run dev
```

---

## ✅ 验证修复

重启后端后，应该看到：
```
✅ Database schema initialized successfully
✅ Swap history tables initialized successfully
✅ Database initialized successfully
✅ Eagle Swap Backend started
```

**不应该**看到：
```
❌ Error initializing swap history tables: SQLITE_ERROR: no such column: status
❌ Error initializing swap history tables: SQLITE_ERROR: no such column: timestamp
```

---

## 🎯 为什么会出现这个问题？

1. **表结构演化**：随着开发，我们给表添加了新列（如 `status`）
2. **CREATE IF NOT EXISTS 的限制**：这个语句只在表不存在时创建，不会修改已存在的表
3. **旧数据库**：如果数据库是用旧版本 SQL 创建的，就会缺少新列

## 🔮 未来预防

为了避免类似问题，可以：
1. 使用数据库迁移工具（如 `node-migrate`）
2. 在开发环境定期重置数据库
3. 使用 `ALTER TABLE` 语句添加新列

---

## 📞 需要帮助？

如果重置后仍有问题：
1. 检查 `./data/backups/` 目录确认备份存在
2. 查看后端日志的完整错误信息
3. 确认 SQL 文件没有语法错误

---

## 总结

✅ **推荐操作**：
```bash
# 1. 停止后端 (Ctrl+C)
# 2. 运行重置脚本
node reset-database.js
# 3. 重启后端
npm run dev
```

🎉 **预期结果**：数据库表结构更新，所有错误消失！
