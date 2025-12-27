# 服务器部署命令

## 容器信息
容器名称: `hocg04o8swccwggwc8kosc8g-133637608078`

## 1. 进入容器
```bash
docker exec -it hocg04o8swccwggwc8kosc8g-133637608078 sh
```

## 2. 检查 NFT 持有者信息
```bash
node scripts/check-nft-owners.js
```

## 3. 同步 NFT Transfer 事件（修复转账问题）
```bash
npx tsx scripts/sync-nft-transfers.ts
```

## 4. 或者直接在容器外执行
```bash
# 检查 NFT 持有者
docker exec hocg04o8swccwggwc8kosc8g-133637608078 node scripts/check-nft-owners.js

# 同步 Transfer 事件
docker exec hocg04o8swccwggwc8kosc8g-133637608078 npx tsx scripts/sync-nft-transfers.ts
```

## 5. 查看后端日志（检查 NFT 同步服务是否运行）
```bash
docker logs -f hocg04o8swccwggwc8kosc8g-133637608078
```

## 6. 重启容器（应用新代码）
```bash
# 在 Coolify 界面重启，或使用命令
docker restart hocg04o8swccwggwc8kosc8g-133637608078
```

## 问题排查

### 如果 Transfer 事件没有同步
1. 检查环境变量 `USE_MULTICHAIN_NFT_SYNC` 是否设置为 `true`
2. 查看日志确认 NFT 同步服务已启动
3. 运行同步脚本手动修复历史数据

### 检查特定用户的 NFT
```bash
docker exec hocg04o8swccwggwc8kosc8g-133637608078 node -e "
const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');
const address = '0x你的地址'.toLowerCase();
const nfts = db.prepare('SELECT * FROM nft_holders WHERE owner_address = ?').all(address);
console.table(nfts);
db.close();
"
```

### 手动更新 NFT 持有者
```bash
docker exec hocg04o8swccwggwc8kosc8g-133637608078 node -e "
const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');
const globalTokenId = 123; // NFT 的 global_token_id
const newOwner = '0x新持有者地址'.toLowerCase();
const chainId = 196; // 或 56
db.prepare('UPDATE nft_holders SET owner_address = ?, updated_at = ? WHERE global_token_id = ? AND chain_id = ?')
  .run(newOwner, new Date().toISOString(), globalTokenId, chainId);
console.log('✅ 已更新 NFT #' + globalTokenId + ' 的持有者为 ' + newOwner);
db.close();
"
```

## 预期结果

运行同步脚本后，您应该看到：
- ✅ X Layer: 找到并更新转账的 NFT
- ✅ BSC: 找到并更新转账的 NFT
- 📊 显示每个地址持有的 NFT 数量和权重

转账后的 NFT 将正确显示在新持有者的账户中，并计入其挖矿权重。
