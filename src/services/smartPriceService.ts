import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { createCustomProvider } from '../utils/customRpcProvider';

// 常用代币地址
const TOKENS = {
  USDT: '0x1E4a5963aBFD975d8c9021ce480b42188849D41d',
  WOKB: '0xe538905cf8410324e03A5A23C1c177a474D59b2b', // EAGLE/OKB
  EAGLE: '0xe538905cf8410324e03A5A23C1c177a474D59b2b',
};

// DEX Factory 地址
const FACTORIES = {
  potato: '0x630DB8E822805c82Ca40a54daE02dd5aC31f7fcF',
  quickswap: '0xd2480162Aa7F02Ead7BF4C127465446150D58452',
};

const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address)',
];

const ERC20_ABI = [
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

interface TokenPrice {
  price: number; // 以 USDT 计价
  priceInUSDT: number;
  symbol: string;
  address: string;
  timestamp: number;
}

/**
 * 智能价格服务
 * - 自动识别任意代币合约地址
 * - 自动查找流动性池
 * - 统一转换为 USDT 价格
 * - 支持多跳价格计算（例如：Token -> OKB -> USDT）
 */
export class SmartPriceService {
  private provider: ethers.JsonRpcProvider;
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1分钟缓存

  constructor() {
    // 使用 Eagle Swap 自定义 X Layer RPC 节点
    const rpcUrl = process.env.XLAYER_RPC_URL || process.env.CUSTOM_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/';
    this.provider = createCustomProvider(rpcUrl);
    logger.info('Smart Price Service initialized');
  }

  /**
   * 获取代币价格（以 USDT 计价）
   * 自动识别合约地址，自动查找最佳路径
   */
  async getPriceInUSDT(tokenAddress: string): Promise<number | null> {
    try {
      // 标准化地址
      tokenAddress = ethers.getAddress(tokenAddress);

      // 如果是 USDT，直接返回 1
      if (tokenAddress.toLowerCase() === TOKENS.USDT.toLowerCase()) {
        return 1;
      }

      // 检查缓存
      const cached = this.priceCache.get(tokenAddress);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.price;
      }

      // 尝试直接获取 Token/USDT 价格
      let price = await this.getDirectPrice(tokenAddress, TOKENS.USDT);
      
      if (price) {
        this.priceCache.set(tokenAddress, { price, timestamp: Date.now() });
        return price;
      }

      // 如果没有直接的 Token/USDT 池，尝试通过 OKB 中转
      // Token -> OKB -> USDT
      const tokenToOKB = await this.getDirectPrice(tokenAddress, TOKENS.WOKB);
      const okbToUSDT = await this.getDirectPrice(TOKENS.WOKB, TOKENS.USDT);

      if (tokenToOKB && okbToUSDT) {
        price = tokenToOKB * okbToUSDT;
        this.priceCache.set(tokenAddress, { price, timestamp: Date.now() });
        return price;
      }

      logger.warn('Could not find price path for token', { tokenAddress });
      return null;
    } catch (error: any) {
      logger.error('Failed to get price in USDT', { tokenAddress, error: error.message });
      return null;
    }
  }

  /**
   * 获取代币对的直接价格
   * 返回 token0 以 token1 计价的价格
   */
  private async getDirectPrice(token0: string, token1: string): Promise<number | null> {
    try {
      // 尝试所有 DEX
      for (const [dexName, factoryAddress] of Object.entries(FACTORIES)) {
        const price = await this.getPriceFromDex(token0, token1, factoryAddress);
        if (price !== null) {
          logger.debug('Found price', { token0, token1, dex: dexName, price });
          return price;
        }
      }

      return null;
    } catch (error: any) {
      logger.error('Failed to get direct price', { token0, token1, error: error.message });
      return null;
    }
  }

  /**
   * 从指定 DEX 获取价格
   */
  private async getPriceFromDex(
    token0: string,
    token1: string,
    factoryAddress: string
  ): Promise<number | null> {
    try {
      // 获取 Pair 地址
      const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, this.provider);
      const pairAddress = await factory.getPair(token0, token1);

      if (pairAddress === ethers.ZeroAddress) {
        return null;
      }

      // 获取储备量
      const pair = new ethers.Contract(pairAddress, PAIR_ABI, this.provider);
      const [reserves, pairToken0, pairToken1] = await Promise.all([
        pair.getReserves(),
        pair.token0(),
        pair.token1(),
      ]);

      // 获取精度
      const token0Contract = new ethers.Contract(pairToken0, ERC20_ABI, this.provider);
      const token1Contract = new ethers.Contract(pairToken1, ERC20_ABI, this.provider);
      
      const [decimals0, decimals1] = await Promise.all([
        token0Contract.decimals(),
        token1Contract.decimals(),
      ]);

      // 计算价格
      const reserve0 = Number(ethers.formatUnits(reserves.reserve0, decimals0));
      const reserve1 = Number(ethers.formatUnits(reserves.reserve1, decimals1));

      // 确定价格方向
      const isToken0First = pairToken0.toLowerCase() === token0.toLowerCase();
      const price = isToken0First ? reserve1 / reserve0 : reserve0 / reserve1;

      return price;
    } catch (error: any) {
      // 静默失败，尝试下一个 DEX
      return null;
    }
  }

  /**
   * 获取代币对价格（自动识别并转换为 USDT）
   * 返回格式化的价格信息
   */
  async getTokenPairPrice(
    tokenInAddress: string,
    tokenOutAddress: string
  ): Promise<{ price: number; priceInUSDT: number } | null> {
    try {
      // 获取两个代币的 USDT 价格
      const [priceIn, priceOut] = await Promise.all([
        this.getPriceInUSDT(tokenInAddress),
        this.getPriceInUSDT(tokenOutAddress),
      ]);

      if (!priceIn || !priceOut) {
        return null;
      }

      // 计算代币对价格
      const price = priceOut / priceIn;

      return {
        price, // tokenIn 以 tokenOut 计价
        priceInUSDT: priceIn, // tokenIn 的 USDT 价格
      };
    } catch (error: any) {
      logger.error('Failed to get token pair price', { 
        tokenInAddress, 
        tokenOutAddress, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * 批量获取代币价格
   */
  async getBatchPrices(tokenAddresses: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    await Promise.all(
      tokenAddresses.map(async (address) => {
        const price = await this.getPriceInUSDT(address);
        if (price !== null) {
          prices.set(address, price);
        }
      })
    );

    return prices;
  }

  /**
   * 清除价格缓存
   */
  clearCache() {
    this.priceCache.clear();
  }
}

// 单例
export const smartPriceService = new SmartPriceService();
