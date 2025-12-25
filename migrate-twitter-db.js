/**
 * Twitter数据库迁移脚本
 * 添加缺失的列到现有表
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data/eagleswap.db');
const db = new Database(dbPath);

console.log('🔧 Starting Twitter database migration...');

try {
  // 检查twitter_posts表是否存在
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='twitter_posts'
  `).get();

  if (!tableExists) {
    console.log('❌ twitter_posts table does not exist. Run initDatabase() first.');
    process.exit(1);
  }

  // 获取现有列
  const columns = db.prepare('PRAGMA table_info(twitter_posts)').all();
  const columnNames = columns.map(col => col.name);

  console.log('📋 Existing columns:', columnNames);

  // 需要添加的列
  const columnsToAdd = [
    { name: 'tweet_url', type: 'TEXT', default: null },
    { name: 'user_avatar', type: 'TEXT', default: null },
    { name: 'media_urls', type: 'TEXT', default: null },
    { name: 'retweet_count', type: 'INTEGER', default: 0 },
    { name: 'like_count', type: 'INTEGER', default: 0 },
    { name: 'reply_count', type: 'INTEGER', default: 0 },
    { name: 'reply_to_tweet_id', type: 'TEXT', default: null },
    { name: 'reply_to_username', type: 'TEXT', default: null }
  ];

  // 添加缺失的列
  for (const col of columnsToAdd) {
    if (!columnNames.includes(col.name)) {
      const defaultValue = col.default !== null ? `DEFAULT ${col.default}` : '';
      const sql = `ALTER TABLE twitter_posts ADD COLUMN ${col.name} ${col.type} ${defaultValue}`;
      
      console.log(`➕ Adding column: ${col.name}`);
      db.exec(sql);
    } else {
      console.log(`✅ Column ${col.name} already exists`);
    }
  }

  console.log('✅ Twitter database migration completed successfully!');

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
