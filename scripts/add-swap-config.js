const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('⚙️ 添加 SWAP 挖矿配置...\n');

try {
  const db = new Database(dbPath);
  
  // SWAP 挖矿配置
  const swapConfigs = [
    {
      key: 'swap_mining_rate',
      value: '0.0003',
      description: 'SWAP 挖矿基础奖励率（EAGLE/USDT）'
    },
    {
      key: 'swap_fee_rate',
      value: '0.001',
      description: 'SWAP 交易手续费率（0.1%）'
    },
    {
      key: 'swap_mining_enabled',
      value: 'true',
      description: 'SWAP 挖矿是否启用'
    },
    {
      key: 'min_swap_amount',
      value: '1',
      description: '最小交易金额（USDT）'
    },
    {
      key: 'swap_mining_start_date',
      value: new Date().toISOString().split('T')[0],
      description: 'SWAP 挖矿开始日期'
    }
  ];
  
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO system_config (key, value, description, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);
  
  swapConfigs.forEach(config => {
    insertStmt.run(config.key, config.value, config.description);
    console.log(`✅ 添加配置: ${config.key} = ${config.value}`);
  });
  
  console.log('\n📊 所有 SWAP 相关配置:');
  console.log('='.repeat(80));
  
  const allConfigs = db.prepare(`
    SELECT key, value, description 
    FROM system_config 
    WHERE key LIKE '%swap%' OR key LIKE '%mining%'
    ORDER BY key
  `).all();
  
  console.table(allConfigs.map(c => ({
    '配置项': c.key,
    '值': c.value,
    '说明': c.description
  })));
  
  console.log('\n💰 SWAP 挖矿奖励计算示例:');
  console.log('='.repeat(80));
  
  const miningRate = parseFloat(allConfigs.find(c => c.key === 'swap_mining_rate')?.value || 0.0003);
  
  console.log(`\n基础奖励率: ${miningRate} EAGLE/USDT`);
  console.log('\n示例计算:');
  console.log('  交易 1,000 USDT:');
  console.log(`    基础奖励: 1,000 × ${miningRate} = ${1000 * miningRate} EAGLE`);
  console.log('    Micro 等级 (+5%): ' + (1000 * miningRate * 1.05).toFixed(4) + ' EAGLE');
  console.log('    Diamond 等级 (+20%): ' + (1000 * miningRate * 1.20).toFixed(4) + ' EAGLE');
  
  console.log('\n  交易 50,000 USDT:');
  console.log(`    基础奖励: 50,000 × ${miningRate} = ${50000 * miningRate} EAGLE`);
  console.log('    Micro 等级 (+5%): ' + (50000 * miningRate * 1.05).toFixed(2) + ' EAGLE');
  console.log('    Diamond 等级 (+20%): ' + (50000 * miningRate * 1.20).toFixed(2) + ' EAGLE');
  
  db.close();
  
  console.log('\n🎉 SWAP 挖矿配置添加完成！');
  
} catch (error) {
  console.error('❌ 错误:', error.message);
}
