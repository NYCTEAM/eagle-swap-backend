const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');
const SQL_FILE = path.join(__dirname, 'update_swap_mining_nft_bonus.sql');

console.log('\n' + '='.repeat(80));
console.log('🔄 更新 SWAP 挖矿 NFT 加成系统');
console.log('='.repeat(80) + '\n');

const sql = fs.readFileSync(SQL_FILE, 'utf8');
const db = new sqlite3.Database(DB_PATH);

db.exec(sql, (err) => {
  if (err) {
    console.error('❌ 错误:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('✅ 数据库更新成功！\n');
  console.log('📊 验证配置:\n');

  // 查询配置
  db.get(`
    SELECT 
      reward_rate,
      nft_bonus_enabled,
      nft_bonus_multiplier,
      compliance_disclaimer
    FROM swap_mining_config 
    WHERE id = 1
  `, [], (err, config) => {
    if (err) {
      console.error('错误:', err.message);
      db.close();
      return;
    }

    console.log('⚙️  当前配置:');
    console.log(`   基础奖励率: ${config.reward_rate} EAGLE/USDT`);
    console.log(`   NFT 加成启用: ${config.nft_bonus_enabled ? '是' : '否'}`);
    console.log(`   加成倍数: 权重 × ${config.nft_bonus_multiplier}`);
    console.log(`   合规声明: ${config.compliance_disclaimer}\n`);

    // 查询各等级加成
    db.all(`
      SELECT 
        name,
        power as weight,
        (power * 10) as bonus_percent,
        (0.0003 * (1 + power * 10 / 100)) as final_rate
      FROM node_levels
      ORDER BY id
    `, [], (err, levels) => {
      if (err) {
        console.error('错误:', err.message);
        db.close();
        return;
      }

      console.log('📊 各等级 SWAP 挖矿奖励率:\n');
      console.log('┌────────────────┬────────┬──────────┬──────────────┬──────────┐');
      console.log('│ 等级           │ 权重   │ 加成%    │ 最终奖励率   │ 倍数     │');
      console.log('├────────────────┼────────┼──────────┼──────────────┼──────────┤');
      
      levels.forEach(level => {
        const multiplier = (1 + level.bonus_percent / 100).toFixed(2);
        console.log(
          `│ ${level.name.padEnd(14)} │ ` +
          `${String(level.weight).padEnd(6)} │ ` +
          `${('+' + level.bonus_percent + '%').padEnd(8)} │ ` +
          `${level.final_rate.toFixed(6).padEnd(12)} │ ` +
          `${(multiplier + 'x').padEnd(8)} │`
        );
      });
      
      console.log('└────────────────┴────────┴──────────┴──────────────┴──────────┘\n');

      console.log('💰 交易示例（交易 100 USDT）:\n');
      console.log('┌────────────────┬──────────────┬──────────────┐');
      console.log('│ 等级           │ 获得 EAGLE   │ 对比无 NFT   │');
      console.log('├────────────────┼──────────────┼──────────────┤');
      
      const baseReward = 100 * 0.0003;
      levels.forEach(level => {
        const reward = 100 * level.final_rate;
        const diff = reward - baseReward;
        console.log(
          `│ ${level.name.padEnd(14)} │ ` +
          `${reward.toFixed(4).padEnd(12)} │ ` +
          `${(diff > 0 ? '+' + diff.toFixed(4) : '-').padEnd(12)} │`
        );
      });
      
      console.log('└────────────────┴──────────────┴──────────────┘\n');

      console.log('💰 交易示例（交易 10,000 USDT）:\n');
      console.log('┌────────────────┬──────────────┬──────────────┐');
      console.log('│ 等级           │ 获得 EAGLE   │ 对比无 NFT   │');
      console.log('├────────────────┼──────────────┼──────────────┤');
      
      const baseReward2 = 10000 * 0.0003;
      levels.forEach(level => {
        const reward = 10000 * level.final_rate;
        const diff = reward - baseReward2;
        console.log(
          `│ ${level.name.padEnd(14)} │ ` +
          `${reward.toFixed(2).padEnd(12)} │ ` +
          `${(diff > 0 ? '+' + diff.toFixed(2) : '-').padEnd(12)} │`
        );
      });
      
      console.log('└────────────────┴──────────────┴──────────────┘\n');

      console.log('='.repeat(80));
      console.log('✅ SWAP 挖矿 NFT 加成系统已启用！');
      console.log('='.repeat(80) + '\n');

      console.log('📋 关键更新:');
      console.log('   ✓ 基础奖励率提高 10 倍（0.00003 → 0.0003）');
      console.log('   ✓ 交易 100 USDT = 0.03 EAGLE（原来 0.003）');
      console.log('   ✓ NFT 加成启用：加成% = 权重 × 10');
      console.log('   ✓ Diamond Node 获得 2.5x 总倍数\n');

      console.log('🚀 下一步:');
      console.log('   1. 更新后端计算逻辑（swapMiningService.ts）');
      console.log('   2. 更新前端显示页面');
      console.log('   3. 添加合规表述\n');

      console.log('='.repeat(80) + '\n');

      db.close();
    });
  });
});
