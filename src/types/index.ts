// Base response types
export interface ApiResponse<T = any> {
  success: boolean;
  timestamp: string;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// Token related types
export interface Token {
  id?: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chain_id: number;
  logo_uri?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TokenPrice {
  id?: number;
  token_address: string;
  chain_id: number;
  price_usd: string;
  price_change_24h?: string;
  volume_24h?: string;
  market_cap?: string;
  updated_at?: string;
}

// Transaction types
export interface Transaction {
  id?: number;
  tx_hash: string;
  user_address: string;
  type: 'swap' | 'add_liquidity' | 'remove_liquidity' | 'stake' | 'unstake' | 'harvest';
  token_in?: string;
  token_out?: string;
  amount_in?: string;
  amount_out?: string;
  pair_address?: string;
  lp_amount?: string;
  gas_used: string;
  gas_price: string;
  status: 'pending' | 'success' | 'failed';
  block_number: number;
  timestamp?: string;
  hash?: string;
  transaction_hash?: string;
  gas_estimate?: string;
  slippage?: number;
  farm_id?: number;
  chain_id?: number;
  created_at?: string;
  updated_at?: string;
}

// Liquidity types
export interface LiquidityPool {
  id?: number;
  address: string;
  chain_id: number;
  token0_address: string;
  token1_address: string;
  token0_symbol: string;
  token1_symbol: string;
  reserve0: string;
  reserve1: string;
  total_supply: string;
  fee_tier: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LiquidityPosition {
  id?: number;
  user_address: string;
  pair_address: string;
  lp_token_amount: string;
  token_a: string;
  token_b: string;
  token_a_amount: string;
  token_b_amount: string;
  created_at?: string;
  updated_at?: string;
}

// Farm types
export interface Farm {
  id?: number;
  farm_address: string;
  lp_token_address: string;
  reward_token_address: string;
  alloc_point: number;
  total_staked: string;
  reward_per_block: string;
  start_block: number;
  end_block: number;
  chain_id: number;
  contract_address: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StakingPosition {
  id?: number;
  user_address: string;
  farm_id: number;
  staked_amount: string;
  reward_debt: string;
  pending_rewards?: string;
  chain_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FarmPosition {
  id?: number;
  user_address: string;
  farm_address: string;
  chain_id: number;
  staked_amount: string;
  pending_rewards: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// User types
export interface User {
  id?: number;
  address: string;
  username?: string;
  email?: string;
  avatar_url?: string;
  preferences?: string; // JSON string
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// RPC configuration types
export interface RpcConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrl?: string;
}

// Request parameter types
export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOutMin: string;
  to: string;
  deadline: number;
  chainId: number;
}

export interface AddLiquidityParams {
  tokenA: string;
  tokenB: string;
  amountADesired: string;
  amountBDesired: string;
  amountAMin: string;
  amountBMin: string;
  to: string;
  deadline: number;
  chainId: number;
}

export interface RemoveLiquidityParams {
  tokenA: string;
  tokenB: string;
  liquidity: string;
  amountAMin: string;
  amountBMin: string;
  to: string;
  deadline: number;
  chainId: number;
}

export interface StakeParams {
  farmAddress: string;
  amount: string;
  chainId: number;
}

export interface UnstakeParams {
  farmAddress: string;
  amount: string;
  chainId: number;
}

// Swap types
export interface SwapQuote {
  amountOut: string;
  priceImpact: string;
  route: SwapRoute[];
  gasEstimate: string;
}

export interface SwapRoute {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  exchange: string;
  fee: string;
  hopIndex: number;
}

// Statistics types
export interface TokenStats {
  totalTokens: number;
  activeTokens: number;
  totalVolume24h: string;
  totalMarketCap: string;
}

export interface SwapStats {
  totalSwaps: number;
  volume24h: string;
  uniqueUsers24h: number;
  avgSwapSize: string;
}

export interface LiquidityStats {
  totalPools: number;
  totalLiquidity: string;
  totalPositions: number;
  avgPoolSize: string;
}

export interface FarmStats {
  totalFarms: number;
  totalStaked: string;
  totalRewards: string;
  avgApr: string;
}

// Custom error types
export class ApiError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, statusCode: number = 500, code: string = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Logging types
export interface LogContext {
  userId?: string;
  chainId?: number;
  transactionHash?: string;
  operation?: string;
  [key: string]: any;
}