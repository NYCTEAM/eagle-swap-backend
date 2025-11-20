const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');
const sqlPath = path.join(__dirname, '../src/database/init_node_levels.sql');

console.log('📊 初始化节点等级数据...');
console.log('数据库路径:', dbPath);
console.log('SQL 文件路径:', sqlPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 无法打开数据库:', err);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

const sql = fs.readFileSync(sqlPath, 'utf8');

db.exec(sql, (err) => {
  if (err) {
    console.error('❌ 执行 SQL 失败:', err);
    db.close();
    process.exit(1);
  }
  
  console.log('\n✅ 节点等级数据初始化成功！\n');
  
  // 验证数据
  db.all('SELECT * FROM node_levels ORDER BY id', (err, rows) => {
    if (err) {
      console.error('❌ 查询失败:', err);
    } else {
      console.log('📋 节点等级配置:');
      console.table(rows);
    }
    
    // 查询阶段配置
    db.all(`
      SELECT 
        nl.name,
        nls.stage,
        nls.stage_supply,
        nls.difficulty_multiplier,
        ROUND(nl.daily_reward_base * nls.difficulty_multiplier, 2) as daily_reward
      FROM node_levels nl
      JOIN node_level_stages nls ON nl.id = nls.level_id
      ORDER BY nl.id, nls.stage
      LIMIT 10
    `, (err, stageRows) => {
      if (err) {
        console.error('❌ 查询阶段失败:', err);
      } else {
        console.log('\n📋 阶段配置示例（前10条）:');
        console.table(stageRows);
      }
      
      // 总计统计
      db.get(`
        SELECT 
          SUM(max_supply) as total_nodes,
          SUM(price_usdt * max_supply) as total_raised
        FROM node_levels
      `, (err, total) => {
        if (err) {
          console.error('❌ 统计失败:', err);
        } else {
          console.log('\n📊 总计统计:');
          console.log(`  总节点数: ${total.total_nodes}`);
          console.log(`  总筹集: $${total.total_raised} USDT`);
        }
        
        db.close((err) => {
          if (err) {
            console.error('❌ 关闭数据库失败:', err);
          } else {
            console.log('\n✅ 数据库已关闭');
            console.log('\n🎉 所有操作完成！');
          }
        });
      });
    });
  });
});
