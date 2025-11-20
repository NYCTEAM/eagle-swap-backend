const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('🔄 更新社区冷却期规则...\n');
console.log('新规则: 加入社区后必须待满7天才能退出');
console.log('       退出后可以立即加入新社区\n');
console.log('='.repeat(80));

try {
  const db = new Database(dbPath);
  
  // 1. 添加 can_leave_at 字段
  console.log('\n1️⃣  添加 can_leave_at 字段...');
  try {
    db.exec(`ALTER TABLE community_members ADD COLUMN can_leave_at DATETIME`);
    console.log('✅ can_leave_at 字段已添加');
    
    // 更新现有记录
    db.exec(`
      UPDATE community_members 
      SET can_leave_at = datetime(joined_at, '+7 days')
      WHERE can_leave_at IS NULL
    `);
    console.log('✅ 现有记录已更新');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('⚠️  can_leave_at 字段已存在');
    } else {
      throw e;
    }
  }
  
  // 2. 添加 leave_reason 字段
  console.log('\n2️⃣  添加 leave_reason 字段...');
  try {
    db.exec(`ALTER TABLE community_changes ADD COLUMN leave_reason TEXT`);
    console.log('✅ leave_reason 字段已添加');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('⚠️  leave_reason 字段已存在');
    } else {
      throw e;
    }
  }
  
  // 3. 添加 is_forced 字段
  console.log('\n3️⃣  添加 is_forced 字段...');
  try {
    db.exec(`ALTER TABLE community_changes ADD COLUMN is_forced BOOLEAN DEFAULT 0`);
    console.log('✅ is_forced 字段已添加');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('⚠️  is_forced 字段已存在');
    } else {
      throw e;
    }
  }
  
  // 4. 创建视图
  console.log('\n4️⃣  创建 member_leave_status 视图...');
  try {
    db.exec(`DROP VIEW IF EXISTS member_leave_status`);
    db.exec(`
      CREATE VIEW member_leave_status AS
      SELECT 
          cm.id,
          cm.community_id,
          cm.member_address,
          cm.joined_at,
          cm.can_leave_at,
          CASE 
              WHEN datetime('now') >= cm.can_leave_at THEN 1
              ELSE 0
          END as can_leave_now,
          CAST((julianday(cm.can_leave_at) - julianday('now')) AS INTEGER) as days_until_can_leave,
          c.community_name
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
    `);
    console.log('✅ member_leave_status 视图已创建');
  } catch (e) {
    console.error('❌ 视图创建失败:', e.message);
  }
  
  // 5. 创建触发器：加入社区时自动设置 can_leave_at
  console.log('\n5️⃣  创建触发器...');
  try {
    db.exec(`DROP TRIGGER IF EXISTS set_can_leave_at`);
    db.exec(`
      CREATE TRIGGER set_can_leave_at
      AFTER INSERT ON community_members
      BEGIN
          UPDATE community_members 
          SET can_leave_at = datetime(NEW.joined_at, '+7 days')
          WHERE id = NEW.id AND can_leave_at IS NULL;
      END
    `);
    console.log('✅ set_can_leave_at 触发器已创建');
  } catch (e) {
    console.error('❌ 触发器创建失败:', e.message);
  }
  
  // 6. 创建触发器：更换社区时重置 can_leave_at
  try {
    db.exec(`DROP TRIGGER IF EXISTS reset_can_leave_at_on_change`);
    db.exec(`
      CREATE TRIGGER reset_can_leave_at_on_change
      AFTER UPDATE OF community_id ON community_members
      BEGIN
          UPDATE community_members 
          SET joined_at = CURRENT_TIMESTAMP,
              can_leave_at = datetime(CURRENT_TIMESTAMP, '+7 days')
          WHERE id = NEW.id;
      END
    `);
    console.log('✅ reset_can_leave_at_on_change 触发器已创建');
  } catch (e) {
    console.error('❌ 触发器创建失败:', e.message);
  }
  
  // 验证
  console.log('\n📊 验证更新结果:');
  console.log('='.repeat(80));
  
  const columns = db.prepare(`PRAGMA table_info(community_members)`).all();
  console.log('\ncommunity_members 表字段:');
  console.table(columns.map(col => ({
    '字段名': col.name,
    '类型': col.type,
    '默认值': col.dflt_value || '-'
  })));
  
  const changeColumns = db.prepare(`PRAGMA table_info(community_changes)`).all();
  console.log('\ncommunity_changes 表字段:');
  console.table(changeColumns.map(col => ({
    '字段名': col.name,
    '类型': col.type,
    '默认值': col.dflt_value || '-'
  })));
  
  const triggers = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='trigger' AND (
      name = 'set_can_leave_at' OR 
      name = 'reset_can_leave_at_on_change'
    )
  `).all();
  
  console.log('\n触发器:');
  triggers.forEach(t => {
    console.log(`  ✅ ${t.name}`);
  });
  
  // 显示规则说明
  console.log('\n📝 社区冷却期规则:');
  console.log('='.repeat(80));
  console.log('1️⃣  加入社区:');
  console.log('   - 成员加入社区时，自动设置 can_leave_at = joined_at + 7天');
  console.log('   - 触发器自动处理');
  console.log('');
  console.log('2️⃣  退出社区:');
  console.log('   - 必须满足: can_leave_now = 1 (已满7天)');
  console.log('   - 退出后立即可以加入新社区（无冷却期）');
  console.log('');
  console.log('3️⃣  更换社区:');
  console.log('   - 必须满足: can_leave_now = 1 (已满7天)');
  console.log('   - 更换后自动重置 joined_at 和 can_leave_at');
  console.log('   - 新社区同样需要待满7天');
  console.log('');
  console.log('4️⃣  强制退出（被弹劾）:');
  console.log('   - 不受7天限制');
  console.log('   - 记录 is_forced = 1');
  
  console.log('\n💡 查询示例:');
  console.log('='.repeat(80));
  console.log('-- 检查成员是否可以离开');
  console.log('SELECT * FROM member_leave_status WHERE member_address = \'0x...\';');
  console.log('');
  console.log('-- 查询所有不能离开的成员');
  console.log('SELECT member_address, community_name, days_until_can_leave');
  console.log('FROM member_leave_status WHERE can_leave_now = 0;');
  
  db.close();
  
  console.log('\n🎉 社区冷却期规则更新完成！');
  
} catch (error) {
  console.error('❌ 错误:', error.message);
  console.error(error);
  process.exit(1);
}
