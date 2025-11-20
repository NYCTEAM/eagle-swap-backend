import { priceService } from './priceService';
import { logger } from '../utils/logger';

/**
 * 价格预言机服务
 * 为 TWAP 和 Limit Order 提供价格数据
 */
export class PriceOracleService {
  /**
   * 获取代币对价格（18位精度）
   * @param tokenIn 输入代币地址
   * @param tokenOut 输出代币地址
   * @param chainId 链ID
   * @returns 价格（18位精度的 bigint）
   */
  async getTokenPairPrice(
    tokenIn: string,
    tokenOut: string,
    chainId: number
  ): Promise<bigint> {
    try {
      // 获取两个代币的 USD 价格
      const priceIn = await priceService.getTokenPrice(tokenIn, chainId);
      const priceOut = await priceService.getTokenPrice(tokenOut, chainId);

      if (!priceIn || !priceOut) {
        throw new Error('Price not available for token pair');
      }

      // 计算价格比率（tokenOut per tokenIn）
      // price = (priceOut / priceIn) * 1e18
      const priceInUsd = Math.floor(Number(priceIn.price_usd) * 1e18);
      const priceOutUsd = Math.floor(Number(priceOut.price_usd) * 1e18);

      if (priceInUsd === 0) {
        throw new Error('Invalid price for input token');
      }

      const price = (BigInt(priceOutUsd) * BigInt(1e18)) / BigInt(priceInUsd);

      logger.info('Token pair price calculated', {
        tokenIn,
        tokenOut,
        priceInUsd: priceIn.price_usd,
        priceOutUsd: priceOut.price_usd,
        price: price.toString(),
      });

      return price;
    } catch (error: any) {
      logger.error('Failed to get token pair price', {
        tokenIn,
        tokenOut,
        chainId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 检查限价订单是否可以执行
   * @param tokenIn 输入代币
   * @param tokenOut 输出代币
   * @param limitPrice 限价（18位精度）
   * @param chainId 链ID
   * @returns 是否可以执行
   */
  async canExecuteLimitOrder(
    tokenIn: string,
    tokenOut: string,
    limitPrice: bigint,
    chainId: number
  ): Promise<boolean> {
    try {
      const currentPrice = await this.getTokenPairPrice(tokenIn, tokenOut, chainId);
      const canExecute = currentPrice >= limitPrice;

      logger.info('Limit order execution check', {
        tokenIn,
        tokenOut,
        currentPrice: currentPrice.toString(),
        limitPrice: limitPrice.toString(),
        canExecute,
      });

      return canExecute;
    } catch (error: any) {
      logger.error('Failed to check limit order execution', {
        tokenIn,
        tokenOut,
        limitPrice: limitPrice.toString(),
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 获取代币对价格（格式化为可读字符串）
   * @param tokenIn 输入代币
   * @param tokenOut 输出代币
   * @param chainId 链ID
   * @returns 格式化的价格字符串
   */
  async getFormattedPrice(
    tokenIn: string,
    tokenOut: string,
    chainId: number
  ): Promise<string> {
    const price = await this.getTokenPairPrice(tokenIn, tokenOut, chainId);
    // 转换为可读格式（保留6位小数）
    const priceNumber = Number(price) / 1e18;
    return priceNumber.toFixed(6);
  }
}

export const priceOracleService = new PriceOracleService();
