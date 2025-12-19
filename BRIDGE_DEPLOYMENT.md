# 🌉 EagleBridge 跨链桥部署信息

## 📅 部署日期
2025-12-19

## 🔗 合约地址

### X Layer (Chain ID: 196)
- **Bridge 合约**: `0xFfa85Db47ba6118B51ce9c65A9cc213060290b62`
- **EAGLE Token**: `0x5a746ee9933627ed79822d35a3fe812eddd5ba37`
- **模式**: Lock/Unlock (源链)
- **Source Chain ID**: 56 (BSC)

### BSC (Chain ID: 56)
- **Bridge 合约**: `0xAb13cbC259A592E6b09cf1Ddbdc85eAB7AB2586f`
- **EAGLE Token**: `0x480F12D2ECEFe1660e72149c57327f5E0646E5c4`
- **模式**: Mint/Burn (目标链)
- **Source Chain ID**: 196 (X Layer)

## 🔧 Relayer 配置
- **EVM Relayer**: `0xE4724592897FB5773eA049Bc4010D2E30aa1BD9C`
- **环境变量**: `RELAYER_PRIVATE_KEY`

## 📋 合约 ABI

### Bridge 合约 ABI
```solidity
// 用户函数
function bridge(address to, uint256 amount) external

// Relayer 函数
function release(address to, uint256 amount, uint256 srcNonce, uint256 srcChainId, bytes calldata signature) external

// 查询函数
function nonce() external view returns (uint256)
function processedNonces(uint256) external view returns (bool)

// 事件
event BridgeInitiated(address indexed from, address indexed to, uint256 amount, uint256 fee, uint256 indexed nonce, uint256 timestamp)
event BridgeFinalized(address indexed to, uint256 amount, uint256 indexed nonce)
```

### Token 桥接 ABI
```solidity
// BSC Token 需要这些函数
function bridgeIn(address to, uint256 amount) external  // Bridge 调用铸造
function bridgeOut(uint256 amount) external             // 用户调用销毁
function balanceOf(address) external view returns (uint256)
function approve(address spender, uint256 amount) external returns (bool)
```

## 🚀 部署后配置步骤

### 1. BSC Token 配置
```javascript
// 在 BSC 上调用 EAGLE Token 合约
await eagleTokenBSC.setBridge("0xAb13cbC259A592E6b09cf1Ddbdc85eAB7AB2586f");
```

### 2. 后端配置
已更新 `src/services/bridgeRelayerService.ts`:
- ✅ X Layer Bridge: `0xFfa85Db47ba6118B51ce9c65A9cc213060290b62`
- ✅ BSC Bridge: `0xAb13cbC259A592E6b09cf1Ddbdc85eAB7AB2586f`
- ✅ X Layer Token: `0x5a746ee9933627ed79822d35a3fe812eddd5ba37`
- ✅ BSC Token: `0x480F12D2ECEFe1660e72149c57327f5E0646E5c4`
- ✅ ABI 已更新（包含 bridgeIn/bridgeOut）

### 3. 重启后端服务
```bash
# 拉取最新代码
git pull

# 重启服务
pm2 restart eagle-swap-backend
# 或
docker restart <backend-container-id>
```

## 📊 跨链流程

### X Layer → BSC
1. 用户在 X Layer 调用 `bridge(to, amount)`
2. Bridge 锁定代币，发出 `BridgeInitiated` 事件
3. Relayer 监听事件，生成签名
4. Relayer 在 BSC 调用 `release(to, amount, nonce, 196, signature)`
5. BSC Bridge 验证签名，调用 Token 的 `bridgeIn(to, amount)` 铸造代币

### BSC → X Layer
1. 用户在 BSC 调用 `bridge(to, amount)`
2. Bridge 调用 Token 的 `burn(amount)` 销毁代币，发出 `BridgeInitiated` 事件
3. Relayer 监听事件，生成签名
4. Relayer 在 X Layer 调用 `release(to, amount, nonce, 56, signature)`
5. X Layer Bridge 验证签名，解锁代币转给用户

## 🔐 安全特性

1. **签名验证**: 使用 EIP-191 签名，防止重放攻击
2. **Nonce 机制**: 每笔交易唯一 nonce，防止双花
3. **Source Chain 验证**: 验证来源链 ID
4. **Relayer 授权**: 只有授权的 Relayer 可以调用 release
5. **最小跨链金额**: 默认 1000 EAGLE，防止粉尘攻击
6. **暂停机制**: Owner 可以暂停桥接

## 📝 测试清单

- [ ] X Layer → BSC 跨链测试
- [ ] BSC → X Layer 跨链测试
- [ ] 签名验证测试
- [ ] Nonce 防重放测试
- [ ] 手续费计算测试
- [ ] 前端显示测试
- [ ] 错误处理测试

## 🔗 相关链接

- **X Layer Explorer**: https://www.oklink.com/xlayer
- **BSC Explorer**: https://bscscan.com
- **前端**: https://eagleswap.llc
- **后端 API**: https://api.eagleswap.llc

## 📞 联系方式

如有问题，请联系开发团队。
