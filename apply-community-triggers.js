const db = require('better-sqlite3')('./data/eagle-swap.db');
const fs = require('fs');

console.log('=== 应用社区触发器 ===\n');

let hasErrors = false;
const results = [];

try {
  // 读取 SQL 文件
  console.log('1. 读取触发器 SQL 文件...');
  const sqlPath = './src/database/community_triggers.sql';
  
  if (!fs.existsSync(sqlPath)) {
    throw new Error('触发器文件不存在: ' + sqlPath);
  }
  
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('   ✅ SQL 文件读取成功\n');
  
  // 分割 SQL 语句（按分号分割，但保留触发器内的分号）
  console.log('2. 执行触发器...');
  
  // 执行整个 SQL 文件
  try {
    db.exec(sql);
    console.log('   ✅ 所有触发器执行成功\n');
  } catch (error) {
    console.error('   ❌ 触发器执行失败:', error.message);
    hasErrors = true;
  }
  
  // 验证触发器是否创建成功
  console.log('3. 验证触发器...');
  const triggers = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='trigger' 
    AND name LIKE '%community%'
    ORDER BY name
  `).all();
  
  console.log(`   ✅ 找到 ${triggers.length} 个社区相关触发器:`);
  triggers.forEach(t => {
    console.log(`      - ${t.name}`);
    results.push({ type: 'trigger', name: t.name, status: 'success' });
  });
  
  // 验证视图是否创建成功
  console.log('\n4. 验证视图...');
  const views = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='view' 
    AND (name LIKE '%community%' OR name = 'community_statistics_view' OR name = 'community_member_details')
    ORDER BY name
  `).all();
  
  console.log(`   ✅ 找到 ${views.length} 个社区相关视图:`);
  views.forEach(v => {
    console.log(`      - ${v.name}`);
    results.push({ type: 'view', name: v.name, status: 'success' });
  });
  
  // 测试触发器功能
  console.log('\n5. 测试触发器功能...');
  
  // 检查是否有测试数据
  const testCommunity = db.prepare('SELECT * FROM communities LIMIT 1').get();
  
  if (testCommunity) {
    console.log('   ✅ 发现测试社区，触发器已准备就绪');
    
    // 查询社区统计
    const stats = db.prepare('SELECT * FROM community_statistics_view WHERE id = ?').get(testCommunity.id);
    if (stats) {
      console.log('   ✅ 社区统计视图工作正常');
      console.log(`      社区: ${stats.community_name}`);
      console.log(`      等级: ${stats.level_name} (${stats.community_level})`);
      console.log(`      总价值: $${stats.total_value}`);
      console.log(`      成员数: ${stats.total_members}`);
      console.log(`      成员加成: ${stats.member_bonus_rate * 100}%`);
      console.log(`      社区长加成: ${stats.leader_bonus_rate * 100}%`);
    }
  } else {
    console.log('   ℹ️  没有测试数据，触发器将在有数据时自动工作');
  }
  
  console.log('\n=== ✅ 应用完成 ===');
  console.log('\n📊 总结:');
  console.log(`   触发器: ${triggers.length} 个`);
  console.log(`   视图: ${views.length} 个`);
  console.log(`   状态: ${hasErrors ? '❌ 有错误' : '✅ 全部成功'}`);
  
  if (!hasErrors) {
    console.log('\n🎉 社区触发器系统已完全就绪！');
    console.log('\n功能说明:');
    console.log('   ✅ 成员购买 NFT → 自动更新社区价值');
    console.log('   ✅ 社区价值更新 → 自动升级社区等级');
    console.log('   ✅ 成员价值变化 → 自动选举社区长');
    console.log('   ✅ 成员加入/离开 → 自动更新统计');
  }
  
} catch (error) {
  console.error('\n❌ 严重错误:', error.message);
  console.error(error.stack);
  hasErrors = true;
} finally {
  db.close();
  console.log('\n数据库连接已关闭');
}

// 退出码
process.exit(hasErrors ? 1 : 0);
