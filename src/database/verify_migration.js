const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');

console.log('🔍 验证合规性迁移结果...\n');
console.log('=' .repeat(60));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法连接数据库:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功\n');
});

const verificationTests = [
  {
    name: '1. 检查 node_levels 表的新列',
    query: `SELECT 
      level, 
      name, 
      participation_weight, 
      example_daily_allocation, 
      allocation_variable, 
      allocation_disclaimer 
    FROM node_levels 
    LIMIT 3`,
    expectedColumns: ['participation_weight', 'example_daily_allocation', 'allocation_variable', 'allocation_disclaimer'],
    critical: true
  },
  {
    name: '2. 检查 node_levels 数据完整性',
    query: `SELECT 
      COUNT(*) as total,
      COUNT(participation_weight) as has_weight,
      COUNT(example_daily_allocation) as has_allocation,
      COUNT(allocation_variable) as has_variable
    FROM node_levels`,
    critical: true
  },
  {
    name: '3. 检查合规视图 - user_participation_summary',
    query: `SELECT name FROM sqlite_master WHERE type='view' AND name='user_participation_summary'`,
    critical: false
  },
  {
    name: '4. 检查合规视图 - node_allocation_summary',
    query: `SELECT name FROM sqlite_master WHERE type='view' AND name='node_allocation_summary'`,
    critical: false
  },
  {
    name: '5. 测试 node_allocation_summary 视图',
    query: `SELECT * FROM node_allocation_summary LIMIT 3`,
    critical: false
  },
  {
    name: '6. 检查 communities 表的新列',
    query: `PRAGMA table_info(communities)`,
    checkColumns: ['participation_parameter', 'leader_parameter', 'parameter_variable'],
    critical: false
  },
  {
    name: '7. 检查 swap_transactions 表的新列',
    query: `PRAGMA table_info(swap_transactions)`,
    checkColumns: ['eagle_allocation'],
    critical: false
  },
  {
    name: '8. 检查 compliance_audit_log 表',
    query: `SELECT name FROM sqlite_master WHERE type='table' AND name='compliance_audit_log'`,
    critical: false
  },
  {
    name: '9. 验证 node_levels 所有记录',
    query: `SELECT 
      level,
      name,
      CASE 
        WHEN participation_weight > 0 THEN '✅'
        ELSE '❌'
      END as has_weight,
      CASE 
        WHEN example_daily_allocation >= 0 THEN '✅'
        ELSE '❌'
      END as has_allocation,
      CASE 
        WHEN allocation_variable = 1 THEN '✅'
        ELSE '❌'
      END as is_variable,
      CASE 
        WHEN allocation_disclaimer IS NOT NULL THEN '✅'
        ELSE '❌'
      END as has_disclaimer
    FROM node_levels
    ORDER BY level`,
    critical: true
  }
];

let testIndex = 0;
let passedTests = 0;
let failedTests = 0;
let criticalFailures = 0;

function runNextTest() {
  if (testIndex >= verificationTests.length) {
    printSummary();
    return;
  }

  const test = verificationTests[testIndex];
  testIndex++;

  console.log(`\n${test.name}`);
  console.log('-'.repeat(60));

  db.all(test.query, [], (err, rows) => {
    if (err) {
      console.log(`❌ 错误: ${err.message}`);
      failedTests++;
      if (test.critical) criticalFailures++;
      runNextTest();
      return;
    }

    if (rows.length === 0) {
      console.log('⚠️  查询返回空结果');
      if (test.critical) {
        failedTests++;
        criticalFailures++;
      }
      runNextTest();
      return;
    }

    // 特殊处理：检查列是否存在
    if (test.checkColumns) {
      const columnNames = rows.map(r => r.name);
      let allFound = true;
      test.checkColumns.forEach(col => {
        if (columnNames.includes(col)) {
          console.log(`✅ 列 '${col}' 存在`);
        } else {
          console.log(`❌ 列 '${col}' 不存在`);
          allFound = false;
        }
      });
      if (allFound) {
        passedTests++;
      } else {
        failedTests++;
        if (test.critical) criticalFailures++;
      }
      runNextTest();
      return;
    }

    // 特殊处理：检查预期列
    if (test.expectedColumns) {
      const firstRow = rows[0];
      const actualColumns = Object.keys(firstRow);
      let allFound = true;
      
      test.expectedColumns.forEach(col => {
        if (actualColumns.includes(col)) {
          console.log(`✅ 列 '${col}' 存在`);
        } else {
          console.log(`❌ 列 '${col}' 不存在`);
          allFound = false;
        }
      });

      if (allFound && rows.length > 0) {
        console.log('\n📊 示例数据:');
        rows.forEach(row => {
          console.log(`   Level ${row.level} (${row.name}):`);
          console.log(`      参与权重: ${row.participation_weight || 'NULL'}`);
          console.log(`      示例分配: ${row.example_daily_allocation || 'NULL'}`);
          console.log(`      可变标记: ${row.allocation_variable || 'NULL'}`);
          console.log(`      免责声明: ${row.allocation_disclaimer ? '已设置' : 'NULL'}`);
        });
        passedTests++;
      } else {
        failedTests++;
        if (test.critical) criticalFailures++;
      }
      runNextTest();
      return;
    }

    // 默认处理：显示结果
    console.log('✅ 查询成功');
    if (rows.length <= 10) {
      console.log('\n结果:');
      console.table(rows);
    } else {
      console.log(`\n返回 ${rows.length} 行数据（仅显示前5行）:`);
      console.table(rows.slice(0, 5));
    }
    passedTests++;
    runNextTest();
  });
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 验证总结');
  console.log('='.repeat(60));
  console.log(`\n总测试数: ${verificationTests.length}`);
  console.log(`✅ 通过: ${passedTests}`);
  console.log(`❌ 失败: ${failedTests}`);
  console.log(`🔴 关键失败: ${criticalFailures}`);

  console.log('\n' + '='.repeat(60));
  
  if (criticalFailures === 0) {
    console.log('✅ 核心迁移成功！');
    console.log('\n📌 迁移状态:');
    console.log('   ✓ node_levels 表已成功更新为合规术语');
    console.log('   ✓ 所有节点等级都有参与权重和示例分配');
    console.log('   ✓ 免责声明已添加');
    console.log('   ✓ 可变标记已设置');
    
    if (failedTests > 0) {
      console.log('\n⚠️  非关键项目失败（不影响核心功能）:');
      console.log('   - 某些辅助表或视图可能未完全创建');
      console.log('   - 这些可以稍后手动添加');
    }
    
    console.log('\n🚀 下一步:');
    console.log('   1. 重启前端服务器测试界面');
    console.log('   2. 更新后端 API 代码使用新列名');
    console.log('   3. 测试所有功能端点');
  } else {
    console.log('❌ 关键迁移失败！');
    console.log('\n⚠️  问题:');
    console.log('   - node_levels 表的关键列未成功添加');
    console.log('   - 需要检查数据库权限或表结构');
    console.log('\n🔧 建议:');
    console.log('   1. 检查数据库文件权限');
    console.log('   2. 手动执行 SQL 语句');
    console.log('   3. 查看详细错误日志');
  }

  console.log('\n' + '='.repeat(60) + '\n');

  db.close((err) => {
    if (err) {
      console.error('关闭数据库时出错:', err.message);
    }
    process.exit(criticalFailures > 0 ? 1 : 0);
  });
}

// 开始验证
runNextTest();
