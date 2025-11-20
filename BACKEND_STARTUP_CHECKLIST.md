# 后端完整启动检查清单

## 当前问题

前端所有功能（用户注册、头像上传、用户名检查等）都返回 **404 Not Found**。

## 原因分析

后端代码和路由配置都是正确的，但可能：
1. 后端服务器没有正确启动
2. TypeScript 代码没有编译
3. 数据库表结构有问题
4. 端口被占用

---

## 🚀 完整修复步骤

### 步骤 1：停止所有后端进程

```bash
# 在后端目录中
cd g:\NEW_EAGLE\new4\new\new2\eagle-swap-backend

# 停止当前运行的服务器 (Ctrl+C)
```

### 步骤 2：重置数据库（修复表结构）

```bash
# 运行数据库重置脚本
node reset-database.js
```

**预期输出**：
```
📦 备份当前数据库...
✅ 数据库已备份到: ./data/backups/eagle-swap-backup-...
✅ 已连接到数据库
🗑️  删除旧的 Swap 历史表...
✅ DROP TABLE IF EXISTS twap_executions
✅ DROP TABLE IF EXISTS twap_orders
...
✅ 数据库已优化 (VACUUM)
🎉 数据库重置完成！
```

### 步骤 3：清理并重新构建

```bash
# 删除旧的构建文件
rm -rf dist
# 或者在 Windows PowerShell 中：
Remove-Item -Recurse -Force dist

# 重新安装依赖（如果需要）
npm install

# 重新构建 TypeScript
npm run build
```

**预期输出**：
```
> eagle-swap-backend@1.0.0 build
> tsc

✓ TypeScript 编译成功
```

### 步骤 4：启动后端服务器

```bash
npm run dev
```

**预期输出**：
```
✅ Custom RPC Provider initialized
✅ Connected to SQLite database: ./data/eagle-swap.db
✅ Database schema initialized successfully
✅ Swap history tables initialized successfully
✅ Database initialized successfully
✅ Daily settlement cron job started
✅ Eagle Swap Backend started

╔══════════════════════════════════════════════════════════════╗
║                    Eagle Swap Backend                        ║
║                                                              ║
║  🚀 Server running on: http://0.0.0.0:3001                  ║
║  📊 Health check: http://0.0.0.0:3001/health                ║
║  📚 API Documentation: http://0.0.0.0:3001/                 ║
║                                                              ║
║  Environment: DEVELOPMENT                                    ║
╚══════════════════════════════════════════════════════════════╝
```

**不应该看到**：
```
❌ Error initializing swap history tables: SQLITE_ERROR: no such column: status
❌ Error initializing swap history tables: SQLITE_ERROR: no such column: timestamp
❌ Found 20929 total pairs (价格扫描服务 - 已禁用)
```

### 步骤 5：测试后端 API

打开浏览器或使用 curl 测试：

```bash
# 测试健康检查
curl http://localhost:3001/health

# 测试根路径
curl http://localhost:3001/

# 测试用户名检查（应该返回 JSON，不是 404）
curl http://localhost:3001/api/users/check-username/testuser
```

**预期响应**：
```json
{
  "success": true,
  "available": true,
  "message": "Username available"
}
```

**不应该返回**：
```html
<!DOCTYPE html>
...
```

---

## ✅ 验证所有功能

### 1. 用户注册 API
```bash
curl -X POST http://localhost:3001/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"wallet_address":"0x1234567890123456789012345678901234567890"}'
```

**预期**：返回用户信息 JSON

### 2. 用户名检查 API
```bash
curl http://localhost:3001/api/users/check-username/testuser
```

**预期**：返回可用性 JSON

### 3. 获取用户信息 API
```bash
curl http://localhost:3001/api/users/0x1234567890123456789012345678901234567890
```

**预期**：返回用户信息或 404（如果不存在）

### 4. 上传头像 API
```bash
# 需要使用 multipart/form-data
# 可以在前端测试
```

---

## 🔍 故障排查

### 问题 1：端口 3001 被占用

**症状**：
```
Error: listen EADDRINUSE: address already in use :::3001
```

**解决**：
```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process

# 或者更改端口
# 在 .env 文件中设置：
PORT=3002
```

### 问题 2：TypeScript 编译错误

**症状**：
```
error TS2304: Cannot find name...
```

**解决**：
```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 问题 3：数据库错误

**症状**：
```
SQLITE_ERROR: no such column: ...
```

**解决**：
```bash
# 运行数据库重置脚本
node reset-database.js
# 然后重启后端
npm run dev
```

### 问题 4：CORS 错误

**症状**：前端显示 CORS 错误

**解决**：检查 `src/app.ts` 中的 CORS 配置，确保包含：
```typescript
'http://localhost:3000'
```

---

## 📋 完整的后端服务状态检查

运行后端后，应该看到以下服务：

### ✅ 正常运行的服务
- [x] Express 服务器在 3001 端口
- [x] 数据库连接成功
- [x] 所有 API 路由注册
- [x] 每日结算定时任务
- [x] 文件上传目录创建

### ❌ 已禁用的服务
- [ ] 价格收集服务（priceCollector）
- [ ] 热门交易对监控（hotPairsMonitor）
- [ ] 图表数据表初始化

---

## 🎯 前端对接验证

启动前端后，检查以下功能：

### 1. 连接钱包
- [ ] 钱包连接成功
- [ ] 显示钱包地址
- [ ] 自动检查用户是否注册

### 2. 用户注册
- [ ] 打开注册模态框
- [ ] 输入用户名时实时检查可用性
- [ ] 上传头像成功
- [ ] 注册成功并保存到数据库

### 3. SWAP 功能
- [ ] 选择代币
- [ ] 获取报价
- [ ] 执行 Swap
- [ ] 交易记录保存到数据库

### 4. 用户资料
- [ ] 查看用户资料
- [ ] 更新用户信息
- [ ] 查看交易历史

---

## 📝 环境变量检查

确保 `.env` 文件包含：

```env
# 服务器配置
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# 数据库
DB_PATH=./data/eagle-swap.db
DB_BACKUP_PATH=./data/backups

# RPC
EAGLE_RPC_BACKEND_URL=http://localhost:3000
EAGLE_INDEXER_URL=http://localhost:3005

# 日志
LOG_LEVEL=info
```

---

## 🚨 常见错误和解决方案

### 错误：`Cannot find module './database/init'`
**解决**：运行 `npm run build`

### 错误：`getDatabase() is not a function`
**解决**：检查数据库初始化，重启后端

### 错误：`404 Not Found` 所有 API
**解决**：
1. 确认后端在 3001 端口运行
2. 检查路由是否正确注册
3. 重新构建并重启

### 错误：`SQLITE_ERROR`
**解决**：运行 `node reset-database.js`

---

## ✅ 成功标志

当所有功能正常时，您应该看到：

### 后端日志
```
✅ Eagle Swap Backend started
✅ Server running on: http://0.0.0.0:3001
```

### 前端控制台
```
✅ 没有 404 错误
✅ 用户 API 调用成功
✅ 用户名检查成功
✅ 头像上传成功
```

### 浏览器
```
✅ 可以注册用户
✅ 可以上传头像
✅ 可以执行 Swap
✅ 可以查看交易历史
```

---

## 🎉 最终测试流程

1. **启动后端**
   ```bash
   cd g:\NEW_EAGLE\new4\new\new2\eagle-swap-backend
   npm run dev
   ```

2. **启动前端**
   ```bash
   cd g:\NEW_EAGLE\new4\new\new2\eagleswap-frontend
   npm run dev
   ```

3. **测试完整流程**
   - 打开 http://localhost:3000
   - 连接钱包
   - 注册用户（输入用户名、上传头像）
   - 执行 Swap 交易
   - 查看用户资料和交易历史

4. **验证数据库**
   ```bash
   sqlite3 ./data/eagle-swap.db
   SELECT * FROM users;
   SELECT * FROM swap_transactions;
   .quit
   ```

---

## 总结

按照以上步骤操作后，所有前端功能都应该能够正确对接后端数据库！

关键步骤：
1. ✅ 重置数据库（修复表结构）
2. ✅ 重新构建 TypeScript
3. ✅ 启动后端服务器
4. ✅ 测试所有 API 端点
5. ✅ 验证前端功能

如果还有问题，请检查后端日志的完整错误信息！
