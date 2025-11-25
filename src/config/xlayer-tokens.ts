/**
 * X Layer 代币配置
 * Chain ID: 196
 */

export const XLAYER_TOKENS = {
  // 稳定币 (USDT0 - 新统一稳定币)
  USDT: {
    address: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
    symbol: 'USDT',
    decimals: 6,
  },
  
  // 平台代币
  EAGLE: {
    address: '0xe538905cf8410324e03A5A23C1c177a474D59b2b',
    symbol: 'EAGLE',
    decimals: 18,
  },
  
  // 其他代币（需要实际地址）
  XDOG: {
    address: '0x...', // 需要实际地址
    symbol: 'XDOG',
    decimals: 18,
  },
};

// DEX 工厂合约地址
export const DEX_FACTORIES = {
  quickswap: '0xd2480162Aa7F02Ead7BF4C127465446150D58452', // QuickSwap V3 Factory
  potato: '0x630DB8E822805c82Ca40a54daE02dd5aC31f7fcF',    // POTATO SWAP Factory
};

// 配置要追踪的代币对
export const TRACKED_PAIRS = [
  {
    token0: XLAYER_TOKENS.USDT.address,
    token1: XLAYER_TOKENS.EAGLE.address,
    symbol: 'EAGLE/USDT',
    dex: 'quickswap' as const,
  },
  // 添加更多代币对...
];
