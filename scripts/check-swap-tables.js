const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('📊 检查 SWAP 挖矿数据库配置...\n');
console.log('='.repeat(80));

try {
  const db = new Database(dbPath);
  
  // 1. 检查 SWAP 相关的表
  console.log('\n📋 SWAP 相关表:');
  console.log('='.repeat(80));
  
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name LIKE '%swap%'
    ORDER BY name
  `).all();
  
  if (tables.length > 0) {
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.name}`);
    });
  } else {
    console.log('  ❌ 没有找到 SWAP 相关的表！');
  }
  
  // 2. 检查 swap_transactions 表结构
  console.log('\n📊 swap_transactions 表结构:');
  console.log('='.repeat(80));
  
  try {
    const swapTxColumns = db.prepare(`PRAGMA table_info(swap_transactions)`).all();
    console.table(swapTxColumns.map(col => ({
      '字段名': col.name,
      '类型': col.type,
      '非空': col.notnull ? '是' : '否',
      '默认值': col.dflt_value || '-'
    })));
  } catch (e) {
    console.log('  ❌ swap_transactions 表不存在');
  }
  
  // 3. 检查 swap_rewards 表结构
  console.log('\n💰 swap_rewards 表结构:');
  console.log('='.repeat(80));
  
  try {
    const swapRewardsColumns = db.prepare(`PRAGMA table_info(swap_rewards)`).all();
    console.table(swapRewardsColumns.map(col => ({
      '字段名': col.name,
      '类型': col.type,
      '非空': col.notnull ? '是' : '否',
      '默认值': col.dflt_value || '-'
    })));
  } catch (e) {
    console.log('  ❌ swap_rewards 表不存在');
  }
  
  // 4. 检查是否有 SWAP 挖矿配置
  console.log('\n⚙️ SWAP 挖矿配置:');
  console.log('='.repeat(80));
  
  try {
    const swapConfig = db.prepare(`
      SELECT * FROM system_config 
      WHERE key LIKE '%swap%' OR key LIKE '%mining%'
    `).all();
    
    if (swapConfig.length > 0) {
      console.table(swapConfig.map(c => ({
        '配置项': c.key,
        '值': c.value,
        '说明': c.description
      })));
    } else {
      console.log('  ⚠️  system_config 表中没有 SWAP 挖矿配置');
    }
  } catch (e) {
    console.log('  ❌ system_config 表不存在');
  }
  
  // 5. 检查推荐人等级配置（用于 SWAP 挖矿加成）
  console.log('\n🎖️ 推荐人等级配置（SWAP 挖矿加成）:');
  console.log('='.repeat(80));
  
  try {
    const referrerLevels = db.prepare(`
      SELECT * FROM referrer_level_config ORDER BY level
    `).all();
    
    if (referrerLevels.length > 0) {
      console.table(referrerLevels.map(l => ({
        '等级': l.level,
        '名称': l.level_name,
        '最小价值': '$' + l.min_value,
        'SWAP加成': (l.swap_mining_bonus * 100) + '%',
        '图标': l.icon
      })));
    } else {
      console.log('  ⚠️  没有推荐人等级配置');
    }
  } catch (e) {
    console.log('  ❌ referrer_level_config 表不存在');
  }
  
  // 6. 检查 users 表中的 SWAP 相关字段
  console.log('\n👤 users 表中的 SWAP 相关字段:');
  console.log('='.repeat(80));
  
  try {
    const userColumns = db.prepare(`PRAGMA table_info(users)`).all();
    const swapRelatedColumns = userColumns.filter(col => 
      col.name.includes('swap') || 
      col.name.includes('referral') || 
      col.name.includes('referrer')
    );
    
    if (swapRelatedColumns.length > 0) {
      console.table(swapRelatedColumns.map(col => ({
        '字段名': col.name,
        '类型': col.type,
        '默认值': col.dflt_value || '-'
      })));
    } else {
      console.log('  ⚠️  users 表中没有 SWAP 相关字段');
    }
  } catch (e) {
    console.log('  ❌ users 表不存在');
  }
  
  // 7. 总结检查结果
  console.log('\n📝 SWAP 挖矿系统检查总结:');
  console.log('='.repeat(80));
  
  const checks = {
    'swap_transactions 表': false,
    'swap_rewards 表': false,
    'referrer_level_config 表': false,
    'SWAP 挖矿配置': false,
    'users 表 SWAP 字段': false
  };
  
  try {
    db.prepare(`SELECT 1 FROM swap_transactions LIMIT 1`).get();
    checks['swap_transactions 表'] = true;
  } catch (e) {}
  
  try {
    db.prepare(`SELECT 1 FROM swap_rewards LIMIT 1`).get();
    checks['swap_rewards 表'] = true;
  } catch (e) {}
  
  try {
    const levels = db.prepare(`SELECT COUNT(*) as count FROM referrer_level_config`).get();
    checks['referrer_level_config 表'] = levels.count > 0;
  } catch (e) {}
  
  try {
    const config = db.prepare(`SELECT COUNT(*) as count FROM system_config WHERE key LIKE '%swap%'`).get();
    checks['SWAP 挖矿配置'] = config.count > 0;
  } catch (e) {}
  
  try {
    const userCols = db.prepare(`PRAGMA table_info(users)`).all();
    checks['users 表 SWAP 字段'] = userCols.some(col => col.name === 'swap_mining_bonus');
  } catch (e) {}
  
  Object.keys(checks).forEach(key => {
    const status = checks[key] ? '✅' : '❌';
    console.log(`  ${status} ${key}`);
  });
  
  const allComplete = Object.values(checks).every(v => v);
  
  console.log('\n' + '='.repeat(80));
  if (allComplete) {
    console.log('🎉 SWAP 挖矿系统配置完整！');
  } else {
    console.log('⚠️  SWAP 挖矿系统配置不完整，需要补充！');
  }
  
  db.close();
  
} catch (error) {
  console.error('❌ 错误:', error.message);
}
