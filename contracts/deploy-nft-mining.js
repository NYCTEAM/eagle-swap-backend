/**
 * NFT Mining Contract Deployment Script
 * 
 * 部署到 X Layer 和 BSC
 * 
 * 使用方法:
 * 1. 在 Remix IDE 中打开 NFTMiningWithSignature.sol
 * 2. 编译合约 (Solidity 0.8.19+)
 * 3. 选择 "Injected Provider" 连接钱包
 * 4. 使用下面的参数部署
 */

const DEPLOYMENT_CONFIG = {
  // ============================================
  // X Layer 主网 (Chain ID: 196)
  // ============================================
  xlayer: {
    chainId: 196,
    rpc: "https://rpc.xlayer.tech",
    explorer: "https://www.okx.com/explorer/xlayer",
    
    // 部署参数
    params: {
      // EAGLE Token 地址
      rewardToken: "0xdd9B82048D2408D69374Aecb6Cf65e66754c95bc",
      // 签名者钱包地址
      signer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    }
  },
  
  // ============================================
  // BSC 主网 (Chain ID: 56)
  // ============================================
  bsc: {
    chainId: 56,
    rpc: "https://bsc-dataseed.binance.org",
    explorer: "https://bscscan.com",
    
    // 部署参数
    params: {
      // EAGLE Token 地址 (BSC)
      rewardToken: "0x83Fe5B70a08d42F6224A9644b3c73692f2d9092a",
      // 签名者钱包地址
      signer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    }
  }
};

/**
 * 部署步骤:
 * 
 * 1. 在 Remix IDE 中:
 *    - 打开 NFTMiningWithSignature.sol
 *    - 编译 (Compiler 0.8.19+, 开启优化 200 runs)
 *    - 选择 "Injected Provider - MetaMask"
 * 
 * 2. 部署到 X Layer:
 *    - 切换 MetaMask 到 X Layer 网络
 *    - 在 Deploy 输入框填入:
 *      _rewardToken: 0xdd9B82048D2408D69374Aecb6Cf65e66754c95bc
 *      _signer: 你的签名钱包地址
 *    - 点击 Deploy
 *    - 记录合约地址
 * 
 * 3. 部署到 BSC:
 *    - 切换 MetaMask 到 BSC 网络
 *    - 在 Deploy 输入框填入:
 *      _rewardToken: 0x83Fe5B70a08d42F6224A9644b3c73692f2d9092a
 *      _signer: 你的签名钱包地址
 *    - 点击 Deploy
 *    - 记录合约地址
 * 
 * 4. 部署后配置:
 *    - 调用 fundRewardPool(amount) 注入 EAGLE 代币
 *    - 需要先 approve EAGLE 给合约地址
 * 
 * 5. 后端配置:
 *    - 在 Coolify 添加环境变量:
 *      NFT_MINING_SIGNER_KEY=你的签名私钥
 *      NFT_MINING_CONTRACT_ADDRESS_XLAYER=X Layer合约地址
 *      NFT_MINING_CONTRACT_ADDRESS_BSC=BSC合约地址
 */

// ============================================
// Remix 部署参数 (复制粘贴用)
// ============================================

console.log("=== X Layer 部署参数 ===");
console.log("_rewardToken:", DEPLOYMENT_CONFIG.xlayer.params.rewardToken);
console.log("_signer: YOUR_SIGNER_WALLET_ADDRESS");
console.log("");

console.log("=== BSC 部署参数 ===");
console.log("_rewardToken:", DEPLOYMENT_CONFIG.bsc.params.rewardToken);
console.log("_signer: YOUR_SIGNER_WALLET_ADDRESS");
console.log("");

console.log("=== 合约管理函数 ===");
console.log("setSigner(address) - 更换签名钱包");
console.log("setRewardToken(address) - 更换代币地址");
console.log("fundRewardPool(uint256) - 注入奖励池");
console.log("withdrawRewardPool(uint256) - 提取奖励池");
console.log("pause() / unpause() - 暂停/恢复");

module.exports = DEPLOYMENT_CONFIG;
