const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 数据库路径（与后端代码一致）
const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');
const db = new Database(dbPath);

console.log('🎖️ 初始化推荐人等级系统...\n');

try {
  // 1. 检查并添加 users 表字段
  console.log('检查 users 表字段...');
  
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  const columnNames = tableInfo.map(col => col.name);
  
  // 添加 referral_value 字段
  if (!columnNames.includes('referral_value')) {
    db.exec('ALTER TABLE users ADD COLUMN referral_value REAL DEFAULT 0');
    console.log('✅ 添加 referral_value 字段');
  } else {
    console.log('⏭️  referral_value 字段已存在');
  }
  
  // 添加 referrer_level 字段
  if (!columnNames.includes('referrer_level')) {
    db.exec('ALTER TABLE users ADD COLUMN referrer_level INTEGER DEFAULT 1');
    console.log('✅ 添加 referrer_level 字段');
  } else {
    console.log('⏭️  referrer_level 字段已存在');
  }
  
  // 添加 swap_mining_bonus 字段
  if (!columnNames.includes('swap_mining_bonus')) {
    db.exec('ALTER TABLE users ADD COLUMN swap_mining_bonus REAL DEFAULT 0.05');
    console.log('✅ 添加 swap_mining_bonus 字段');
  } else {
    console.log('⏭️  swap_mining_bonus 字段已存在');
  }
  
  console.log('');
  
  // 2. 读取并执行 SQL 文件
  const sqlPath = path.join(__dirname, '..', 'src', 'database', 'init_referrer_level.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  // 执行 SQL
  db.exec(sql);
  
  console.log('✅ 推荐人等级系统表创建成功\n');
  
  // 验证推荐人等级配置
  const levels = db.prepare('SELECT * FROM referrer_level_config ORDER BY level').all();
  console.log('🏆 推荐人等级配置:');
  levels.forEach(level => {
    console.log(`  ${level.icon} ${level.level}. ${level.level_name} - ${level.description}`);
    console.log(`     SWAP 挖矿加成: ${level.swap_mining_bonus * 100}%`);
  });
  
  console.log('\n✅ 推荐人等级系统初始化完成！');
  
} catch (error) {
  console.error('❌ 初始化失败:', error);
  process.exit(1);
} finally {
  db.close();
}
