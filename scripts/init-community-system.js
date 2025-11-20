const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');
const db = new Database(dbPath);

console.log('🏘️ 初始化社区系统...\n');

try {
  // 读取 SQL 文件
  const sqlPath = path.join(__dirname, '..', 'src', 'database', 'init_community_system.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  // 执行 SQL
  db.exec(sql);
  
  console.log('✅ 社区系统表创建成功\n');
  
  // 验证表是否创建
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name LIKE '%community%' OR name LIKE '%impeachment%'
    ORDER BY name
  `).all();
  
  console.log('📊 已创建的表:');
  tables.forEach(table => {
    console.log(`  - ${table.name}`);
  });
  
  // 验证社区等级配置
  const levels = db.prepare('SELECT * FROM community_level_config ORDER BY level').all();
  console.log('\n🏆 社区等级配置:');
  levels.forEach(level => {
    console.log(`  ${level.level}. ${level.level_name} - ${level.description}`);
    console.log(`     成员加成: ${level.member_bonus_rate * 100}%, 社区长加成: ${level.leader_bonus_rate * 100}%`);
  });
  
  console.log('\n✅ 社区系统初始化完成！');
  
} catch (error) {
  console.error('❌ 初始化失败:', error);
  process.exit(1);
} finally {
  db.close();
}
