const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('🔄 初始化 SWAP 交易挖矿数据库...');
console.log('数据库路径:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 无法打开数据库:', err);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 读取 SQL 文件
const sqlPath = path.join(__dirname, '../src/database/init_swap_mining.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// 执行 SQL
db.exec(sql, (err) => {
  if (err) {
    console.error('❌ 执行 SQL 失败:', err);
    db.close();
    process.exit(1);
  }
  
  console.log('✅ SWAP 挖矿表创建成功');
  
  // 验证表是否创建成功
  db.all(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name LIKE '%swap%' OR name = 'users' OR name LIKE '%referral%'
    ORDER BY name
  `, (err, tables) => {
    if (err) {
      console.error('❌ 查询表失败:', err);
    } else {
      console.log('\n📋 已创建的表:');
      tables.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.name}`);
      });
    }
    
    // 查询配置
    db.get('SELECT * FROM swap_mining_config WHERE id = 1', (err, config) => {
      if (err) {
        console.error('❌ 查询配置失败:', err);
      } else {
        console.log('\n⚙️ SWAP 挖矿配置:');
        console.log(`  奖励比例: ${config.reward_rate} EAGLE per USDT`);
        console.log(`  手续费率: ${config.fee_rate * 100}%`);
        console.log(`  EAGLE 价格: $${config.eagle_price_usdt}`);
        console.log(`  状态: ${config.enabled ? '✅ 启用' : '❌ 禁用'}`);
      }
      
      // 查询用户等级
      db.all('SELECT * FROM user_tiers ORDER BY min_volume_usdt', (err, tiers) => {
        if (err) {
          console.error('❌ 查询等级失败:', err);
        } else {
          console.log('\n🏆 用户等级配置:');
          tiers.forEach(tier => {
            console.log(`  ${tier.tier_name}: ${tier.min_volume_usdt}+ USDT (${tier.multiplier}x)`);
          });
        }
        
        // 插入测试数据（可选）
        console.log('\n📝 插入测试数据...');
        
        const testUser = '0x1234567890123456789012345678901234567890';
        
        db.run(`
          INSERT OR IGNORE INTO users (wallet_address) 
          VALUES (?)
        `, [testUser], function(err) {
          if (err) {
            console.error('❌ 插入测试用户失败:', err);
          } else {
            console.log(`✅ 测试用户创建: ${testUser}`);
            
            // 插入测试交易
            const testTx = {
              tx_hash: '0xtest123456789',
              user_address: testUser,
              from_token: 'USDT',
              to_token: 'OKB',
              from_amount: 1000,
              to_amount: 50,
              trade_value_usdt: 1000,
              fee_usdt: 1,
              eagle_reward: 0.3,
              route_info: 'Direct swap'
            };
            
            db.run(`
              INSERT OR IGNORE INTO swap_transactions 
              (tx_hash, user_address, from_token, to_token, from_amount, to_amount, 
               trade_value_usdt, fee_usdt, eagle_reward, route_info)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              testTx.tx_hash,
              testTx.user_address,
              testTx.from_token,
              testTx.to_token,
              testTx.from_amount,
              testTx.to_amount,
              testTx.trade_value_usdt,
              testTx.fee_usdt,
              testTx.eagle_reward,
              testTx.route_info
            ], function(err) {
              if (err) {
                console.error('❌ 插入测试交易失败:', err);
              } else {
                console.log(`✅ 测试交易创建: ${testTx.tx_hash}`);
                console.log(`   交易金额: ${testTx.trade_value_usdt} USDT`);
                console.log(`   手续费: ${testTx.fee_usdt} USDT`);
                console.log(`   获得奖励: ${testTx.eagle_reward} EAGLE`);
              }
              
              // 更新用户统计
              db.run(`
                INSERT OR REPLACE INTO user_swap_stats 
                (user_address, total_trades, total_volume_usdt, total_fee_paid, 
                 total_eagle_earned, first_trade_at, last_trade_at)
                VALUES (?, 1, ?, ?, ?, datetime('now'), datetime('now'))
              `, [testUser, testTx.trade_value_usdt, testTx.fee_usdt, testTx.eagle_reward], (err) => {
                if (err) {
                  console.error('❌ 更新用户统计失败:', err);
                } else {
                  console.log('✅ 用户统计已更新');
                  
                  // 查询用户等级
                  db.get(`
                    SELECT * FROM user_current_tier WHERE wallet_address = ?
                  `, [testUser], (err, userTier) => {
                    if (err) {
                      console.error('❌ 查询用户等级失败:', err);
                    } else {
                      console.log('\n👤 测试用户信息:');
                      console.log(`   地址: ${userTier.wallet_address.substring(0, 10)}...`);
                      console.log(`   累计交易量: ${userTier.total_volume} USDT`);
                      console.log(`   累计奖励: ${userTier.total_eagle} EAGLE`);
                      console.log(`   当前等级: ${userTier.tier_name} (${userTier.multiplier}x)`);
                    }
                    
                    // 统计信息
                    db.get(`
                      SELECT 
                        COUNT(*) as table_count
                      FROM sqlite_master 
                      WHERE type='table' 
                      AND (name LIKE '%swap%' OR name = 'users' OR name LIKE '%referral%')
                    `, (err, stats) => {
                      if (err) {
                        console.error('❌ 统计失败:', err);
                      } else {
                        console.log('\n📊 数据库统计:');
                        console.log(`   创建表数量: ${stats.table_count}`);
                      }
                      
                      db.close((err) => {
                        if (err) {
                          console.error('❌ 关闭数据库失败:', err);
                        } else {
                          console.log('\n✅ 数据库已关闭');
                          console.log('\n🎉 SWAP 交易挖矿数据库初始化完成！');
                        }
                      });
                    });
                  });
                }
              });
            });
          }
        });
      });
    });
  });
});
