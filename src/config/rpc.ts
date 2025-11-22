/**
 * Custom RPC Configuration for Backend
 * Using Eagle Swap's own RPC nodes for better performance and reliability
 */

export const RPC_CONFIG = {
  // Ethereum Mainnet
  1: {
    name: 'Ethereum',
    rpcUrl: 'https://geth.eagleswap.llc',
    chainId: 1,
    symbol: 'ETH',
    decimals: 18,
    blockExplorer: 'https://etherscan.io'
  },
  
  // BSC Mainnet
  56: {
    name: 'BNB Smart Chain',
    rpcUrl: 'https://rpc1.eagleswap.llc/bsc/',
    chainId: 56,
    symbol: 'BNB',
    decimals: 18,
    blockExplorer: 'https://bscscan.com'
  },
  
  // Polygon Mainnet
  137: {
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    chainId: 137,
    symbol: 'MATIC',
    decimals: 18,
    blockExplorer: 'https://polygonscan.com'
  },
  
  // X Layer
  196: {
    name: 'X Layer',
    rpcUrl: 'https://rpc1.eagleswap.llc/xlayer/',
    chainId: 196,
    symbol: 'OKB',
    decimals: 18,
    blockExplorer: 'https://www.oklink.com/xlayer'
  },
  
  // BASE Mainnet
  8453: {
    name: 'Base',
    rpcUrl: 'https://rpc1.eagleswap.llc/base/',
    chainId: 8453,
    symbol: 'ETH',
    decimals: 18,
    blockExplorer: 'https://basescan.org'
  },
  
  // Arbitrum One
  42161: {
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    symbol: 'ETH',
    decimals: 18,
    blockExplorer: 'https://arbiscan.io'
  }
} as const

/**
 * Get RPC URL by chain ID
 */
export function getRpcUrl(chainId: number): string {
  const config = RPC_CONFIG[chainId as keyof typeof RPC_CONFIG]
  return config?.rpcUrl || ''
}

/**
 * Get chain config by chain ID
 */
export function getChainConfig(chainId: number) {
  return RPC_CONFIG[chainId as keyof typeof RPC_CONFIG]
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(RPC_CONFIG).map(Number)
}

/**
 * Check if chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in RPC_CONFIG
}

/**
 * Get chain name by chain ID
 */
export function getChainName(chainId: number): string {
  const config = RPC_CONFIG[chainId as keyof typeof RPC_CONFIG]
  return config?.name || 'Unknown'
}

/**
 * Export for easy import
 */
export default RPC_CONFIG
