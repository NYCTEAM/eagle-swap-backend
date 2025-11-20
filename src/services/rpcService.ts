import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger, logBlockchain } from '../utils/logger';

// RPC types
interface RPCRequest {
  jsonrpc: string;
  method: string;
  params: any[];
  id: number;
}

interface RPCResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

export class RPCService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.EAGLE_RPC_BACKEND_URL || 'http://localhost:3000';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Eagle-Swap-Backend/1.0.0'
      }
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logBlockchain('RPC', 'Request', {
          url: config.url,
          method: config.method,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('RPC Request Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logBlockchain('RPC', 'Response', {
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('RPC Response Error', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  // Generic RPC call method
  async call(method: string, params: any[] = []): Promise<any> {
    try {
      const request: RPCRequest = {
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now()
      };

      const response: AxiosResponse<RPCResponse> = await this.client.post('/rpc', request);
      
      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }

      return response.data.result;
    } catch (error) {
      logger.error(`RPC call failed for method ${method}`, error);
      throw error;
    }
  }

  // Get token balance
  async getTokenBalance(tokenAddress: string, userAddress: string, chainId: number): Promise<string> {
    return this.call('eth_getTokenBalance', [tokenAddress, userAddress, chainId]);
  }

  // Get native balance (ETH, BNB, etc.)
  async getNativeBalance(userAddress: string, chainId: number): Promise<string> {
    return this.call('eth_getBalance', [userAddress, 'latest', chainId]);
  }

  // Get token info
  async getTokenInfo(tokenAddress: string, chainId: number): Promise<any> {
    return this.call('eth_getTokenInfo', [tokenAddress, chainId]);
  }

  // Get transaction receipt
  async getTransactionReceipt(txHash: string, chainId: number): Promise<any> {
    return this.call('eth_getTransactionReceipt', [txHash, chainId]);
  }

  // Get transaction by hash
  async getTransaction(txHash: string, chainId: number): Promise<any> {
    return this.call('eth_getTransactionByHash', [txHash, chainId]);
  }

  // Get block number
  async getBlockNumber(chainId: number): Promise<number> {
    const result = await this.call('eth_blockNumber', [chainId]);
    return parseInt(result, 16);
  }

  // Get gas price
  async getGasPrice(chainId: number): Promise<string> {
    return this.call('eth_gasPrice', [chainId]);
  }

  // Estimate gas
  async estimateGas(transaction: any, chainId: number): Promise<string> {
    return this.call('eth_estimateGas', [transaction, chainId]);
  }

  // Get logs
  async getLogs(filter: any, chainId: number): Promise<any[]> {
    return this.call('eth_getLogs', [filter, chainId]);
  }

  // Call contract method (read-only)
  async callContract(to: string, data: string, chainId: number, blockTag: string = 'latest'): Promise<string> {
    return this.call('eth_call', [{ to, data }, blockTag, chainId]);
  }

  // Get pair reserves (for DEX)
  async getPairReserves(pairAddress: string, chainId: number): Promise<{ reserve0: string; reserve1: string; blockTimestampLast: number }> {
    return this.call('dex_getPairReserves', [pairAddress, chainId]);
  }

  // Get pair info
  async getPairInfo(tokenA: string, tokenB: string, chainId: number): Promise<any> {
    return this.call('dex_getPairInfo', [tokenA, tokenB, chainId]);
  }

  // Get swap quote
  async getSwapQuote(tokenIn: string, tokenOut: string, amountIn: string, chainId: number): Promise<any> {
    return this.call('dex_getSwapQuote', [tokenIn, tokenOut, amountIn, chainId]);
  }

  // Get liquidity position
  async getLiquidityPosition(pairAddress: string, userAddress: string, chainId: number): Promise<any> {
    return this.call('dex_getLiquidityPosition', [pairAddress, userAddress, chainId]);
  }

  // Get farm info
  async getFarmInfo(farmAddress: string, chainId: number): Promise<any> {
    return this.call('farm_getInfo', [farmAddress, chainId]);
  }

  // Get staking position
  async getStakingPosition(farmAddress: string, userAddress: string, chainId: number): Promise<any> {
    return this.call('farm_getStakingPosition', [farmAddress, userAddress, chainId]);
  }

  // Get pending rewards
  async getPendingRewards(farmAddress: string, userAddress: string, chainId: number): Promise<string> {
    return this.call('farm_getPendingRewards', [farmAddress, userAddress, chainId]);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.error('RPC Service health check failed', error);
      return false;
    }
  }

  // Get supported chains
  async getSupportedChains(): Promise<number[]> {
    try {
      const response = await this.client.get('/chains');
      return response.data.chains || [];
    } catch (error) {
      logger.error('Failed to get supported chains', error);
      return [];
    }
  }
}

// Singleton instance
export const rpcService = new RPCService();