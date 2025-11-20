import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '../../data/eagleswap.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// 确保 data 目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let dbInstance: any = null;

// 创建数据库连接
export function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
    // 启用外键约束
    dbInstance.pragma('foreign_keys = ON');
    // 启用 WAL 模式（提高并发性能）
    dbInstance.pragma('journal_mode = WAL');
  }
  return dbInstance;
}

export const db = getDb();

/**
 * 初始化数据库
 */
export function initDatabase() {
  console.log('Initializing database...');
  
  try {
    // 读取 schema.sql
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // 执行 schema
    db.exec(schema);
    
    console.log('✅ Database initialized successfully');
    console.log('📍 Database location:', dbPath);
    
    // 显示表列表
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `).all();
    
    console.log('📊 Tables created:', tables.map((t: any) => t.name).join(', '));
    
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * 获取数据库统计信息
 */
export function getDatabaseStats() {
  const stats = {
    users: db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
    nodes: db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number },
    rewards: db.prepare('SELECT COUNT(*) as count FROM node_mining_rewards').get() as { count: number },
    referrals: db.prepare('SELECT COUNT(*) as count FROM referral_relationships').get() as { count: number },
  };
  
  return {
    users: stats.users.count,
    nodes: stats.nodes.count,
    rewards: stats.rewards.count,
    referrals: stats.referrals.count,
  };
}

/**
 * 关闭数据库连接
 */
export function closeDatabase() {
  db.close();
  console.log('Database connection closed');
}

// 进程退出时关闭数据库
process.on('exit', () => {
  closeDatabase();
});

process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});
