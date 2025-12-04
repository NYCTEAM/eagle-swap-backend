# SSH 服务器操作命令

## 1. 连接到服务器
```bash
ssh root@your-server-ip
# 或
ssh user@your-server-ip
```

## 2. 进入容器
```bash
# 方式 1: 使用容器 ID
docker exec -it hocg04o8swccwggwc8kosc8g-133057446453 bash

# 方式 2: 使用容器名称 (如果有)
docker exec -it eagle-swap-backend bash

# 方式 3: 查找容器
docker ps | grep eagle
```

## 3. 在容器内检查 Swap Mining 表
```bash
# 进入容器后
cd /app

# 检查数据库表
node check-swap-mining-tables.js

# 或者直接用 SQLite
sqlite3 /app/data/eagleswap.db
```

## 4. SQLite 命令 (在容器内)
```bash
# 进入 SQLite
sqlite3 /app/data/eagleswap.db

# 列出所有表
.tables

# 查看表结构
.schema user_claim_nonce
.schema user_swap_stats
.schema swap_transactions

# 查询记录数
SELECT COUNT(*) FROM user_claim_nonce;
SELECT COUNT(*) FROM user_swap_stats;
SELECT COUNT(*) FROM swap_transactions;

# 退出
.quit
```

## 5. 创建缺失的表 (在容器内)
```bash
# 运行修复脚本
node fix-swap-mining-db.js

# 或者手动执行 SQL
sqlite3 /app/data/eagleswap.db < migrations/create_swap_mining_tables.sql
```

## 6. 从本地复制文件到服务器
```bash
# 在本地执行
scp fix-swap-mining-db.js root@your-server:/tmp/
scp check-swap-mining-tables.js root@your-server:/tmp/

# 然后在服务器上复制到容器
docker cp /tmp/fix-swap-mining-db.js hocg04o8swccwggwc8kosc8g-133057446453:/app/
docker cp /tmp/check-swap-mining-tables.js hocg04o8swccwggwc8kosc8g-133057446453:/app/
```

## 7. 一键检查和修复命令
```bash
# SSH 到服务器后，一键执行
docker exec -it hocg04o8swccwggwc8kosc8g-133057446453 bash -c "cd /app && node check-swap-mining-tables.js"

# 如果表不存在，运行修复
docker exec -it hocg04o8swccwggwc8kosc8g-133057446453 bash -c "cd /app && node fix-swap-mining-db.js"

# 重启容器
docker restart hocg04o8swccwggwc8kosc8g-133057446453
```

## 8. 通过 Coolify 部署新代码
```bash
# 在 Coolify 界面点击 "Redeploy" 按钮
# 或通过 Git 推送触发自动部署
```

## 9. 查看容器日志
```bash
# 实时日志
docker logs -f hocg04o8swccwggwc8kosc8g-133057446453

# 最近 100 行
docker logs --tail 100 hocg04o8swccwggwc8kosc8g-133057446453

# 查找错误
docker logs hocg04o8swccwggwc8kosc8g-133057446453 | grep -i error
```

## 10. 验证环境变量
```bash
# 在容器内
docker exec hocg04o8swccwggwc8kosc8g-133057446453 env | grep SWAP_MINING
docker exec hocg04o8swccwggwc8kosc8g-133057446453 env | grep SIGNER
```
