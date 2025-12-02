/**
 * OTC 智能合约地址配置
 * 
 * 说明：
 * - 所有用户资金都托管在这些智能合约中
 * - 后端不持有、不控制用户资产
 * - 合约地址在部署后需要更新到此配置文件
 */

export interface OTCContractConfig {
  chainId: number;
  chainName: string;
  contractAddress: string;
  deployed: boolean;
  deployedAt?: number;
}

/**
 * OTC 合约地址配置
 * 
 * 部署流程：
 * 1. 部署智能合约到各个网络
 * 2. 更新此配置文件中的合约地址
 * 3. 将 deployed 设置为 true
 * 4. 重启后端服务
 */
export const OTC_CONTRACTS: Record<string, OTCContractConfig> = {
  // X Layer (主要部署网络)
  xlayer: {
    chainId: 196,
    chainName: 'X Layer',
    contractAddress: '0x22579d6C47edEC5Cb31Dd1fD238C7d0892Fd285c', // UniversalOTC V2
    deployed: true,
    deployedAt: Date.now(),
  },

  // Ethereum 主网
  ethereum: {
    chainId: 1,
    chainName: 'Ethereum',
    contractAddress: '0x0000000000000000000000000000000000000000', // 待部署后更新
    deployed: false,
  },

  // BSC (Binance Smart Chain)
  bsc: {
    chainId: 56,
    chainName: 'BSC',
    contractAddress: '0xc7801000FCBfF7C2fA05F6B38Ead39401F0551F6', // UniversalOTC V2
    deployed: true,
    deployedAt: Date.now(),
  },

  // Polygon
  polygon: {
    chainId: 137,
    chainName: 'Polygon',
    contractAddress: '0x0000000000000000000000000000000000000000', // 待部署后更新
    deployed: false,
  },

  // Arbitrum
  arbitrum: {
    chainId: 42161,
    chainName: 'Arbitrum',
    contractAddress: '0x0000000000000000000000000000000000000000', // 待部署后更新
    deployed: false,
  },

  // Base
  base: {
    chainId: 8453,
    chainName: 'Base',
    contractAddress: '0x0000000000000000000000000000000000000000', // 待部署后更新
    deployed: false,
  },
};

/**
 * 根据链 ID 获取合约配置
 */
export function getOTCContractByChainId(chainId: number): OTCContractConfig | null {
  const contract = Object.values(OTC_CONTRACTS).find(c => c.chainId === chainId);
  return contract || null;
}

/**
 * 根据网络名称获取合约配置
 */
export function getOTCContractByNetwork(network: string): OTCContractConfig | null {
  const normalizedNetwork = network.toLowerCase().replace(/\s+/g, '');
  return OTC_CONTRACTS[normalizedNetwork] || null;
}

/**
 * 检查合约是否已部署
 */
export function isOTCContractDeployed(chainId: number): boolean {
  const contract = getOTCContractByChainId(chainId);
  return contract?.deployed || false;
}

/**
 * 获取所有已部署的合约
 */
export function getDeployedOTCContracts(): OTCContractConfig[] {
  return Object.values(OTC_CONTRACTS).filter(c => c.deployed);
}

/**
 * 获取所有支持的网络
 */
export function getSupportedNetworks(): string[] {
  return Object.values(OTC_CONTRACTS).map(c => c.chainName);
}

/**
 * OTC 合约 ABI（简化版，实际部署后需要完整 ABI）
 * 
 * 主要事件：
 * - OrderCreated: 订单创建事件
 * - OrderFilled: 订单成交事件
 * - OrderCancelled: 订单取消事件
 * - OrderExpired: 订单过期事件
 */
export const OTC_CONTRACT_ABI = [
  // 创建订单
  {
    name: 'createOrder',
    type: 'function',
    inputs: [
      { name: 'tokenSell', type: 'address' },
      { name: 'tokenBuy', type: 'address' },
      { name: 'amountSell', type: 'uint256' },
      { name: 'amountBuy', type: 'uint256' },
      { name: 'expiryTime', type: 'uint256' },
    ],
    outputs: [{ name: 'orderId', type: 'bytes32' }],
  },
  
  // 接受订单
  {
    name: 'fillOrder',
    type: 'function',
    inputs: [
      { name: 'orderId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  
  // 取消订单
  {
    name: 'cancelOrder',
    type: 'function',
    inputs: [{ name: 'orderId', type: 'bytes32' }],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  
  // 订单创建事件
  {
    name: 'OrderCreated',
    type: 'event',
    inputs: [
      { name: 'orderId', type: 'bytes32', indexed: true },
      { name: 'maker', type: 'address', indexed: true },
      { name: 'tokenSell', type: 'address', indexed: false },
      { name: 'tokenBuy', type: 'address', indexed: false },
      { name: 'amountSell', type: 'uint256', indexed: false },
      { name: 'amountBuy', type: 'uint256', indexed: false },
      { name: 'expiryTime', type: 'uint256', indexed: false },
    ],
  },
  
  // 订单成交事件
  {
    name: 'OrderFilled',
    type: 'event',
    inputs: [
      { name: 'orderId', type: 'bytes32', indexed: true },
      { name: 'taker', type: 'address', indexed: true },
      { name: 'amountFilled', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
    ],
  },
  
  // 订单取消事件
  {
    name: 'OrderCancelled',
    type: 'event',
    inputs: [
      { name: 'orderId', type: 'bytes32', indexed: true },
      { name: 'maker', type: 'address', indexed: true },
    ],
  },
];

/**
 * 合约部署说明
 * 
 * 部署步骤：
 * 1. 编写并审计智能合约代码
 * 2. 使用 Hardhat 或 Truffle 部署到测试网
 * 3. 进行充分测试
 * 4. 部署到主网
 * 5. 更新此配置文件中的合约地址
 * 6. 启动事件监听服务
 * 
 * 安全注意事项：
 * - 合约必须经过专业审计
 * - 实现紧急暂停功能
 * - 设置合理的手续费上限
 * - 实现时间锁机制
 * - 确保原子交换的正确性
 */
