const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');

console.log('\n' + '='.repeat(80));
console.log('🧪 测试 SWAP 挖矿 NFT 加成计算');
console.log('='.repeat(80) + '\n');

const db = new sqlite3.Database(DB_PATH);

// 测试配置
db.get('SELECT * FROM swap_mining_config WHERE id = 1', [], (err, config) => {
  if (err) {
    console.error('❌ 错误:', err.message);
    db.close();
    return;
  }

  console.log('⚙️  当前配置:');
  console.log(`   基础奖励率: ${config.reward_rate} EAGLE/USDT`);
  console.log(`   NFT 加成启用: ${config.nft_bonus_enabled ? '是' : '否'}`);
  console.log(`   加成倍数: 权重 × ${config.nft_bonus_multiplier}\n`);

  // 获取所有 NFT 等级
  db.all('SELECT * FROM node_levels ORDER BY id', [], (err, levels) => {
    if (err) {
      console.error('❌ 错误:', err.message);
      db.close();
      return;
    }

    console.log('📊 各等级 SWAP 挖矿奖励计算:\n');
    console.log('┌────────────────┬────────┬──────────┬──────────────┬──────────────┬──────────┐');
    console.log('│ 等级           │ 权重   │ 加成%    │ 基础奖励     │ 加成后奖励   │ 倍数     │');
    console.log('├────────────────┼────────┼──────────┼──────────────┼──────────────┼──────────┤');

    const testAmount = 100; // 测试交易 100 USDT
    
    // 无 NFT 用户
    const baseReward = testAmount * config.reward_rate;
    console.log(
      `│ ${'无 NFT'.padEnd(14)} │ ` +
      `${'0'.padEnd(6)} │ ` +
      `${'0%'.padEnd(8)} │ ` +
      `${baseReward.toFixed(4).padEnd(12)} │ ` +
      `${baseReward.toFixed(4).padEnd(12)} │ ` +
      `${'1.0x'.padEnd(8)} │`
    );

    levels.forEach(level => {
      const bonusPercent = level.power * config.nft_bonus_multiplier;
      const bonusAmount = baseReward * (bonusPercent / 100);
      const finalReward = baseReward + bonusAmount;
      const multiplier = (finalReward / baseReward).toFixed(2);

      console.log(
        `│ ${level.name.padEnd(14)} │ ` +
        `${String(level.power).padEnd(6)} │ ` +
        `${('+' + bonusPercent + '%').padEnd(8)} │ ` +
        `${baseReward.toFixed(4).padEnd(12)} │ ` +
        `${finalReward.toFixed(4).padEnd(12)} │ ` +
        `${(multiplier + 'x').padEnd(8)} │`
      );
    });

    console.log('└────────────────┴────────┴──────────┴──────────────┴──────────────┴──────────┘\n');

    // 测试不同交易金额
    const testAmounts = [100, 500, 1000, 5000, 10000];
    
    console.log('💰 不同交易金额示例:\n');
    
    testAmounts.forEach(amount => {
      console.log(`📈 交易 ${amount.toLocaleString()} USDT:\n`);
      console.log('┌────────────────┬──────────────┬──────────────┐');
      console.log('│ 等级           │ 获得 EAGLE   │ 对比无 NFT   │');
      console.log('├────────────────┼──────────────┼──────────────┤');

      const base = amount * config.reward_rate;
      
      // 无 NFT
      console.log(
        `│ ${'无 NFT'.padEnd(14)} │ ` +
        `${base.toFixed(4).padEnd(12)} │ ` +
        `${'-'.padEnd(12)} │`
      );

      // 各等级
      levels.forEach(level => {
        const bonusPercent = level.power * config.nft_bonus_multiplier;
        const bonusAmount = base * (bonusPercent / 100);
        const final = base + bonusAmount;
        const diff = final - base;

        console.log(
          `│ ${level.name.padEnd(14)} │ ` +
          `${final.toFixed(4).padEnd(12)} │ ` +
          `${('+' + diff.toFixed(4)).padEnd(12)} │`
        );
      });

      console.log('└────────────────┴──────────────┴──────────────┘\n');
    });

    console.log('='.repeat(80));
    console.log('✅ 测试完成！');
    console.log('='.repeat(80) + '\n');

    console.log('📋 关键信息:');
    console.log(`   ✓ 基础奖励率: ${config.reward_rate} EAGLE/USDT`);
    console.log(`   ✓ 交易 100 USDT = ${(100 * config.reward_rate).toFixed(2)} EAGLE（无 NFT）`);
    console.log(`   ✓ Diamond Node (15 权重) = ${(100 * config.reward_rate * 2.5).toFixed(2)} EAGLE（2.5x）`);
    console.log(`   ✓ NFT 加成公式: 加成% = 权重 × ${config.nft_bonus_multiplier}\n`);

    db.close();
  });
});
