# 💰 平台资金管理合约 (PlatformTreasury)

## 📋 概述

**PlatformTreasury** 是 EAGLE SWAP 的平台资金管理合约，用于：
- ✅ 收取 Swap 手续费（0.1%）
- ✅ 管理平台收入
- ✅ 授权提取资金
- ✅ 多签管理员权限
- ✅ 紧急暂停功能

---

## 🎯 核心功能

### 1. 收取手续费

#### 单笔收取
```solidity
function collectFee(
    address token,      // 代币地址 (0x0 = ETH)
    address from,       // 支付者地址
    uint256 amount      // 交易金额
) external returns (uint256 feeAmount)
```

**示例**:
```javascript
// 用户 Swap 1000 USDT
const swapAmount = ethers.parseUnits("1000", 6); // 1000 USDT

// 收取 0.1% 手续费 = 1 USDT
const feeAmount = await treasury.collectFee(
  USDT_ADDRESS,
  userAddress,
  swapAmount
);

console.log("手续费:", ethers.formatUnits(feeAmount, 6), "USDT");
```

#### 批量收取（Gas 优化）
```solidity
function collectFeeBatch(
    address[] calldata tokens,
    address from,
    uint256[] calldata amounts
) external returns (uint256[] memory feeAmounts)
```

### 2. 提取资金

#### 提取指定金额
```solidity
function withdraw(
    address token,      // 代币地址
    address to,         // 接收地址
    uint256 amount      // 提取金额
) external
```

**示例**:
```javascript
// 提取 100 USDT 到管理员钱包
await treasury.withdraw(
  USDT_ADDRESS,
  adminWallet,
  ethers.parseUnits("100", 6)
);
```

#### 提取所有余额
```solidity
function withdrawAll(
    address token,
    address to
) external
```

### 3. 存入资金

```solidity
function deposit(
    address token,
    uint256 amount
) external payable
```

**用途**:
- 补充运营资金
- 奖励池资金
- 其他平台用途

---

## 👥 权限管理

### 角色说明

| 角色 | 权限 | 说明 |
|------|------|------|
| **Owner** | 所有权限 | 合约部署者，最高权限 |
| **Operator** | 收取手续费 | Swap 合约地址，自动收取手续费 |
| **Withdrawer** | 提取资金 | 财务管理员，可以提取资金 |

### 设置权限

#### 设置操作员（收取手续费）
```javascript
// 授权 Swap 合约收取手续费
await treasury.setOperator(SWAP_CONTRACT_ADDRESS, true);

// 取消授权
await treasury.setOperator(SWAP_CONTRACT_ADDRESS, false);
```

#### 设置提取者（提取资金）
```javascript
// 授权财务管理员
await treasury.setWithdrawer(FINANCE_ADMIN_ADDRESS, true);

// 批量设置
await treasury.setOperatorBatch(
  [ADMIN1, ADMIN2, ADMIN3],
  [true, true, true]
);
```

---

## 💵 手续费配置

### 当前费率
```
默认费率: 10 basis points = 0.1%
最大费率: 100 basis points = 1%
```

### 修改费率
```javascript
// 设置为 0.2%
await treasury.setFeeRate(20);

// 设置为 0.5%
await treasury.setFeeRate(50);
```

### 计算手续费
```javascript
// 计算 1000 USDT 的手续费
const amount = ethers.parseUnits("1000", 6);
const fee = await treasury.calculateFee(amount);

console.log("手续费:", ethers.formatUnits(fee, 6), "USDT");
// 输出: 手续费: 1 USDT (0.1%)
```

---

## 📊 查询功能

### 查询余额
```javascript
// 查询 USDT 余额
const balance = await treasury.getBalance(USDT_ADDRESS);
console.log("USDT 余额:", ethers.formatUnits(balance, 6));

// 查询 ETH 余额
const ethBalance = await treasury.getBalance(ethers.ZeroAddress);
console.log("ETH 余额:", ethers.formatEther(ethBalance));

// 批量查询
const balances = await treasury.getBalances([
  USDT_ADDRESS,
  USDC_ADDRESS,
  EAGLE_ADDRESS
]);
```

### 查询累计手续费
```javascript
// 查询累计收取的 USDT 手续费
const totalFees = await treasury.getTotalFeesCollected(USDT_ADDRESS);
console.log("累计手续费:", ethers.formatUnits(totalFees, 6), "USDT");
```

---

## 🔄 集成到 Swap 流程

### 前端集成

```typescript
// src/lib/platform-treasury.ts

import { ethers } from 'ethers';
import TreasuryABI from '@/abis/PlatformTreasury.json';

const TREASURY_ADDRESS = '0x...'; // 部署后的合约地址

export class PlatformTreasuryService {
  private contract: ethers.Contract;

  constructor(signer: ethers.Signer) {
    this.contract = new ethers.Contract(
      TREASURY_ADDRESS,
      TreasuryABI,
      signer
    );
  }

  /**
   * 收取 Swap 手续费
   */
  async collectSwapFee(
    token: string,
    from: string,
    amount: bigint
  ): Promise<bigint> {
    const tx = await this.contract.collectFee(token, from, amount);
    await tx.wait();
    
    // 返回收取的手续费金额
    const feeAmount = await this.contract.calculateFee(amount);
    return feeAmount;
  }

  /**
   * 查询余额
   */
  async getBalance(token: string): Promise<bigint> {
    return await this.contract.getBalance(token);
  }

  /**
   * 提取资金（仅授权地址）
   */
  async withdraw(
    token: string,
    to: string,
    amount: bigint
  ): Promise<void> {
    const tx = await this.contract.withdraw(token, to, amount);
    await tx.wait();
  }
}
```

### Swap 流程集成

```typescript
// 在 Swap 交易中收取手续费

async function executeSwap(
  fromToken: string,
  toToken: string,
  amount: bigint,
  userAddress: string
) {
  // 1. 计算手续费
  const treasury = new PlatformTreasuryService(signer);
  const feeAmount = await treasury.contract.calculateFee(amount);
  
  // 2. 用户授权代币（包含手续费）
  const totalAmount = amount + feeAmount;
  await approveToken(fromToken, SWAP_ROUTER, totalAmount);
  
  // 3. 收取手续费
  await treasury.collectSwapFee(fromToken, userAddress, amount);
  
  // 4. 执行 Swap（扣除手续费后的金额）
  const swapAmount = amount - feeAmount;
  await executeSwapOnDex(fromToken, toToken, swapAmount);
  
  console.log(`✅ Swap 完成！手续费: ${ethers.formatUnits(feeAmount, 18)}`);
}
```

---

## 🔒 安全功能

### 1. 暂停功能
```javascript
// 紧急情况下暂停合约
await treasury.pause();

// 恢复合约
await treasury.unpause();
```

### 2. 紧急提取
```javascript
// 仅 Owner 可以紧急提取
await treasury.emergencyWithdraw(
  USDT_ADDRESS,
  SAFE_WALLET,
  amount
);
```

### 3. 重入保护
- ✅ 使用 `ReentrancyGuard`
- ✅ 所有资金操作都有重入保护

### 4. 权限控制
- ✅ 基于 `Ownable`
- ✅ 多级权限管理
- ✅ 操作员和提取者分离

---

## 📈 收入统计

### 按代币统计
```javascript
// 查询各代币累计手续费
const tokens = [USDT, USDC, EAGLE, WETH];

for (const token of tokens) {
  const totalFees = await treasury.getTotalFeesCollected(token);
  console.log(`${token}: ${ethers.formatUnits(totalFees, 18)}`);
}
```

### 总收入计算
```javascript
// 计算总收入（以 USD 计价）
async function calculateTotalRevenue() {
  const tokens = [USDT, USDC, EAGLE, WETH];
  let totalUSD = 0;

  for (const token of tokens) {
    const balance = await treasury.getBalance(token);
    const price = await getTokenPrice(token); // 获取代币价格
    totalUSD += balance * price;
  }

  return totalUSD;
}
```

---

## 🚀 部署步骤

### 1. 编译合约
```bash
cd eagle-swap-backend
npx hardhat compile
```

### 2. 部署到 X Layer
```bash
npx hardhat run scripts/deploy-treasury.js --network xlayer
```

### 3. 验证合约
```bash
npx hardhat verify --network xlayer <CONTRACT_ADDRESS>
```

### 4. 配置权限
```javascript
// 设置 Swap 合约为操作员
await treasury.setOperator(SWAP_CONTRACT_ADDRESS, true);

// 设置财务管理员为提取者
await treasury.setWithdrawer(FINANCE_ADMIN, true);
```

---

## 📝 配置文件

### 添加到前端配置

```typescript
// src/config/dex-contracts.ts

export const PLATFORM_TREASURY = {
  address: '0x...', // 部署后的合约地址
  feeRate: 10, // 0.1%
  abi: TreasuryABI,
};
```

---

## 💡 使用场景

### 场景 1: 用户 Swap
```
1. 用户 Swap 1000 USDT → EAGLE
2. 平台收取 1 USDT 手续费 (0.1%)
3. 实际 Swap 999 USDT
4. 1 USDT 进入 Treasury 合约
```

### 场景 2: 提取收入
```
1. 财务管理员查询余额
2. 发起提取请求
3. 资金转入指定钱包
4. 用于运营、开发、营销等
```

### 场景 3: 推荐奖励
```
1. 从 Treasury 提取资金
2. 转入推荐奖励合约
3. 分发给推荐人
```

---

## 📊 Gas 费用估算

| 操作 | Gas 费用 | 说明 |
|------|---------|------|
| collectFee | ~50,000 | 单笔收取 |
| collectFeeBatch | ~40,000/笔 | 批量收取（更省 Gas） |
| withdraw | ~45,000 | 提取资金 |
| deposit | ~30,000 | 存入资金 |

---

## 🔧 维护建议

### 定期检查
- ✅ 每日检查余额
- ✅ 每周统计收入
- ✅ 每月审计资金流向

### 安全建议
- ✅ 使用多签钱包作为 Owner
- ✅ 定期更换提取者密钥
- ✅ 监控异常交易
- ✅ 设置提取限额

---

## 📞 支持

如有问题，请联系开发团队。

---

**平台资金管理合约让你完全掌控平台收入！** 💰🚀
