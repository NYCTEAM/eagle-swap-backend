const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('📊 初始化年度奖励数据...');
console.log('数据库路径:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 无法打开数据库:', err);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 7个等级的基础奖励（第1年阶段1）
const nodeLevels = [
  { id: 1, name: 'Micro', baseRewards: [0.27, 0.243, 0.220, 0.189, 0.162] },
  { id: 2, name: 'Mini', baseRewards: [0.82, 0.738, 0.656, 0.574, 0.492] },
  { id: 3, name: 'Bronze', baseRewards: [1.36, 1.224, 1.088, 0.952, 0.816] },
  { id: 4, name: 'Silver', baseRewards: [2.72, 2.448, 2.176, 1.904, 1.632] },
  { id: 5, name: 'Gold', baseRewards: [8.15, 7.335, 6.520, 5.705, 4.890] },
  { id: 6, name: 'Platinum', baseRewards: [19.02, 17.118, 15.216, 13.314, 11.412] },
  { id: 7, name: 'Diamond', baseRewards: [40.76, 36.684, 32.608, 28.532, 24.456] }
];

// 年度系数
const yearMultipliers = [
  { year: 1, multiplier: 1.000 },
  { year: 2, multiplier: 0.750 },
  { year: 3, multiplier: 0.675 },
  { year: 4, multiplier: 0.608 },
  { year: 5, multiplier: 0.547 },
  { year: 6, multiplier: 0.492 },
  { year: 7, multiplier: 0.443 },
  { year: 8, multiplier: 0.399 },
  { year: 9, multiplier: 0.359 },
  { year: 10, multiplier: 0.323 }
];

// 先创建表结构
const schemaPath = path.join(__dirname, '../src/database/init_yearly_rewards_schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

db.exec(schemaSql, (err) => {
  if (err) {
    console.error('❌ 创建表结构失败:', err);
    db.close();
    process.exit(1);
  }
  
  console.log('✅ 表结构创建成功');
  
  // 生成并插入所有奖励数据
  const insertPromises = [];
  let totalRecords = 0;
  
  console.log('\n📝 开始插入年度奖励数据...');
  
  nodeLevels.forEach(level => {
    yearMultipliers.forEach(({ year, multiplier }) => {
      level.baseRewards.forEach((baseReward, index) => {
        const stage = index + 1;
        const dailyReward = parseFloat((baseReward * multiplier).toFixed(3));
        
        const promise = new Promise((resolve, reject) => {
          db.run(
            `INSERT OR REPLACE INTO yearly_rewards (year, level_id, stage, daily_reward, year_multiplier) 
             VALUES (?, ?, ?, ?, ?)`,
            [year, level.id, stage, dailyReward, multiplier],
            (err) => {
              if (err) reject(err);
              else {
                totalRecords++;
                if (totalRecords % 50 === 0) {
                  process.stdout.write(`\r  已插入 ${totalRecords} 条记录...`);
                }
                resolve();
              }
            }
          );
        });
        
        insertPromises.push(promise);
      });
    });
  });
  
  // 等待所有插入完成
  Promise.all(insertPromises)
    .then(() => {
      console.log(`\n✅ 成功插入 ${totalRecords} 条年度奖励记录！`);
      console.log(`   (7个等级 × 10年 × 5阶段 = 350条记录)\n`);
      
      // 验证数据
      db.all(`
        SELECT 
          yr.year,
          nl.name as level_name,
          yr.stage,
          yr.daily_reward,
          yr.year_multiplier
        FROM yearly_rewards yr
        JOIN node_levels nl ON yr.level_id = nl.id
        WHERE yr.year IN (1, 5, 10) AND yr.stage IN (1, 5)
        ORDER BY yr.year, nl.id, yr.stage
        LIMIT 20
      `, (err, rows) => {
        if (err) {
          console.error('❌ 查询验证失败:', err);
        } else {
          console.log('📋 数据验证示例（前20条）:');
          console.table(rows);
        }
        
        // 统计信息
        db.get(`
          SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT year) as total_years,
            COUNT(DISTINCT level_id) as total_levels,
            COUNT(DISTINCT stage) as total_stages
          FROM yearly_rewards
        `, (err, stats) => {
          if (err) {
            console.error('❌ 统计失败:', err);
          } else {
            console.log('\n📊 数据统计:');
            console.log(`  总记录数: ${stats.total_records}`);
            console.log(`  年份数: ${stats.total_years}`);
            console.log(`  等级数: ${stats.total_levels}`);
            console.log(`  阶段数: ${stats.total_stages}`);
          }
          
          db.close((err) => {
            if (err) {
              console.error('❌ 关闭数据库失败:', err);
            } else {
              console.log('\n✅ 数据库已关闭');
              console.log('\n🎉 年度奖励数据初始化完成！');
            }
          });
        });
      });
    })
    .catch(err => {
      console.error('\n❌ 插入数据失败:', err);
      db.close();
      process.exit(1);
    });
});
