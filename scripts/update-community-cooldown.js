const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');
const sqlPath = path.join(__dirname, '..', 'src', 'database', 'update_community_cooldown.sql');

console.log('🔄 更新社区冷却期规则...\n');
console.log('新规则: 加入社区后必须待满7天才能退出');
console.log('       退出后可以立即加入新社区\n');
console.log('='.repeat(80));

try {
  const db = new Database(dbPath);
  
  // 读取 SQL 文件
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  // 分割 SQL 语句（因为有些语句可能会失败，比如字段已存在）
  const statements = sql.split(';').filter(s => s.trim());
  
  let successCount = 0;
  let skipCount = 0;
  
  statements.forEach((statement, index) => {
    const trimmed = statement.trim();
    if (!trimmed || trimmed.startsWith('--')) return;
    
    try {
      db.exec(trimmed);
      successCount++;
    } catch (error) {
      // 如果是字段已存在的错误，跳过
      if (error.message.includes('duplicate column name')) {
        skipCount++;
        console.log(`⚠️  字段已存在，跳过: ${error.message.split(':')[1]?.trim()}`);
      } else {
        console.log(`⚠️  跳过语句 ${index + 1}: ${error.message}`);
      }
    }
  });
  
  console.log(`\n✅ 执行成功: ${successCount} 条语句`);
  if (skipCount > 0) {
    console.log(`⚠️  跳过: ${skipCount} 条语句（字段已存在）`);
  }
  
  // 验证更新
  console.log('\n📊 验证更新结果:');
  console.log('='.repeat(80));
  
  // 检查 community_members 表结构
  const columns = db.prepare(`PRAGMA table_info(community_members)`).all();
  const hasCanLeaveAt = columns.some(col => col.name === 'can_leave_at');
  
  if (hasCanLeaveAt) {
    console.log('✅ can_leave_at 字段已添加');
  } else {
    console.log('❌ can_leave_at 字段添加失败');
  }
  
  // 检查 community_changes 表结构
  const changeColumns = db.prepare(`PRAGMA table_info(community_changes)`).all();
  const hasLeaveReason = changeColumns.some(col => col.name === 'leave_reason');
  const hasIsForced = changeColumns.some(col => col.name === 'is_forced');
  
  if (hasLeaveReason) {
    console.log('✅ leave_reason 字段已添加');
  } else {
    console.log('❌ leave_reason 字段添加失败');
  }
  
  if (hasIsForced) {
    console.log('✅ is_forced 字段已添加');
  } else {
    console.log('❌ is_forced 字段添加失败');
  }
  
  // 检查视图
  const views = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='view' AND name = 'member_leave_status'
  `).all();
  
  if (views.length > 0) {
    console.log('✅ member_leave_status 视图已创建');
  } else {
    console.log('❌ member_leave_status 视图创建失败');
  }
  
  // 检查触发器
  const triggers = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='trigger' AND (
      name = 'set_can_leave_at' OR 
      name = 'reset_can_leave_at_on_change'
    )
  `).all();
  
  console.log(`✅ 触发器已创建: ${triggers.length} 个`);
  triggers.forEach(t => {
    console.log(`   - ${t.name}`);
  });
  
  // 显示规则说明
  console.log('\n📝 社区冷却期规则:');
  console.log('='.repeat(80));
  console.log('1️⃣  加入社区:');
  console.log('   - 成员加入社区时，自动设置 can_leave_at = joined_at + 7天');
  console.log('   - 触发器自动处理，无需手动设置');
  console.log('');
  console.log('2️⃣  退出社区:');
  console.log('   - 必须满足: datetime(\'now\') >= can_leave_at');
  console.log('   - 即：必须待满7天才能退出');
  console.log('   - 退出后立即可以加入新社区（无冷却期）');
  console.log('');
  console.log('3️⃣  更换社区:');
  console.log('   - 必须满足: datetime(\'now\') >= can_leave_at');
  console.log('   - 更换后，自动重置 joined_at 和 can_leave_at');
  console.log('   - 新社区同样需要待满7天才能再次退出');
  console.log('');
  console.log('4️⃣  强制退出（被弹劾）:');
  console.log('   - 不受7天限制');
  console.log('   - 直接删除成员记录');
  console.log('   - 记录 is_forced = 1');
  
  // 查询示例
  console.log('\n💡 查询示例:');
  console.log('='.repeat(80));
  console.log('-- 检查成员是否可以离开社区');
  console.log('SELECT * FROM member_leave_status WHERE member_address = \'0x...\';');
  console.log('');
  console.log('-- 查询还需要等待多少天');
  console.log('SELECT member_address, community_name, days_until_can_leave');
  console.log('FROM member_leave_status WHERE can_leave_now = 0;');
  
  db.close();
  
  console.log('\n🎉 社区冷却期规则更新完成！');
  
} catch (error) {
  console.error('❌ 错误:', error.message);
  console.error(error);
  process.exit(1);
}
