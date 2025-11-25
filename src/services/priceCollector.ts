import cron from 'node-cron';
import { xlayerPriceService } from './xlayerPriceService';
import { chartDataService } from './chartDataService';
import { logger } from '../utils/logger';

// 配置需要追踪的代币对
const TRACKED_PAIRS = [
  {
    token0: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736', // USDT0
    token1: '0xe538905cf8410324e03A5A23C1c177a474D59b2b', // EAGLE
    symbol: 'EAGLE/USDT',
    dex: 'potato' as const, // 使用 POTATO SWAP (Uniswap V2)
  },
  // 可以添加更多代币对
];

export class PriceCollector {
  private isRunning = false;

  /**
   * 启动价格采集
   */
  start() {
    // 每分钟采集一次价格
    cron.schedule('* * * * *', async () => {
      if (this.isRunning) {
        logger.warn('Price collection already running, skipping...');
        return;
      }

      this.isRunning = true;
      try {
        await this.collectPrices();
      } catch (error: any) {
        logger.error('Price collection failed', { error: error.message });
      } finally {
        this.isRunning = false;
      }
    });

    // 每5分钟聚合一次 K 线
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.aggregateCandles();
      } catch (error: any) {
        logger.error('Candle aggregation failed', { error: error.message });
      }
    });

    // 每天凌晨清理旧数据
    cron.schedule('0 0 * * *', async () => {
      try {
        await chartDataService.cleanOldData();
      } catch (error: any) {
        logger.error('Data cleanup failed', { error: error.message });
      }
    });

    logger.info('Price collector started');
  }

  /**
   * 采集价格
   */
  private async collectPrices() {
    logger.info('Collecting prices...');

    for (const pair of TRACKED_PAIRS) {
      try {
        const priceData = await xlayerPriceService.getTokenPairPrice(
          pair.token0,
          pair.token1,
          pair.dex
        );

        if (priceData) {
          await chartDataService.recordPriceSnapshot(
            pair.symbol,
            priceData.token0Address,
            priceData.token1Address,
            pair.dex,
            priceData.price,
            priceData.reserve0,
            priceData.reserve1
          );

          logger.info('Price recorded', {
            pair: pair.symbol,
            price: priceData.price,
            dex: pair.dex,
          });
        } else {
          logger.warn('Failed to get price', { pair: pair.symbol });
        }
      } catch (error: any) {
        logger.error('Failed to collect price', {
          pair: pair.symbol,
          error: error.message,
        });
      }
    }
  }

  /**
   * 聚合 K 线
   */
  private async aggregateCandles() {
    logger.info('Aggregating candles...');

    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 24 * 3600;

    for (const pair of TRACKED_PAIRS) {
      for (const timeframe of timeframes) {
        try {
          await chartDataService.aggregateCandles(
            pair.symbol,
            pair.dex,
            timeframe,
            oneDayAgo,
            now
          );

          logger.info('Candles aggregated', {
            pair: pair.symbol,
            timeframe,
            dex: pair.dex,
          });
        } catch (error: any) {
          logger.error('Failed to aggregate candles', {
            pair: pair.symbol,
            timeframe,
            error: error.message,
          });
        }
      }
    }
  }

  /**
   * 添加新的代币对追踪
   */
  addPair(
    token0: string,
    token1: string,
    symbol: string,
    dex: 'quickswap' | 'potato'
  ) {
    TRACKED_PAIRS.push({ token0, token1, symbol, dex: dex as 'potato' });
    logger.info('Added new pair to track', { symbol, dex });
  }
}

export const priceCollector = new PriceCollector();
