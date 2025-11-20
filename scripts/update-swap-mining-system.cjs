const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');
const migrationPath = path.join(__dirname, '../migrations/update_swap_mining_system.sql');

console.log('更新 Swap 挖矿系统...');
console.log('数据库路径:', dbPath);
console.log('迁移文件:', migrationPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('无法打开数据库:', err);
    process.exit(1);
  }
  console.log('✓ 数据库连接成功\n');
});

// 读取并执行 SQL
const sql = fs.readFileSync(migrationPath, 'utf8');

db.exec(sql, (err) => {
  if (err) {
    console.error('✗ SQL 执行失败:', err);
    db.close();
    process.exit(1);
  }
  
  console.log('✓ SQL 执行成功\n');
  
  // 验证 VIP 等级
  db.all('SELECT * FROM vip_levels ORDER BY vip_level', (err, vipRows) => {
    if (err) {
      console.error('✗ 查询 VIP 等级失败:', err);
      db.close();
      return;
    }
    
    console.log('='.repeat(100));
    console.log('VIP 等级系统（基于累计交易量）');
    console.log('='.repeat(100));
    console.log('VIP Level | Name   | Min Volume  | Max Volume  | Boost | Description');
    console.log('-'.repeat(100));
    vipRows.forEach(row => {
      const maxVol = row.max_volume_usdt ? `$${row.max_volume_usdt.toLocaleString()}` : 'No Limit';
      console.log(
        `   ${row.vip_level}      | ${row.vip_name.padEnd(6)} | $${row.min_volume_usdt.toLocaleString().padEnd(10)} | ${maxVol.padEnd(11)} | ${row.boost_percentage}%  | ${row.description}`
      );
    });
    console.log('='.repeat(100));
    
    // 验证 NFT 加成
    db.all('SELECT * FROM nft_level_bonus ORDER BY nft_level', (err, nftRows) => {
      if (err) {
        console.error('✗ 查询 NFT 加成失败:', err);
        db.close();
        return;
      }
      
      console.log('\n' + '='.repeat(100));
      console.log('NFT 等级加成系统（持有最高等级 NFT）');
      console.log('='.repeat(100));
      console.log('NFT Level | Tier Name  | Bonus | Description');
      console.log('-'.repeat(100));
      nftRows.forEach(row => {
        console.log(
          `    ${row.nft_level}     | ${row.nft_tier_name.padEnd(10)} | +${row.bonus_percentage}%  | ${row.description}`
        );
      });
      console.log('='.repeat(100));
      
      // 查看配置
      db.get('SELECT * FROM swap_mining_config WHERE id = 1', (err, config) => {
        if (err) {
          console.error('✗ 查询配置失败:', err);
        } else {
          console.log('\n' + '='.repeat(100));
          console.log('Swap 挖矿基础配置');
          console.log('='.repeat(100));
          console.log(`基础奖励率: ${config.base_rate} EAGLE per ${config.base_amount_usdt} USDT`);
          console.log(`状态: ${config.enabled ? '启用' : '禁用'}`);
          console.log('='.repeat(100));
        }
        
        // 显示计算示例
        console.log('\n' + '='.repeat(100));
        console.log('奖励计算示例（100 USDT 交易）');
        console.log('='.repeat(100));
        console.log('VIP | NFT Tier | VIP Boost | NFT Bonus | Total Boost | EAGLE Reward');
        console.log('-'.repeat(100));
        
        db.all('SELECT * FROM swap_mining_calculation_example WHERE vip_level IN (0, 2, 5) AND nft_level IN (1, 4, 7) ORDER BY vip_level, nft_level', (err, examples) => {
          if (err) {
            console.error('✗ 查询示例失败:', err);
          } else {
            examples.forEach(ex => {
              console.log(
                ` ${ex.vip_level}  | ${ex.nft_tier_name.padEnd(8)} |   ${ex.vip_boost}%    |   +${ex.nft_bonus}%    |    ${ex.total_boost}%    | ${ex.eagle_per_100_usdt.toFixed(4)} EAGLE`
              );
            });
          }
          
          console.log('='.repeat(100));
          console.log('\n说明：');
          console.log('- 总加成 = VIP 加成 + NFT 加成');
          console.log('- 奖励 = 基础奖励 × 总加成 / 100');
          console.log('- VIP 等级根据累计交易量自动升级');
          console.log('- NFT 加成取持有的最高等级 NFT（不叠加）');
          console.log('- 最高加成: VIP5 (300%) + Diamond NFT (+100%) = 400% = 0.012 EAGLE/100 USDT\n');
          
          db.close((err) => {
            if (err) {
              console.error('✗ 关闭数据库失败:', err);
            } else {
              console.log('✓ 数据库连接已关闭');
            }
          });
        });
      });
    });
  });
});
