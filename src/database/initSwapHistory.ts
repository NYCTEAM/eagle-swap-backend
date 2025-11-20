import { Database } from 'sqlite3';
import { getDatabase } from './init';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * 初始化 Swap 历史相关的数据库表
 */
export async function initSwapHistoryTables(): Promise<void> {
  const db = getDatabase();
  const schemaPath = path.join(__dirname, 'schema-swap-history.sql');

  return new Promise((resolve, reject) => {
    // 读取 SQL 文件
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // 执行 SQL
    db.exec(schema, (err) => {
      if (err) {
        logger.error('Failed to initialize swap history tables', { error: err.message });
        reject(err);
      } else {
        logger.info('Swap history tables initialized successfully');
        resolve();
      }
    });
  });
}
