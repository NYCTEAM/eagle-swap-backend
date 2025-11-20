import { getDatabase } from '../database/init';
import { xlayerPriceService } from './xlayerPriceService';
import { logger } from '../utils/logger';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class ChartDataService {
  private get db() {
    return getDatabase();
  }

  /**
   * 记录价格快照
   */
  async recordPriceSnapshot(
    tokenPair: string,
    token0Address: string,
    token1Address: string,
    dexName: string,
    price: number,
    reserve0: string,
    reserve1: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timestamp = Math.floor(Date.now() / 1000);

      this.db.run(
        `INSERT INTO price_snapshots 
        (token_pair, token0_address, token1_address, dex_name, price, reserve0, reserve1, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tokenPair, token0Address, token1Address, dexName, price, reserve0, reserve1, timestamp],
        (err: Error | null) => {
          if (err) {
            logger.error('Failed to record price snapshot', { error: err.message });
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * 聚合价格快照为 K 线
   */
  async aggregateCandles(
    tokenPair: string,
    dexName: string,
    timeframe: string,
    fromTimestamp: number,
    toTimestamp: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // 计算时间间隔（秒）
      const intervals: { [key: string]: number } = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '1h': 3600,
        '4h': 14400,
        '1d': 86400,
      };

      const interval = intervals[timeframe];
      if (!interval) {
        reject(new Error(`Invalid timeframe: ${timeframe}`));
        return;
      }

      // 查询价格快照并聚合
      this.db.all(
        `SELECT 
          (timestamp / ?) * ? as candle_time,
          MIN(price) as low,
          MAX(price) as high,
          (SELECT price FROM price_snapshots ps2 
           WHERE ps2.token_pair = ? AND ps2.dex_name = ? 
           AND (ps2.timestamp / ?) * ? = (timestamp / ?) * ?
           ORDER BY ps2.timestamp ASC LIMIT 1) as open,
          (SELECT price FROM price_snapshots ps3 
           WHERE ps3.token_pair = ? AND ps3.dex_name = ? 
           AND (ps3.timestamp / ?) * ? = (timestamp / ?) * ?
           ORDER BY ps3.timestamp DESC LIMIT 1) as close
        FROM price_snapshots
        WHERE token_pair = ? AND dex_name = ?
        AND timestamp >= ? AND timestamp < ?
        GROUP BY candle_time
        ORDER BY candle_time ASC`,
        [
          interval, interval,
          tokenPair, dexName, interval, interval, interval, interval,
          tokenPair, dexName, interval, interval, interval, interval,
          tokenPair, dexName, fromTimestamp, toTimestamp
        ],
        (err: Error | null, rows: any[]) => {
          if (err) {
            logger.error('Failed to aggregate candles', { error: err.message });
            reject(err);
            return;
          }

          // 插入或更新 K 线数据
          const insertPromises = rows.map((row) => {
            return new Promise<void>((resolveInsert, rejectInsert) => {
              this.db.run(
                `INSERT OR REPLACE INTO candles 
                (token_pair, dex_name, timeframe, open_price, high_price, low_price, close_price, volume, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  tokenPair,
                  dexName,
                  timeframe,
                  row.open,
                  row.high,
                  row.low,
                  row.close,
                  0, // volume 暂时为 0
                  row.candle_time,
                ],
                (insertErr: Error | null) => {
                  if (insertErr) {
                    rejectInsert(insertErr);
                  } else {
                    resolveInsert();
                  }
                }
              );
            });
          });

          Promise.all(insertPromises)
            .then(() => resolve())
            .catch((error) => reject(error));
        }
      );
    });
  }

  /**
   * 获取 K 线数据
   */
  async getCandles(
    tokenPair: string,
    dexName: string,
    timeframe: string,
    fromTimestamp: number,
    toTimestamp: number,
    limit: number = 1000
  ): Promise<CandleData[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT timestamp as time, open_price as open, high_price as high, 
         low_price as low, close_price as close, volume
        FROM candles
        WHERE token_pair = ? AND dex_name = ? AND timeframe = ?
        AND timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
        LIMIT ?`,
        [tokenPair, dexName, timeframe, fromTimestamp, toTimestamp, limit],
        (err: Error | null, rows: any[]) => {
          if (err) {
            logger.error('Failed to get candles', { error: err.message });
            reject(err);
          } else {
            resolve(rows as CandleData[]);
          }
        }
      );
    });
  }

  /**
   * 获取最新价格
   */
  async getLatestPrice(tokenPair: string, dexName: string): Promise<number | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT price FROM price_snapshots
        WHERE token_pair = ? AND dex_name = ?
        ORDER BY timestamp DESC LIMIT 1`,
        [tokenPair, dexName],
        (err: Error | null, row: any) => {
          if (err) {
            logger.error('Failed to get latest price', { error: err.message });
            reject(err);
          } else {
            resolve(row ? row.price : null);
          }
        }
      );
    });
  }

  /**
   * 清理旧数据（保留最近 30 天）
   */
  async cleanOldData(): Promise<void> {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;

    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM price_snapshots WHERE timestamp < ?`,
        [thirtyDaysAgo],
        (err: Error | null) => {
          if (err) {
            logger.error('Failed to clean old data', { error: err.message });
            reject(err);
          } else {
            logger.info('Old price snapshots cleaned');
            resolve();
          }
        }
      );
    });
  }
}

export const chartDataService = new ChartDataService();
