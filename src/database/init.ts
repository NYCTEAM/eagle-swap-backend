import sqlite3 from 'sqlite3';
import { initSwapHistoryTables } from './initSwapHistory';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

const DB_PATH = process.env.DB_PATH || './data/eagleswap.db';
const BACKUP_PATH = process.env.DB_BACKUP_PATH || './data/backups';

// Ensure directories exist
function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`Created directory: ${dirPath}`);
  }
}

// Database schema definitions
const SCHEMA_SQL = `
-- Tokens table
CREATE TABLE IF NOT EXISTS tokens (
  address TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  logo_uri TEXT,
  chain_id INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Token prices table
CREATE TABLE IF NOT EXISTS token_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_address TEXT NOT NULL,
  price REAL NOT NULL,
  price_usd REAL NOT NULL,
  volume_24h REAL DEFAULT 0,
  market_cap REAL DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_address) REFERENCES tokens(address)
);

-- Trading pairs table
CREATE TABLE IF NOT EXISTS trading_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pair_address TEXT UNIQUE NOT NULL,
  token_a TEXT NOT NULL,
  token_b TEXT NOT NULL,
  reserve_a TEXT NOT NULL DEFAULT '0',
  reserve_b TEXT NOT NULL DEFAULT '0',
  total_supply TEXT NOT NULL DEFAULT '0',
  fee REAL NOT NULL DEFAULT 0.003,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_a) REFERENCES tokens(address),
  FOREIGN KEY (token_b) REFERENCES tokens(address)
);

-- Liquidity positions table
CREATE TABLE IF NOT EXISTS liquidity_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,
  pair_address TEXT NOT NULL,
  lp_token_amount TEXT NOT NULL,
  token_a_amount TEXT NOT NULL,
  token_b_amount TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pair_address) REFERENCES trading_pairs(pair_address)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT UNIQUE NOT NULL,
  user_address TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('swap', 'add_liquidity', 'remove_liquidity', 'stake', 'unstake')),
  token_in TEXT,
  token_out TEXT,
  amount_in TEXT,
  amount_out TEXT,
  pair_address TEXT,
  lp_amount TEXT,
  gas_used TEXT NOT NULL,
  gas_price TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  block_number INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_in) REFERENCES tokens(address),
  FOREIGN KEY (token_out) REFERENCES tokens(address),
  FOREIGN KEY (pair_address) REFERENCES trading_pairs(pair_address)
);

-- Farms table
CREATE TABLE IF NOT EXISTS farms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_address TEXT UNIQUE NOT NULL,
  lp_token_address TEXT NOT NULL,
  reward_token_address TEXT NOT NULL,
  alloc_point INTEGER NOT NULL DEFAULT 0,
  total_staked TEXT NOT NULL DEFAULT '0',
  reward_per_block TEXT NOT NULL DEFAULT '0',
  start_block INTEGER NOT NULL,
  end_block INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lp_token_address) REFERENCES trading_pairs(pair_address),
  FOREIGN KEY (reward_token_address) REFERENCES tokens(address)
);

-- Staking positions table
CREATE TABLE IF NOT EXISTS staking_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,
  farm_id INTEGER NOT NULL,
  staked_amount TEXT NOT NULL DEFAULT '0',
  reward_debt TEXT NOT NULL DEFAULT '0',
  pending_rewards TEXT NOT NULL DEFAULT '0',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT UNIQUE NOT NULL,
  username TEXT,
  email TEXT,
  avatar_url TEXT,
  preferences TEXT DEFAULT '{}',
  is_active BOOLEAN DEFAULT 1,
  total_trades INTEGER DEFAULT 0,
  total_volume TEXT DEFAULT '0',
  total_liquidity TEXT DEFAULT '0',
  total_rewards TEXT DEFAULT '0',
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_token_prices_address ON token_prices(token_address);
CREATE INDEX IF NOT EXISTS idx_token_prices_timestamp ON token_prices(timestamp);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_tokens ON trading_pairs(token_a, token_b);
CREATE INDEX IF NOT EXISTS idx_liquidity_positions_user ON liquidity_positions(user_address);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_staking_positions_user ON staking_positions(user_address);
CREATE INDEX IF NOT EXISTS idx_staking_positions_farm ON staking_positions(farm_id);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_tokens_timestamp 
  AFTER UPDATE ON tokens
  BEGIN
    UPDATE tokens SET updated_at = CURRENT_TIMESTAMP WHERE address = NEW.address;
  END;

CREATE TRIGGER IF NOT EXISTS update_trading_pairs_timestamp 
  AFTER UPDATE ON trading_pairs
  BEGIN
    UPDATE trading_pairs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_liquidity_positions_timestamp 
  AFTER UPDATE ON liquidity_positions
  BEGIN
    UPDATE liquidity_positions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_farms_timestamp 
  AFTER UPDATE ON farms
  BEGIN
    UPDATE farms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_staking_positions_timestamp 
  AFTER UPDATE ON staking_positions
  BEGIN
    UPDATE staking_positions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
  AFTER UPDATE ON users
  BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`;

// Initialize database
export async function initializeDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(DB_PATH);
      ensureDirectoryExists(dataDir);
      ensureDirectoryExists(BACKUP_PATH);

      // Create database connection
      const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          logger.error('Error opening database:', err);
          reject(err);
          return;
        }
        
        logger.info(`Connected to SQLite database: ${DB_PATH}`);
      });

      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) {
          logger.error('Error enabling foreign keys:', err);
          reject(err);
          return;
        }
      });

      // Execute schema
      db.exec(SCHEMA_SQL, async (err) => {
        if (err) {
          logger.error('Error creating database schema:', err);
          reject(err);
          return;
        }
        
        logger.info('Database schema initialized successfully');
        
        // Initialize swap history tables
        try {
          dbInstance = db;
          await initSwapHistoryTables();
          logger.info('Swap history tables initialized');
        } catch (error: any) {
          logger.error('Error initializing swap history tables:', error);
          // Continue even if swap history tables fail
        }

        // Initialize all additional SQL schemas
        // 执行 SQL 文件
        const sqlFiles = [
          'schema.sql',
          'init_node_levels.sql',
          'init_nft_multipliers.sql',
          'init_swap_mining.sql',
          'init_yearly_rewards_schema.sql',
          'init_yearly_rewards.sql',
          'schema-solana-swap.sql',
        ];

        for (const sqlFile of sqlFiles) {
          try {
            const sqlPath = path.join(__dirname, sqlFile);
            if (fs.existsSync(sqlPath)) {
              const sqlContent = fs.readFileSync(sqlPath, 'utf8');
              await new Promise<void>((resolveSql, rejectSql) => {
                db.exec(sqlContent, (err) => {
                  if (err) {
                    logger.warn(`Warning initializing ${sqlFile}:`, err.message);
                    resolveSql(); // Continue even if fails
                  } else {
                    resolveSql();
                  }
                });
              });
              logger.info(`${sqlFile} initialized`);
            }
          } catch (error: any) {
            logger.warn(`Warning loading ${sqlFile}:`, error.message);
            // Continue even if file doesn't exist or fails
          }
        }

        // 图表功能已移除 - 禁用图表数据表初始化
        // Initialize chart data tables
        // try {
        //   const chartSchemaPath = path.join(__dirname, 'schema-chart-data.sql');
        //   const chartSchema = fs.readFileSync(chartSchemaPath, 'utf8');
        //   await new Promise<void>((resolveChart, rejectChart) => {
        //     db.exec(chartSchema, (err) => {
        //       if (err) rejectChart(err);
        //       else resolveChart();
        //     });
        //   });
        //   logger.info('Chart data tables initialized');
        // } catch (error: any) {
        //   logger.error('Error initializing chart data tables:', error);
        // }
        
        logger.info('All database tables initialized successfully');
        resolve(db);
      });

    } catch (error) {
      logger.error('Error initializing database:', error);
      reject(error);
    }
  });
}

// Get database instance
let dbInstance: sqlite3.Database | null = null;

export function getDatabase(): sqlite3.Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export async function initDatabase(): Promise<sqlite3.Database> {
  if (!dbInstance) {
    dbInstance = await initializeDatabase();
  }
  return dbInstance;
}

// Close database connection
export function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      dbInstance.close((err) => {
        if (err) {
          logger.error('Error closing database:', err);
          reject(err);
        } else {
          logger.info('Database connection closed');
          dbInstance = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

// Backup database
export function backupDatabase(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `eagle-swap-backup-${timestamp}.db`;
      const backupFilePath = path.join(BACKUP_PATH, backupFileName);

      fs.copyFileSync(DB_PATH, backupFilePath);
      logger.info(`Database backed up to: ${backupFilePath}`);
      resolve(backupFilePath);
    } catch (error) {
      logger.error('Error backing up database:', error);
      reject(error);
    }
  });
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const db = getDatabase();
    
    return new Promise((resolve) => {
      db.get('SELECT 1 as test', (err, row) => {
        if (err) {
          logger.error('Database health check failed:', err);
          resolve(false);
        } else {
          logger.info('Database health check passed');
          resolve(true);
        }
      });
    });
  } catch (error) {
    logger.error('Database health check error:', error);
    return false;
  }
}