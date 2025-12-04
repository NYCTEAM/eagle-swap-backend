# NFT 合约地址更新指南

## 📋 新 NFT 合约配置

### X Layer (Chain ID: 196)
- **NFT 合约**: `0x8d3FBe540CBe8189333A1758cE3801067A023809`
- **USDT 合约**: `0x779Ded0c9e1022225f8E0630b35a9b54bE713736`
- **Marketplace**: `0x33d0D4a3fFC727f51d1A91d0d1eDA290193D5Df1`

## ✅ 已更新的文件

### 后端
1. ✅ `src/services/simpleNftSync.ts` - Line 33
2. ✅ `src/services/multiChainNftSync.ts` - Line 19
3. ✅ `.env.example` - 需要添加环境变量

### 前端
1. ✅ `src/lib/config.ts` - Line 165
2. ✅ `src/lib/contracts/MultiChainNFT.ts` - Line 19
3. ✅ `src/lib/contracts/EagleNFT_Complete_ABI.ts` - Line 2

## 🔧 环境变量配置

在生产环境的 `.env` 文件中添加或更新：

```bash
# NFT 合约地址
NFT_CONTRACT_ADDRESS=0x8d3FBe540CBe8189333A1758cE3801067A023809
XLAYER_NFT_ADDRESS=0x8d3FBe540CBe8189333A1758cE3801067A023809
MARKETPLACE_CONTRACT_ADDRESS=0x33d0D4a3fFC727f51d1A91d0d1eDA290193D5Df1

# RPC URLs
X_LAYER_RPC_URL=https://rpc1.eagleswap.llc/xlayer/
XLAYER_RPC_URL=https://rpc1.eagleswap.llc/xlayer/
```

## 🗄️ 数据库状态

### 当前状态
- `user_nfts` 表: 0 条记录（等待用户购买）
- `nft_inventory` 表: 7 个等级配置 ✅

### 等级配置
| Level | Name | Price | Weight | Total Supply |
|-------|------|-------|--------|--------------|
| 1 | Micro Node | $10 | 0.1 | 5000 |
| 2 | Mini Node | $25 | 0.3 | 3000 |
| 3 | Bronze Node | $50 | 0.5 | 2000 |
| 4 | Silver Node | $100 | 1.0 | 1500 |
| 5 | Gold Node | $250 | 3.0 | 1100 |
| 6 | Platinum Node | $500 | 7.0 | 700 |
| 7 | Diamond Node | $1000 | 15.0 | 600 |

**总供应量**: 13,900 NFTs

## 🚀 部署步骤

### 1. 更新后端环境变量
在 Coolify 的环境变量中添加上述配置。

### 2. 重启后端服务
```bash
# Coolify 会自动重启，或手动重启容器
docker restart <container_id>
```

### 3. 验证配置
```bash
# 检查 NFT 同步服务日志
docker logs <container_id> | grep -i "nft"

# 应该看到:
# ✅ NFT Sync Service initialized with contract: 0x8d3FBe540CBe8189333A1758cE3801067A023809
```

### 4. 测试 NFT 购买
1. 访问 https://eagleswap.llc/nodes
2. 连接钱包到 X Layer
3. 购买一个测试 NFT
4. 检查数据库是否同步

### 5. 验证 Swap Mining
1. 访问 https://eagleswap.llc/swap-mining
2. 应该显示正确的 NFT boost

## 📊 监控命令

### 检查数据库中的 NFT
```bash
docker exec -it <container_id> node -e "
const db = require('better-sqlite3')('/app/data/eagleswap.db');
const nfts = db.prepare('SELECT COUNT(*) as count FROM user_nfts WHERE chain_id = 196').get();
console.log('Total NFTs:', nfts.count);
db.close();
"
```

### 检查 NFT 合约配置
```bash
docker exec -it <container_id> node -e "
console.log('NFT Contract:', process.env.NFT_CONTRACT_ADDRESS);
console.log('Marketplace:', process.env.MARKETPLACE_CONTRACT_ADDRESS);
"
```

## ⚠️ 注意事项

1. **旧 NFT 数据**: 不迁移，用户需要在新合约上重新购买
2. **Swap Mining**: 只有新合约的 NFT 才会获得 boost
3. **前端缓存**: 用户可能需要清除浏览器缓存
4. **测试**: 建议先购买一个测试 NFT 验证流程

## ✅ 完成检查清单

- [x] 后端代码已更新 NFT 合约地址
- [x] 前端代码已更新 NFT 合约地址
- [ ] 生产环境变量已配置
- [ ] 后端服务已重启
- [ ] 测试 NFT 购买流程
- [ ] 验证 Swap Mining boost 显示
- [ ] 监控 NFT 同步日志

## 🆘 故障排查

### NFT 购买后没有同步到数据库
1. 检查后端日志: `docker logs <container_id> | grep -i "nft"`
2. 检查合约地址是否正确
3. 检查 RPC 连接是否正常
4. 手动触发同步（如果需要）

### Swap Mining 不显示 NFT boost
1. 检查 `user_nfts` 表是否有数据
2. 检查用户钱包地址是否匹配
3. 刷新前端页面
4. 清除浏览器缓存

## 📞 支持

如有问题，请检查：
1. 后端日志
2. 数据库数据
3. 前端控制台
4. 区块链浏览器确认交易
