const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('🏘️ 检查社区系统数据库配置...\n');
console.log('='.repeat(80));

try {
  const db = new Database(dbPath);
  
  // 1. 检查社区相关的表
  console.log('\n📋 社区相关表:');
  console.log('='.repeat(80));
  
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND (
      name LIKE '%community%' OR 
      name LIKE '%impeachment%' OR
      name LIKE '%vote%'
    )
    ORDER BY name
  `).all();
  
  if (tables.length > 0) {
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.name}`);
    });
  } else {
    console.log('  ❌ 没有找到社区相关的表！');
  }
  
  // 2. 检查社区等级配置
  console.log('\n🏆 社区等级配置:');
  console.log('='.repeat(80));
  
  try {
    const communityLevels = db.prepare(`
      SELECT * FROM community_level_config ORDER BY level
    `).all();
    
    if (communityLevels.length > 0) {
      console.table(communityLevels.map(l => ({
        '等级': l.level,
        '名称': l.level_name,
        '最小价值': '$' + l.min_total_value.toLocaleString(),
        '成员加成': (l.member_bonus * 100) + '%',
        '社区长加成': (l.leader_bonus * 100) + '%',
        '图标': l.icon
      })));
    } else {
      console.log('  ⚠️  没有社区等级配置');
    }
  } catch (e) {
    console.log('  ❌ community_level_config 表不存在');
  }
  
  // 3. 检查社区表结构
  console.log('\n🏘️ communities 表结构:');
  console.log('='.repeat(80));
  
  try {
    const communityColumns = db.prepare(`PRAGMA table_info(communities)`).all();
    console.table(communityColumns.map(col => ({
      '字段名': col.name,
      '类型': col.type,
      '非空': col.notnull ? '是' : '否',
      '默认值': col.dflt_value || '-'
    })));
  } catch (e) {
    console.log('  ❌ communities 表不存在');
  }
  
  // 4. 检查社区成员表结构
  console.log('\n👥 community_members 表结构:');
  console.log('='.repeat(80));
  
  try {
    const memberColumns = db.prepare(`PRAGMA table_info(community_members)`).all();
    console.table(memberColumns.map(col => ({
      '字段名': col.name,
      '类型': col.type,
      '非空': col.notnull ? '是' : '否',
      '默认值': col.dflt_value || '-'
    })));
  } catch (e) {
    console.log('  ❌ community_members 表不存在');
  }
  
  // 5. 检查弹劾投票表结构
  console.log('\n🗳️ impeachment_votes 表结构:');
  console.log('='.repeat(80));
  
  try {
    const voteColumns = db.prepare(`PRAGMA table_info(impeachment_votes)`).all();
    console.table(voteColumns.map(col => ({
      '字段名': col.name,
      '类型': col.type,
      '非空': col.notnull ? '是' : '否',
      '默认值': col.dflt_value || '-'
    })));
  } catch (e) {
    console.log('  ❌ impeachment_votes 表不存在');
  }
  
  // 6. 检查投票记录表
  console.log('\n📝 vote_records 表结构:');
  console.log('='.repeat(80));
  
  try {
    const recordColumns = db.prepare(`PRAGMA table_info(vote_records)`).all();
    console.table(recordColumns.map(col => ({
      '字段名': col.name,
      '类型': col.type,
      '非空': col.notnull ? '是' : '否',
      '默认值': col.dflt_value || '-'
    })));
  } catch (e) {
    console.log('  ❌ vote_records 表不存在');
  }
  
  // 7. 检查弹劾历史表
  console.log('\n📜 impeachment_history 表结构:');
  console.log('='.repeat(80));
  
  try {
    const historyColumns = db.prepare(`PRAGMA table_info(impeachment_history)`).all();
    console.table(historyColumns.map(col => ({
      '字段名': col.name,
      '类型': col.type,
      '非空': col.notnull ? '是' : '否',
      '默认值': col.dflt_value || '-'
    })));
  } catch (e) {
    console.log('  ❌ impeachment_history 表不存在');
  }
  
  // 8. 检查社区变更记录表
  console.log('\n📊 community_changes 表结构:');
  console.log('='.repeat(80));
  
  try {
    const changeColumns = db.prepare(`PRAGMA table_info(community_changes)`).all();
    console.table(changeColumns.map(col => ({
      '字段名': col.name,
      '类型': col.type,
      '非空': col.notnull ? '是' : '否',
      '默认值': col.dflt_value || '-'
    })));
  } catch (e) {
    console.log('  ❌ community_changes 表不存在');
  }
  
  // 9. 检查索引
  console.log('\n🔍 社区相关索引:');
  console.log('='.repeat(80));
  
  const indexes = db.prepare(`
    SELECT name, tbl_name FROM sqlite_master 
    WHERE type='index' AND (
      name LIKE '%community%' OR 
      name LIKE '%impeachment%' OR
      name LIKE '%vote%'
    )
    ORDER BY tbl_name, name
  `).all();
  
  if (indexes.length > 0) {
    console.table(indexes.map(idx => ({
      '索引名': idx.name,
      '表名': idx.tbl_name
    })));
  } else {
    console.log('  ⚠️  没有找到社区相关索引');
  }
  
  // 10. 总结检查结果
  console.log('\n📝 社区系统检查总结:');
  console.log('='.repeat(80));
  
  const checks = {
    'community_level_config 表': false,
    'communities 表': false,
    'community_members 表': false,
    'impeachment_votes 表': false,
    'vote_records 表': false,
    'impeachment_history 表': false,
    'community_changes 表': false
  };
  
  Object.keys(checks).forEach(key => {
    const tableName = key.replace(' 表', '');
    try {
      db.prepare(`SELECT 1 FROM ${tableName} LIMIT 1`).get();
      checks[key] = true;
    } catch (e) {}
  });
  
  Object.keys(checks).forEach(key => {
    const status = checks[key] ? '✅' : '❌';
    console.log(`  ${status} ${key}`);
  });
  
  const allComplete = Object.values(checks).every(v => v);
  
  console.log('\n' + '='.repeat(80));
  if (allComplete) {
    console.log('🎉 社区系统配置完整！');
  } else {
    console.log('⚠️  社区系统配置不完整，需要补充！');
  }
  
  // 11. 显示社区系统核心功能
  if (allComplete) {
    console.log('\n🎯 社区系统核心功能:');
    console.log('='.repeat(80));
    console.log('  ✅ 自动选举社区长（节点价值最高者）');
    console.log('  ✅ 民主弹劾投票（投票权重 = 节点价值）');
    console.log('  ✅ 社区等级系统（5个等级）');
    console.log('  ✅ 挖矿加成（成员 0-20%，社区长 10-30%）');
    console.log('  ✅ 社区变更记录');
    console.log('  ✅ 弹劾历史追踪');
  }
  
  db.close();
  
} catch (error) {
  console.error('❌ 错误:', error.message);
}
