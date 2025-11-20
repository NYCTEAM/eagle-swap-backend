const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('📊 节点难度系数与收益计算详解\n');
console.log('='.repeat(80));

try {
  const db = new Database(dbPath);
  
  // 获取所有节点等级和阶段配置
  const data = db.prepare(`
    SELECT 
      nl.id,
      nl.name,
      nl.price_usdt,
      nl.daily_reward_base,
      nls.stage,
      nls.stage_supply,
      nls.difficulty_multiplier
    FROM node_levels nl
    JOIN node_level_stages nls ON nl.id = nls.level_id
    ORDER BY nl.id, nls.stage
  `).all();
  
  console.log('\n📝 难度系数计算公式:\n');
  console.log('日奖励 = 基础日奖励 × 难度系数');
  console.log('年奖励 = 日奖励 × 365');
  console.log('ROI = (年奖励 × EAGLE价格) / 节点价格 × 100%');
  console.log('');
  
  // 按节点分组
  const nodeGroups = {};
  data.forEach(row => {
    if (!nodeGroups[row.name]) {
      nodeGroups[row.name] = {
        price: row.price_usdt,
        baseReward: row.daily_reward_base,
        stages: []
      };
    }
    nodeGroups[row.name].stages.push({
      stage: row.stage,
      supply: row.stage_supply,
      difficulty: row.difficulty_multiplier
    });
  });
  
  // 假设 EAGLE 价格为 $0.10
  const eaglePrice = 0.10;
  
  console.log(`\n💰 收益计算详解 (假设 EAGLE = $${eaglePrice}):\n`);
  console.log('='.repeat(80));
  
  Object.keys(nodeGroups).forEach(nodeName => {
    const node = nodeGroups[nodeName];
    console.log(`\n${nodeName} - 价格: $${node.price}, 基础日奖励: ${node.baseReward} EAGLE`);
    console.log('-'.repeat(80));
    
    node.stages.forEach(stage => {
      const dailyReward = node.baseReward * stage.difficulty;
      const yearlyReward = dailyReward * 365;
      const yearlyUSD = yearlyReward * eaglePrice;
      const roi = (yearlyUSD / node.price) * 100;
      const paybackDays = node.price / (dailyReward * eaglePrice);
      
      console.log(`\n  阶段 ${stage.stage} (难度系数: ${stage.difficulty}):`);
      console.log(`    供应量: ${stage.supply} 个`);
      console.log(`    日奖励: ${node.baseReward} × ${stage.difficulty} = ${dailyReward.toFixed(4)} EAGLE/天`);
      console.log(`    年奖励: ${dailyReward.toFixed(4)} × 365 = ${yearlyReward.toFixed(2)} EAGLE/年`);
      console.log(`    年收益: ${yearlyReward.toFixed(2)} × $${eaglePrice} = $${yearlyUSD.toFixed(2)}`);
      console.log(`    ROI: $${yearlyUSD.toFixed(2)} / $${node.price} = ${roi.toFixed(2)}%`);
      console.log(`    回本天数: ${paybackDays.toFixed(0)} 天`);
      
      if (stage.stage > 1) {
        const prevDifficulty = node.stages[stage.stage - 2].difficulty;
        const rewardDiff = ((stage.difficulty - prevDifficulty) / prevDifficulty * 100);
        console.log(`    vs 阶段${stage.stage - 1}: ${rewardDiff.toFixed(1)}% 奖励减少`);
      }
    });
  });
  
  console.log('\n\n📈 难度系数对比表:\n');
  console.log('='.repeat(80));
  console.log('| 阶段 | 难度系数 | 奖励比例 | 相对阶段1 | 说明 |');
  console.log('|------|---------|---------|----------|------|');
  console.log('| 1    | 1.0     | 100%    | 基准     | 最高奖励 |');
  console.log('| 2    | 0.9     | 90%     | -10%     | 减少 10% |');
  console.log('| 3    | 0.8     | 80%     | -20%     | 减少 20% |');
  console.log('| 4    | 0.7     | 70%     | -30%     | 减少 30% |');
  console.log('| 5    | 0.6     | 60%     | -40%     | 减少 40% |');
  
  console.log('\n\n🎯 数据库配置验证:\n');
  console.log('='.repeat(80));
  
  // 验证数据库中的配置
  const totalNodes = db.prepare(`
    SELECT SUM(max_supply) as total FROM node_levels
  `).get();
  
  const totalValue = db.prepare(`
    SELECT SUM(price_usdt * max_supply) as total FROM node_levels
  `).get();
  
  console.log(`✅ 总节点数: ${totalNodes.total.toLocaleString()} 个`);
  console.log(`✅ 总筹集额: $${totalValue.total.toLocaleString()} USDT`);
  
  // 检查每个节点的阶段配置
  console.log('\n✅ 阶段配置验证:');
  Object.keys(nodeGroups).forEach(nodeName => {
    const node = nodeGroups[nodeName];
    const totalStageSupply = node.stages.reduce((sum, s) => sum + s.supply, 0);
    const nodeLevel = db.prepare(`SELECT max_supply FROM node_levels WHERE name = ?`).get(nodeName);
    
    if (totalStageSupply === nodeLevel.max_supply) {
      console.log(`  ✅ ${nodeName}: ${totalStageSupply} = ${nodeLevel.max_supply} (正确)`);
    } else {
      console.log(`  ❌ ${nodeName}: ${totalStageSupply} ≠ ${nodeLevel.max_supply} (错误!)`);
    }
  });
  
  console.log('\n✅ 难度系数配置:');
  const difficulties = [1.0, 0.9, 0.8, 0.7, 0.6];
  let allCorrect = true;
  
  Object.keys(nodeGroups).forEach(nodeName => {
    const node = nodeGroups[nodeName];
    const correct = node.stages.every((s, i) => s.difficulty === difficulties[i]);
    
    if (correct) {
      console.log(`  ✅ ${nodeName}: 难度系数正确 (1.0 → 0.6)`);
    } else {
      console.log(`  ❌ ${nodeName}: 难度系数错误!`);
      allCorrect = false;
    }
  });
  
  if (allCorrect) {
    console.log('\n🎉 所有配置验证通过！数据库配置正确！');
  }
  
  db.close();
  
} catch (error) {
  console.error('❌ 错误:', error.message);
}
