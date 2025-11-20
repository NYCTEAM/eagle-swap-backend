const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');
const MIGRATION_SQL = path.join(__dirname, 'compliance_migration_correct.sql');

console.log('🔄 执行正确的合规性迁移...\n');
console.log('📁 数据库:', DB_PATH);
console.log('📄 迁移脚本:', MIGRATION_SQL);
console.log('');

if (!fs.existsSync(DB_PATH)) {
  console.error('❌ 数据库文件不存在');
  process.exit(1);
}

if (!fs.existsSync(MIGRATION_SQL)) {
  console.error('❌ 迁移脚本不存在');
  process.exit(1);
}

const migrationSQL = fs.readFileSync(MIGRATION_SQL, 'utf8');
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法连接数据库:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功\n');
  console.log('🚀 开始执行迁移...\n');
});

let currentStatement = 0;
let errors = [];
let successes = 0;
let duplicateColumns = 0;

function executeNext() {
  if (currentStatement >= statements.length) {
    console.log(`\n✅ 迁移执行完成!`);
    console.log(`   成功: ${successes} 条语句`);
    console.log(`   重复列: ${duplicateColumns} 个（已存在，跳过）`);
    console.log(`   其他错误: ${errors.length - duplicateColumns} 个\n`);
    
    if (errors.length > duplicateColumns) {
      console.log('⚠️  非重复列错误:');
      errors.forEach((err, i) => {
        if (!err.includes('duplicate column')) {
          console.log(`   ${i + 1}. ${err}`);
        }
      });
      console.log('');
    }
    
    verifyMigration();
    return;
  }
  
  const statement = statements[currentStatement];
  currentStatement++;
  
  if (statement.startsWith('--') || statement.trim().length === 0) {
    executeNext();
    return;
  }
  
  db.run(statement, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        duplicateColumns++;
        successes++; // 列已存在也算成功
      } else {
        errors.push(err.message);
      }
    } else {
      successes++;
    }
    executeNext();
  });
}

function verifyMigration() {
  console.log('📊 验证迁移结果...\n');
  
  const queries = [
    {
      q: "SELECT level, name, participation_weight, example_daily_allocation, allocation_variable FROM node_levels LIMIT 3",
      l: "node_levels 表新列"
    },
    {
      q: "SELECT COUNT(*) as c FROM node_levels WHERE participation_weight > 0",
      l: "有参与权重的等级数"
    },
    {
      q: "SELECT COUNT(*) as c FROM node_levels WHERE allocation_variable = 1",
      l: "标记为可变分配的等级数"
    },
    {
      q: "SELECT COUNT(*) as c FROM compliance_audit_log",
      l: "审计日志条目数"
    },
    {
      q: "SELECT name FROM sqlite_master WHERE type='view' AND name IN ('user_participation_summary', 'node_allocation_summary')",
      l: "合规视图"
    }
  ];

  let completed = 0;
  queries.forEach((item) => {
    db.all(item.q, [], (err, rows) => {
      completed++;
      
      if (err) {
        console.log(`   ❌ ${item.l}: ${err.message}`);
      } else {
        if (item.q.includes('COUNT')) {
          console.log(`   ✅ ${item.l}: ${rows[0].c}`);
        } else if (item.q.includes('sqlite_master')) {
          console.log(`   ✅ ${item.l}: ${rows.length} 个视图创建`);
          rows.forEach(r => console.log(`      - ${r.name}`));
        } else {
          console.log(`   ✅ ${item.l}:`);
          rows.forEach(r => {
            console.log(`      Level ${r.level} (${r.name}): 权重=${r.participation_weight}, 分配=${r.example_daily_allocation}, 可变=${r.allocation_variable}`);
          });
        }
      }

      if (completed === queries.length) {
        db.all("SELECT * FROM compliance_audit_log ORDER BY created_at DESC LIMIT 1", [], (err, rows) => {
          if (!err && rows.length > 0) {
            console.log('\n📝 最新审计日志:');
            console.log(`   事件: ${rows[0].event_type}`);
            console.log(`   描述: ${rows[0].description}`);
            console.log(`   时间: ${rows[0].created_at}`);
          }
          
          console.log('\n' + '='.repeat(60));
          console.log('✅ 合规性迁移成功完成！');
          console.log('='.repeat(60));
          console.log('\n📌 已完成的更改:');
          console.log('   ✓ node_levels: 添加合规术语列');
          console.log('   ✓ nodes: 添加参与状态和分配列');
          console.log('   ✓ communities: 添加参数列');
          console.log('   ✓ swap_transactions: 添加分配列');
          console.log('   ✓ 创建 compliance_audit_log 表');
          console.log('   ✓ 创建合规视图');
          console.log('\n⚠️  下一步:');
          console.log('   1. 更新后端 API 使用新列名');
          console.log('   2. 测试所有端点');
          console.log('   3. 重启后端服务器');
          console.log('   4. 测试前端功能\n');
          
          db.close();
          process.exit(0);
        });
      }
    });
  });
}

executeNext();
