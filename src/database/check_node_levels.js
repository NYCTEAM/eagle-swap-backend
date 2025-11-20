const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');

console.log('🔍 检查 node_levels 表结构...\n');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法连接数据库:', err.message);
    process.exit(1);
  }
});

// 1. 检查表是否存在
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%node%' OR name LIKE '%level%'", [], (err, tables) => {
  if (err) {
    console.error('错误:', err.message);
    db.close();
    return;
  }

  console.log('📋 包含 "node" 或 "level" 的表:\n');
  tables.forEach(t => console.log(`   - ${t.name}`));

  if (tables.length === 0) {
    console.log('\n❌ 未找到相关表！');
    db.close();
    return;
  }

  console.log('\n📊 详细表结构:\n');
  
  let completed = 0;
  tables.forEach(table => {
    db.all(`PRAGMA table_info(${table.name})`, [], (err, columns) => {
      completed++;
      
      if (err) {
        console.log(`❌ ${table.name}: ${err.message}`);
      } else {
        console.log(`\n🔹 ${table.name}:`);
        columns.forEach(col => {
          const pk = col.pk ? ' [PRIMARY KEY]' : '';
          const notnull = col.notnull ? ' NOT NULL' : '';
          const def = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
          console.log(`   ${col.name} (${col.type}${notnull}${def}${pk})`);
        });
        
        // 显示示例数据
        db.all(`SELECT * FROM ${table.name} LIMIT 2`, [], (err, rows) => {
          if (!err && rows.length > 0) {
            console.log(`\n   示例数据 (${rows.length} 行):`);
            console.table(rows);
          }
        });
      }
      
      if (completed === tables.length) {
        setTimeout(() => {
          db.close();
          console.log('\n✅ 检查完成\n');
        }, 1000);
      }
    });
  });
});
