import { ethers } from 'ethers';
import { getDatabase } from '../database/init';
import { xlayerPriceService } from './xlayerPriceService';
import { priceCollector } from './priceCollector';
import { logger } from '../utils/logger';
import { createCustomProvider } from '../utils/customRpcProvider';
import cron from 'node-cron';

interface PairInfo {
  token0: string;
  token1: string;
  pairAddress: string;
  reserve0: string;
  reserve1: string;
  liquidity: number;
  lastUpdate: number;
}

interface PairStats {
  pairAddress: string;
  symbol: string;
  liquidity: number;
  priceChangeCount: number;
  lastActiveTime: number;
  isActive: boolean;
}

export class HotPairsMonitor {
  private provider: ethers.JsonRpcProvider;
  private get db() {
    return getDatabase();
  }
  private trackedPairs: Set<string> = new Set();
  
  // 配置参数
  private readonly MIN_LIQUIDITY = 100; // 最小流动性（USD）- 降低门槛，下载更多代币
  private readonly MIN_ACTIVITY_DAYS = 7; // 最少活跃天数
  private readonly CHECK_INTERVAL_HOURS = 1; // 检查间隔（小时）- 更频繁扫描
  private readonly INACTIVE_THRESHOLD_DAYS = 30; // 无活动阈值（天）- 30天后才删除
  private readonly MAX_PAIRS_TO_TRACK = 200; // 最多追踪200个代币对

  constructor() {
    // 使用 Eagle Swap 自定义 X Layer RPC 节点
    const rpcUrl = process.env.XLAYER_RPC_URL || process.env.CUSTOM_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/';
    // 使用自定义 Provider
    this.provider = createCustomProvider(rpcUrl);
  }

  /**
   * 启动热门代币监控
   */
  start() {
    // 立即执行一次初始扫描
    logger.info('Starting initial hot pairs scan...');
    this.scanHotPairs().catch((error) => {
      logger.error('Initial scan failed', { error: error.message });
    });

    // 每小时检查一次热门代币对（更频繁）
    cron.schedule('0 * * * *', async () => {
      try {
        await this.scanHotPairs();
      } catch (error: any) {
        logger.error('Hot pairs scan failed', { error: error.message });
      }
    });

    // 每天凌晨2点清理30天无活动的代币对
    cron.schedule('0 2 * * *', async () => {
      try {
        await this.cleanupInactivePairs();
      } catch (error: any) {
        logger.error('Cleanup inactive pairs failed', { error: error.message });
      }
    });

    // 每天凌晨3点删除归零代币数据
    cron.schedule('0 3 * * *', async () => {
      try {
        await this.deleteZeroLiquidityData();
      } catch (error: any) {
        logger.error('Delete zero liquidity data failed', { error: error.message });
      }
    });

    logger.info('Hot pairs monitor started - Aggressive mode: tracking up to 200 pairs');
  }

  /**
   * 扫描热门代币对
   */
  private async scanHotPairs() {
    logger.info('Scanning for hot pairs...');

    try {
      // 从 POTATO SWAP Factory 获取所有代币对
      const factoryAddress = '0x630DB8E822805c82Ca40a54daE02dd5aC31f7fcF';
      const factoryABI = [
        'function allPairsLength() external view returns (uint256)',
        'function allPairs(uint256) external view returns (address)',
      ];

      const factory = new ethers.Contract(factoryAddress, factoryABI, this.provider);
      const pairsLength = await factory.allPairsLength();
      
      logger.info(`Found ${pairsLength} total pairs`);

      // 获取所有代币对的流动性 - 扫描更多代币对
      const pairInfos: PairInfo[] = [];
      const batchSize = 20; // 增加批量大小
      const maxPairsToScan = Math.min(Number(pairsLength), 1000); // 扫描前1000个

      logger.info(`Scanning ${maxPairsToScan} pairs...`);

      for (let i = 0; i < maxPairsToScan; i += batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + batchSize, maxPairsToScan); j++) {
          batch.push(this.getPairInfo(factory, j));
        }

        const results = await Promise.allSettled(batch);
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            pairInfos.push(result.value);
          }
        });

        // 每100个代币对记录一次进度
        if ((i + batchSize) % 100 === 0) {
          logger.info(`Scanned ${i + batchSize}/${maxPairsToScan} pairs, found ${pairInfos.length} valid pairs`);
        }
      }

      // 按流动性排序
      pairInfos.sort((a, b) => b.liquidity - a.liquidity);

      // 选择前200个流动性最高的代币对（大幅增加）
      const hotPairs = pairInfos
        .filter(p => p.liquidity >= this.MIN_LIQUIDITY)
        .slice(0, this.MAX_PAIRS_TO_TRACK);

      logger.info(`Found ${hotPairs.length} hot pairs with sufficient liquidity`);

      // 添加到追踪列表
      for (const pair of hotPairs) {
        await this.addPairToTracking(pair);
      }

    } catch (error: any) {
      logger.error('Failed to scan hot pairs', { error: error.message });
    }
  }

  /**
   * 获取代币对信息
   */
  private async getPairInfo(factory: ethers.Contract, index: number): Promise<PairInfo | null> {
    try {
      const pairAddress = await factory.allPairs(index);
      
      const pairABI = [
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)',
      ];

      const pair = new ethers.Contract(pairAddress, pairABI, this.provider);
      const [reserves, token0, token1] = await Promise.all([
        pair.getReserves(),
        pair.token0(),
        pair.token1(),
      ]);

      // 简单估算流动性（假设 token1 是稳定币）
      const reserve1Formatted = Number(ethers.formatUnits(reserves.reserve1, 6)); // 假设是 USDT
      const liquidity = reserve1Formatted * 2; // 粗略估算总流动性

      return {
        token0,
        token1,
        pairAddress,
        reserve0: reserves.reserve0.toString(),
        reserve1: reserves.reserve1.toString(),
        liquidity,
        lastUpdate: Date.now(),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 添加代币对到追踪列表
   */
  private async addPairToTracking(pairInfo: PairInfo) {
    const key = `${pairInfo.token0}-${pairInfo.token1}`;
    
    if (this.trackedPairs.has(key)) {
      return; // 已经在追踪
    }

    try {
      // 获取代币符号
      const token0Contract = new ethers.Contract(
        pairInfo.token0,
        ['function symbol() external view returns (string)'],
        this.provider
      );
      const token1Contract = new ethers.Contract(
        pairInfo.token1,
        ['function symbol() external view returns (string)'],
        this.provider
      );

      const [symbol0, symbol1] = await Promise.all([
        token0Contract.symbol(),
        token1Contract.symbol(),
      ]);

      const symbol = `${symbol0}/${symbol1}`;

      // 添加到价格采集器
      priceCollector.addPair(pairInfo.token0, pairInfo.token1, symbol, 'potato');
      
      this.trackedPairs.add(key);

      logger.info('Added hot pair to tracking', {
        symbol,
        liquidity: pairInfo.liquidity,
        pairAddress: pairInfo.pairAddress,
      });

      // 保存到数据库
      await this.savePairToDatabase(pairInfo, symbol);

    } catch (error: any) {
      logger.error('Failed to add pair to tracking', {
        error: error.message,
        pairAddress: pairInfo.pairAddress,
      });
    }
  }

  /**
   * 保存代币对到数据库
   */
  private async savePairToDatabase(pairInfo: PairInfo, symbol: string) {
    return new Promise<void>((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO token_pairs 
        (token_pair, token0_address, token1_address, token0_symbol, token1_symbol, dex_name, pair_address, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          symbol,
          pairInfo.token0,
          pairInfo.token1,
          symbol.split('/')[0],
          symbol.split('/')[1],
          'potato',
          pairInfo.pairAddress,
          1,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * 清理不活跃的代币对
   */
  private async cleanupInactivePairs() {
    logger.info('Cleaning up inactive pairs...');

    const thresholdTime = Math.floor(Date.now() / 1000) - this.INACTIVE_THRESHOLD_DAYS * 24 * 3600;

    return new Promise<void>((resolve, reject) => {
      // 查找不活跃的代币对
      this.db.all(
        `SELECT DISTINCT token_pair, dex_name
        FROM price_snapshots
        WHERE timestamp < ?
        GROUP BY token_pair, dex_name
        HAVING MAX(timestamp) < ?`,
        [thresholdTime, thresholdTime],
        async (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          logger.info(`Found ${rows.length} inactive pairs`);

          for (const row of rows) {
            await this.markPairAsInactive(row.token_pair, row.dex_name);
          }

          resolve();
        }
      );
    });
  }

  /**
   * 标记代币对为不活跃
   */
  private async markPairAsInactive(tokenPair: string, dexName: string) {
    return new Promise<void>((resolve, reject) => {
      this.db.run(
        `UPDATE token_pairs SET is_active = 0 WHERE token_pair = ? AND dex_name = ?`,
        [tokenPair, dexName],
        (err) => {
          if (err) {
            reject(err);
          } else {
            logger.info('Marked pair as inactive', { tokenPair, dexName });
            resolve();
          }
        }
      );
    });
  }

  /**
   * 删除归零代币的数据（30天后）
   */
  private async deleteZeroLiquidityData() {
    logger.info('Deleting zero liquidity data (30 days inactive)...');

    // 删除超过30天没有价格变化的数据
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;

    return new Promise<void>((resolve, reject) => {
      // 找出30天内归零的代币对（价格为0或极小）
      this.db.all(
        `SELECT token_pair, dex_name, COUNT(*) as count, AVG(price) as avg_price, MAX(timestamp) as last_update
        FROM price_snapshots
        WHERE timestamp > ?
        GROUP BY token_pair, dex_name
        HAVING (avg_price < 0.0000000001 OR count < 5) AND last_update < ?`,
        [thirtyDaysAgo, thirtyDaysAgo],
        async (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          logger.info(`Found ${rows.length} zero/low liquidity pairs (30 days inactive)`);

          for (const row of rows) {
            await this.deletePairData(row.token_pair, row.dex_name);
          }

          resolve();
        }
      );
    });
  }

  /**
   * 删除代币对的所有数据
   */
  private async deletePairData(tokenPair: string, dexName: string) {
    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        // 删除价格快照
        this.db.run(
          `DELETE FROM price_snapshots WHERE token_pair = ? AND dex_name = ?`,
          [tokenPair, dexName]
        );

        // 删除 K 线数据
        this.db.run(
          `DELETE FROM candles WHERE token_pair = ? AND dex_name = ?`,
          [tokenPair, dexName]
        );

        // 标记为不活跃
        this.db.run(
          `UPDATE token_pairs SET is_active = 0 WHERE token_pair = ? AND dex_name = ?`,
          [tokenPair, dexName],
          (err) => {
            if (err) {
              reject(err);
            } else {
              logger.info('Deleted zero liquidity pair data', { tokenPair, dexName });
              resolve();
            }
          }
        );
      });
    });
  }

  /**
   * 手动触发扫描（用于测试）
   */
  async triggerScan() {
    await this.scanHotPairs();
  }

  /**
   * 手动触发清理（用于测试）
   */
  async triggerCleanup() {
    await this.cleanupInactivePairs();
    await this.deleteZeroLiquidityData();
  }
}

export const hotPairsMonitor = new HotPairsMonitor();
