const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/eagle-swap.db');

console.log('=== 检查数据库结构 ===\n');

// 1. 检查 swap_transactions 表结构
console.log('1. swap_transactions 表结构:');
db.all("PRAGMA table_info(swap_transactions)", [], (err, columns) => {
  if (err) {
    console.error('错误:', err);
    return;
  }
  
  console.log('字段列表:');
  columns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  const hasChainId = columns.some(col => col.name === 'chain_id');
  console.log(`\n✓ chain_id 字段: ${hasChainId ? '✅ 已存在' : '❌ 不存在'}\n`);
  
  // 2. 检查 supported_chains 表
  console.log('2. 检查 supported_chains 表:');
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='supported_chains'", [], (err, tables) => {
    if (err) {
      console.error('错误:', err);
      return;
    }
    
    if (tables.length > 0) {
      console.log('✅ supported_chains 表已存在\n');
      
      // 查询支持的链
      db.all("SELECT chain_id, chain_name, enabled FROM supported_chains ORDER BY chain_id", [], (err, chains) => {
        if (err) {
          console.error('错误:', err);
          return;
        }
        
        console.log('支持的链:');
        chains.forEach(chain => {
          console.log(`  - [${chain.chain_id}] ${chain.chain_name} ${chain.enabled ? '✅' : '❌'}`);
        });
        
        checkViews();
      });
    } else {
      console.log('❌ supported_chains 表不存在\n');
      checkViews();
    }
  });
});

function checkViews() {
  // 3. 检查视图
  console.log('\n3. 检查多链统计视图:');
  db.all("SELECT name FROM sqlite_master WHERE type='view' AND name LIKE '%multichain%' OR name LIKE '%chain%'", [], (err, views) => {
    if (err) {
      console.error('错误:', err);
      db.close();
      return;
    }
    
    if (views.length > 0) {
      console.log('已创建的视图:');
      views.forEach(view => {
        console.log(`  ✅ ${view.name}`);
      });
    } else {
      console.log('❌ 没有找到多链相关视图');
    }
    
    checkIndexes();
  });
}

function checkIndexes() {
  // 4. 检查索引
  console.log('\n4. 检查索引:');
  db.all("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%chain%'", [], (err, indexes) => {
    if (err) {
      console.error('错误:', err);
      db.close();
      return;
    }
    
    if (indexes.length > 0) {
      console.log('已创建的索引:');
      indexes.forEach(idx => {
        console.log(`  ✅ ${idx.name}`);
      });
    } else {
      console.log('❌ 没有找到链相关索引');
    }
    
    checkData();
  });
}

function checkData() {
  // 5. 检查数据
  console.log('\n5. 检查现有数据:');
  db.get("SELECT COUNT(*) as count FROM swap_transactions", [], (err, result) => {
    if (err) {
      console.error('错误:', err);
      db.close();
      return;
    }
    
    console.log(`总交易记录: ${result.count} 条`);
    
    if (result.count > 0) {
      db.all("SELECT DISTINCT COALESCE(chain_id, 196) as chain_id, COUNT(*) as count FROM swap_transactions GROUP BY COALESCE(chain_id, 196)", [], (err, chains) => {
        if (err) {
          console.error('错误:', err);
        } else {
          console.log('\n各链交易分布:');
          chains.forEach(chain => {
            console.log(`  Chain ${chain.chain_id}: ${chain.count} 条`);
          });
        }
        
        console.log('\n=== 检查完成 ===');
        db.close();
      });
    } else {
      console.log('\n=== 检查完成 ===');
      db.close();
    }
  });
}
