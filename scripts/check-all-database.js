const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('🔍 全面检查 Eagle Swap 数据库...\n');
console.log('数据库路径:', dbPath);
console.log('='.repeat(80));

try {
  const db = new Database(dbPath);
  
  // 获取所有表
  const allTables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  console.log(`\n📊 数据库中的所有表 (${allTables.length} 个):`);
  console.log('='.repeat(80));
  allTables.forEach((table, index) => {
    console.log(`  ${(index + 1).toString().padStart(2, '0')}. ${table.name}`);
  });
  
  // 定义所有系统需要的表
  const requiredTables = {
    '核心系统': [
      'users',
      'system_config'
    ],
    '节点系统': [
      'nodes',
      'node_levels',
      'node_level_stages',
      'node_mining_rewards'
    ],
    'SWAP 系统': [
      'swap_transactions',
      'swap_rewards',
      'tokens',
      'trading_pairs',
      'liquidity_positions'
    ],
    '推荐人系统': [
      'referral_relationships',
      'referral_rewards',
      'referrer_level_config'
    ],
    '社区系统': [
      'communities',
      'community_members',
      'community_level_config',
      'community_changes',
      'impeachment_votes',
      'vote_records',
      'impeachment_history'
    ],
    '后台管理系统': [
      'admins',
      'admin_logs',
      'platform_revenue',
      'user_statistics',
      'community_statistics',
      'node_sales',
      'config_changes'
    ],
    '年度奖励系统': [
      'yearly_reward_multipliers'
    ]
  };
  
  // 检查每个系统的表
  console.log('\n\n📋 系统表检查:');
  console.log('='.repeat(80));
  
  let totalRequired = 0;
  let totalMissing = 0;
  const missingTables = [];
  
  Object.keys(requiredTables).forEach(system => {
    console.log(`\n${system}:`);
    const tables = requiredTables[system];
    totalRequired += tables.length;
    
    tables.forEach(tableName => {
      const exists = allTables.some(t => t.name === tableName);
      if (exists) {
        console.log(`  ✅ ${tableName}`);
      } else {
        console.log(`  ❌ ${tableName} - 缺失！`);
        totalMissing++;
        missingTables.push({ system, table: tableName });
      }
    });
  });
  
  // 检查视图
  console.log('\n\n📈 数据库视图:');
  console.log('='.repeat(80));
  
  const views = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='view' 
    ORDER BY name
  `).all();
  
  if (views.length > 0) {
    views.forEach((view, index) => {
      console.log(`  ${(index + 1).toString().padStart(2, '0')}. ${view.name}`);
    });
  } else {
    console.log('  ⚠️  没有视图');
  }
  
  // 检查触发器
  console.log('\n\n⚡ 数据库触发器:');
  console.log('='.repeat(80));
  
  const triggers = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='trigger' 
    ORDER BY name
  `).all();
  
  if (triggers.length > 0) {
    triggers.forEach((trigger, index) => {
      console.log(`  ${(index + 1).toString().padStart(2, '0')}. ${trigger.name}`);
    });
  } else {
    console.log('  ⚠️  没有触发器');
  }
  
  // 检查索引
  console.log('\n\n🔍 数据库索引:');
  console.log('='.repeat(80));
  
  const indexes = db.prepare(`
    SELECT name, tbl_name FROM sqlite_master 
    WHERE type='index' AND name NOT LIKE 'sqlite_%'
    ORDER BY tbl_name, name
  `).all();
  
  console.log(`  总计: ${indexes.length} 个索引`);
  
  // 按表分组显示索引
  const indexesByTable = {};
  indexes.forEach(idx => {
    if (!indexesByTable[idx.tbl_name]) {
      indexesByTable[idx.tbl_name] = [];
    }
    indexesByTable[idx.tbl_name].push(idx.name);
  });
  
  Object.keys(indexesByTable).slice(0, 10).forEach(table => {
    console.log(`  ${table}: ${indexesByTable[table].length} 个索引`);
  });
  
  // 检查关键表的字段
  console.log('\n\n🔑 关键表字段检查:');
  console.log('='.repeat(80));
  
  // 检查 users 表
  console.log('\n👤 users 表字段:');
  try {
    const userColumns = db.prepare(`PRAGMA table_info(users)`).all();
    const importantFields = [
      'wallet_address',
      'referrer_id',
      'referral_code',
      'referral_value',
      'referrer_level',
      'swap_mining_bonus'
    ];
    
    importantFields.forEach(field => {
      const exists = userColumns.some(col => col.name === field);
      console.log(`  ${exists ? '✅' : '❌'} ${field}`);
    });
  } catch (e) {
    console.log('  ❌ users 表不存在');
  }
  
  // 检查 referral_relationships 表
  console.log('\n🔗 referral_relationships 表字段:');
  try {
    const refColumns = db.prepare(`PRAGMA table_info(referral_relationships)`).all();
    const importantFields = [
      'referrer_address',
      'referee_address',
      'referral_code',
      'is_confirmed',
      'confirmed_at'
    ];
    
    importantFields.forEach(field => {
      const exists = refColumns.some(col => col.name === field);
      console.log(`  ${exists ? '✅' : '❌'} ${field}`);
    });
  } catch (e) {
    console.log('  ❌ referral_relationships 表不存在');
  }
  
  // 检查 community_members 表
  console.log('\n🏘️ community_members 表字段:');
  try {
    const cmColumns = db.prepare(`PRAGMA table_info(community_members)`).all();
    const importantFields = [
      'community_id',
      'member_address',
      'node_value',
      'is_leader',
      'joined_at',
      'can_leave_at'
    ];
    
    importantFields.forEach(field => {
      const exists = cmColumns.some(col => col.name === field);
      console.log(`  ${exists ? '✅' : '❌'} ${field}`);
    });
  } catch (e) {
    console.log('  ❌ community_members 表不存在');
  }
  
  // 统计数据
  console.log('\n\n📊 数据统计:');
  console.log('='.repeat(80));
  
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    console.log(`  用户数: ${userCount.count}`);
  } catch (e) {
    console.log('  用户数: 无法获取');
  }
  
  try {
    const nodeCount = db.prepare('SELECT COUNT(*) as count FROM nodes').get();
    console.log(`  节点数: ${nodeCount.count}`);
  } catch (e) {
    console.log('  节点数: 无法获取');
  }
  
  try {
    const communityCount = db.prepare('SELECT COUNT(*) as count FROM communities').get();
    console.log(`  社区数: ${communityCount.count}`);
  } catch (e) {
    console.log('  社区数: 无法获取');
  }
  
  try {
    const refCount = db.prepare('SELECT COUNT(*) as count FROM referral_relationships').get();
    console.log(`  推荐关系数: ${refCount.count}`);
  } catch (e) {
    console.log('  推荐关系数: 无法获取');
  }
  
  // 总结
  console.log('\n\n📝 检查总结:');
  console.log('='.repeat(80));
  console.log(`  总表数: ${allTables.length}`);
  console.log(`  视图数: ${views.length}`);
  console.log(`  触发器数: ${triggers.length}`);
  console.log(`  索引数: ${indexes.length}`);
  console.log(`  需要的表: ${totalRequired}`);
  console.log(`  缺失的表: ${totalMissing}`);
  
  if (totalMissing > 0) {
    console.log('\n❌ 缺失的表:');
    missingTables.forEach(item => {
      console.log(`  - ${item.system}: ${item.table}`);
    });
  } else {
    console.log('\n✅ 所有必需的表都存在！');
  }
  
  // 额外的表（不在必需列表中）
  const extraTables = allTables.filter(t => {
    return !Object.values(requiredTables).flat().includes(t.name) &&
           !t.name.startsWith('sqlite_');
  });
  
  if (extraTables.length > 0) {
    console.log('\n📦 额外的表（不在必需列表中）:');
    extraTables.forEach(table => {
      console.log(`  - ${table.name}`);
    });
  }
  
  db.close();
  
  console.log('\n' + '='.repeat(80));
  console.log('🎉 数据库检查完成！');
  
} catch (error) {
  console.error('❌ 错误:', error.message);
  console.error(error);
}
