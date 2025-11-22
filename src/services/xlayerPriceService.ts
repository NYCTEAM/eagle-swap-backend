import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { createCustomProvider } from '../utils/customRpcProvider';

// Uniswap V2 Pair ABI (用于读取储备量)
const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

// ERC20 ABI (用于读取代币信息)
const ERC20_ABI = [
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

interface PriceData {
  price: number;
  reserve0: string;
  reserve1: string;
  token0Address: string;
  token1Address: string;
  timestamp: number;
}

export class XLayerPriceService {
  private provider: ethers.JsonRpcProvider;
  private chainId: number = 196;

  constructor() {
    // 使用你自己的 RPC - 无限制，全功能
    // 使用 Eagle Swap 自定义 X Layer RPC 节点
    const rpcUrl = process.env.XLAYER_RPC_URL || process.env.CUSTOM_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/';
    
    // 使用自定义 Provider，避免自动网络检测
    this.provider = createCustomProvider(rpcUrl);
    
    logger.info('X Layer Price Service initialized with custom RPC', { rpcUrl, chainId: 196 });
  }

  /**
   * 从流动性池获取价格
   */
  async getPriceFromPool(pairAddress: string): Promise<PriceData | null> {
    try {
      const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, this.provider);

      // 获取储备量
      const reserves = await pairContract.getReserves();
      const reserve0 = reserves.reserve0;
      const reserve1 = reserves.reserve1;

      // 获取代币地址
      const token0Addr = await pairContract.token0();
      const token1Addr = await pairContract.token1();

      // 获取代币精度
      const token0Contract = new ethers.Contract(token0Addr, ERC20_ABI, this.provider);
      const token1Contract = new ethers.Contract(token1Addr, ERC20_ABI, this.provider);

      const decimals0 = await token0Contract.decimals();
      const decimals1 = await token1Contract.decimals();

      // 计算价格 (token1 / token0)
      const reserve0Formatted = Number(ethers.formatUnits(reserve0, decimals0));
      const reserve1Formatted = Number(ethers.formatUnits(reserve1, decimals1));

      const price = reserve1Formatted / reserve0Formatted;

      return {
        price,
        reserve0: reserve0.toString(),
        reserve1: reserve1.toString(),
        token0Address: token0Addr,
        token1Address: token1Addr,
        timestamp: Math.floor(Date.now() / 1000),
      };
    } catch (error: any) {
      logger.error('Failed to get price from pool', {
        error: error.message,
        pairAddress,
      });
      return null;
    }
  }

  /**
   * 获取代币对的流动性池地址
   * 注意：QuickSwap V3 使用 Algebra，POTATO SWAP 使用 Uniswap V2
   */
  async getPairAddress(
    token0: string,
    token1: string,
    dex: 'quickswap' | 'potato'
  ): Promise<string | null> {
    try {
      if (dex === 'potato') {
        // POTATO SWAP 使用标准 Uniswap V2 Factory
        const factoryAddress = '0x630DB8E822805c82Ca40a54daE02dd5aC31f7fcF';
        const factoryABI = [
          'function getPair(address tokenA, address tokenB) external view returns (address pair)',
        ];

        const factoryContract = new ethers.Contract(factoryAddress, factoryABI, this.provider);
        const pairAddress = await factoryContract.getPair(token0, token1);

        if (pairAddress === ethers.ZeroAddress) {
          logger.warn('Pair not found', { token0, token1, dex });
          return null;
        }

        return pairAddress;
      } else {
        // QuickSwap V3 使用 Algebra，需要不同的方法
        // 暂时返回 null，使用 POTATO SWAP
        logger.warn('QuickSwap V3 (Algebra) not yet supported, use POTATO SWAP instead');
        return null;
      }
    } catch (error: any) {
      logger.error('Failed to get pair address', {
        error: error.message,
        token0,
        token1,
        dex,
      });
      return null;
    }
  }

  /**
   * 获取代币对的当前价格
   */
  async getTokenPairPrice(
    token0: string,
    token1: string,
    dex: 'quickswap' | 'potato' = 'quickswap'
  ): Promise<PriceData | null> {
    try {
      // 获取流动性池地址
      const pairAddress = await this.getPairAddress(token0, token1, dex);
      if (!pairAddress) {
        return null;
      }

      // 获取价格
      return await this.getPriceFromPool(pairAddress);
    } catch (error: any) {
      logger.error('Failed to get token pair price', {
        error: error.message,
        token0,
        token1,
        dex,
      });
      return null;
    }
  }

  /**
   * 批量获取多个代币对的价格
   */
  async getBatchPrices(
    pairs: Array<{ token0: string; token1: string; dex: 'quickswap' | 'potato' }>
  ): Promise<Map<string, PriceData>> {
    const priceMap = new Map<string, PriceData>();

    const promises = pairs.map(async (pair) => {
      const key = `${pair.token0}-${pair.token1}-${pair.dex}`;
      const priceData = await this.getTokenPairPrice(pair.token0, pair.token1, pair.dex);
      if (priceData) {
        priceMap.set(key, priceData);
      }
    });

    await Promise.all(promises);
    return priceMap;
  }
}

// 单例
export const xlayerPriceService = new XLayerPriceService();
