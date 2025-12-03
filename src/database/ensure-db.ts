
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export function ensureDatabase() {
  const dbPath = path.join(__dirname, 'eagle-swap.db');
  console.log('🔍 [DB Check] Checking database at:', dbPath);

  const db = new Database(dbPath);

  // 检查 otc_orders 表是否存在
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='otc_orders'
  `).get();

  if (!tableExists) {
    console.log('⚠️ [DB Check] Table otc_orders missing. Initializing database...');
    
    try {
      // 读取 SQL 文件
      const sqlPath = path.join(__dirname, 'init_otc.sql');
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        db.exec(sql);
        console.log('✅ [DB Check] Database initialized successfully!');
      } else {
        console.error('❌ [DB Check] init_otc.sql not found at:', sqlPath);
      }
    } catch (error) {
      console.error('❌ [DB Check] Failed to initialize database:', error);
    }
  } else {
    console.log('✅ [DB Check] Database tables already exist.');
    
    // 简单的列检查，确保结构匹配 (可选)
    try {
      const columns = db.prepare(`PRAGMA table_info(otc_orders)`).all() as any[];
      const hasSide = columns.some(c => c.name === 'side');
      if (!hasSide) {
        console.error('⚠️ [DB Check] Table exists but schema is outdated (missing "side" column).');
        console.log('⚠️ [DB Check] Please migrate database or recreate it.');
        // 在这里可以添加自动迁移逻辑，或者简单地建议手动处理
      }
    } catch (e) {
      // ignore
    }
  }
  
  return db;
}
