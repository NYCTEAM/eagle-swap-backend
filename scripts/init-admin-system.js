const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');
const sqlPath = path.join(__dirname, '..', 'src', 'database', 'init_admin_system.sql');

console.log('🔐 初始化后台管理系统...\n');
console.log('='.repeat(80));

try {
  const db = new Database(dbPath);
  
  // 读取并执行 SQL
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  db.exec(sql);
  
  console.log('✅ 后台管理系统表创建成功！\n');
  
  // 验证创建的表
  console.log('📊 已创建的表:');
  console.log('='.repeat(80));
  
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND (
      name LIKE '%admin%' OR 
      name LIKE '%revenue%' OR 
      name LIKE '%statistics%' OR
      name LIKE '%sales%' OR
      name LIKE '%config_changes%'
    )
    ORDER BY name
  `).all();
  
  tables.forEach((table, index) => {
    console.log(`  ${index + 1}. ${table.name}`);
  });
  
  // 验证创建的视图
  console.log('\n📈 已创建的视图:');
  console.log('='.repeat(80));
  
  const views = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='view' AND name LIKE '%admin%'
    ORDER BY name
  `).all();
  
  views.forEach((view, index) => {
    console.log(`  ${index + 1}. ${view.name}`);
  });
  
  // 检查默认管理员
  console.log('\n👤 默认管理员账号:');
  console.log('='.repeat(80));
  
  const admin = db.prepare(`
    SELECT username, email, role FROM admins WHERE username = 'admin'
  `).get();
  
  if (admin) {
    console.log(`  用户名: ${admin.username}`);
    console.log(`  邮箱: ${admin.email}`);
    console.log(`  角色: ${admin.role}`);
    console.log(`  默认密码: admin123 (请立即修改！)`);
  } else {
    console.log('  ⚠️  默认管理员未创建');
  }
  
  // 显示功能列表
  console.log('\n🎯 后台管理系统功能:');
  console.log('='.repeat(80));
  console.log('  ✅ 管理员登录认证');
  console.log('  ✅ 用户管理（查看、编辑、统计）');
  console.log('  ✅ 社区管理（创建、编辑、更换社区长）');
  console.log('  ✅ 节点管理（查看销售记录、统计）');
  console.log('  ✅ 平台收入统计');
  console.log('  ✅ 用户统计（每日新增、活跃用户）');
  console.log('  ✅ SWAP 交易统计');
  console.log('  ✅ 管理员操作日志');
  console.log('  ✅ 系统配置管理');
  
  // 显示可用的视图
  console.log('\n📊 可用的管理视图:');
  console.log('='.repeat(80));
  console.log('  1. admin_users_overview - 用户总览');
  console.log('  2. admin_communities_overview - 社区总览');
  console.log('  3. admin_revenue_overview - 收入总览');
  console.log('  4. admin_node_sales_stats - 节点销售统计');
  console.log('  5. admin_swap_stats - SWAP 交易统计');
  
  // 示例查询
  console.log('\n💡 查询示例:');
  console.log('='.repeat(80));
  console.log('-- 查询所有用户');
  console.log('SELECT * FROM admin_users_overview;');
  console.log('');
  console.log('-- 查询所有社区');
  console.log('SELECT * FROM admin_communities_overview;');
  console.log('');
  console.log('-- 查询最近30天收入');
  console.log('SELECT * FROM admin_revenue_overview LIMIT 30;');
  console.log('');
  console.log('-- 查询节点销售统计');
  console.log('SELECT * FROM admin_node_sales_stats;');
  
  db.close();
  
  console.log('\n🎉 后台管理系统初始化完成！');
  console.log('\n⚠️  重要提示:');
  console.log('  1. 请立即修改默认管理员密码！');
  console.log('  2. 生产环境需要使用 bcrypt 加密密码');
  console.log('  3. 建议启用 JWT 认证');
  
} catch (error) {
  console.error('❌ 错误:', error.message);
  console.error(error);
  process.exit(1);
}
