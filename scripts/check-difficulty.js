const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('📊 查看节点挖矿难度分配...\n');

try {
  const db = new Database(dbPath);
  
  // 查看节点等级配置
  console.log('🏆 节点等级配置:');
  console.log('='.repeat(80));
  const nodeLevels = db.prepare(`
    SELECT * FROM node_levels ORDER BY id
  `).all();
  
  console.table(nodeLevels.map(n => ({
    '等级': n.id,
    '名称': n.name,
    '价格': '$' + n.price_usdt,
    '算力': n.power,
    '供应量': n.max_supply,
    '基础日奖励': n.daily_reward_base + ' EAGLE'
  })));
  
  console.log('\n📈 节点阶段难度配置:');
  console.log('='.repeat(80));
  
  // 按节点等级分组查看阶段配置
  const stages = db.prepare(`
    SELECT 
      nl.name as node_name,
      nl.daily_reward_base,
      nls.stage,
      nls.stage_supply,
      nls.difficulty_multiplier,
      (nl.daily_reward_base * nls.difficulty_multiplier) as daily_reward
    FROM node_level_stages nls
    JOIN node_levels nl ON nls.level_id = nl.id
    ORDER BY nl.id, nls.stage
  `).all();
  
  // 按节点分组显示
  const groupedByNode = {};
  stages.forEach(s => {
    if (!groupedByNode[s.node_name]) {
      groupedByNode[s.node_name] = [];
    }
    groupedByNode[s.node_name].push(s);
  });
  
  Object.keys(groupedByNode).forEach(nodeName => {
    console.log(`\n${nodeName}:`);
    console.table(groupedByNode[nodeName].map(s => ({
      '阶段': s.stage,
      '供应量': s.stage_supply,
      '难度系数': s.difficulty_multiplier,
      '日奖励': s.daily_reward + ' EAGLE',
      '奖励变化': s.difficulty_multiplier === 1 ? '基准' : 
                  (s.difficulty_multiplier < 1 ? 
                    `↓ ${((1 - s.difficulty_multiplier) * 100).toFixed(0)}%` : 
                    `↑ ${((s.difficulty_multiplier - 1) * 100).toFixed(0)}%`)
    })));
  });
  
  console.log('\n💡 难度系数说明:');
  console.log('='.repeat(80));
  console.log('难度系数 = 1.0  → 100% 基础奖励');
  console.log('难度系数 = 0.9  → 90% 基础奖励 (减少 10%)');
  console.log('难度系数 = 0.8  → 80% 基础奖励 (减少 20%)');
  console.log('难度系数 = 0.7  → 70% 基础奖励 (减少 30%)');
  console.log('难度系数 = 0.6  → 60% 基础奖励 (减少 40%)');
  
  console.log('\n📝 挖矿奖励计算公式:');
  console.log('='.repeat(80));
  console.log('日奖励 = 基础日奖励 × 难度系数');
  console.log('');
  console.log('示例 (Micro Node):');
  console.log('  阶段 1: 0.27 × 1.0 = 0.27 EAGLE/天');
  console.log('  阶段 2: 0.27 × 0.9 = 0.24 EAGLE/天');
  console.log('  阶段 3: 0.27 × 0.8 = 0.22 EAGLE/天');
  console.log('  阶段 4: 0.27 × 0.7 = 0.19 EAGLE/天');
  console.log('  阶段 5: 0.27 × 0.6 = 0.16 EAGLE/天');
  
  db.close();
  
} catch (error) {
  console.error('❌ 错误:', error.message);
}
