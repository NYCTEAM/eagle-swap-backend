const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');

console.log('\n' + '='.repeat(80));
console.log('🦅 Eagle Swap NFT 访问等级和参与分配信息');
console.log('='.repeat(80) + '\n');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法连接数据库:', err.message);
    process.exit(1);
  }
});

// 先检查表结构
db.all("PRAGMA table_info(node_levels)", [], (err, columns) => {
  if (err) {
    console.error('❌ 错误:', err.message);
    db.close();
    return;
  }

  console.log('📋 node_levels 表结构:\n');
  const colNames = columns.map(c => c.name);
  console.log('   列名:', colNames.join(', '));
  console.log('');

  // 查询所有数据
  db.all(`SELECT * FROM node_levels`, [], (err, levels) => {
    if (err) {
      console.error('❌ 查询错误:', err.message);
      db.close();
      return;
    }

    console.log('📊 NFT 访问等级详情\n');
    console.log('⚠️  重要：所有分配均为示例，实际分配可变且不保证\n');
    console.log('='.repeat(80) + '\n');

    levels.forEach((level, index) => {
      // 动态获取列值
      const id = level.id || level.level || index + 1;
      const name = level.name || level.level_name || `Level ${id}`;
      const price = level.price || 'N/A';
      const power = level.power || level.participation_weight || 'N/A';
      const dailyReward = level.daily_reward || level.example_daily_allocation || 0;
      const multiplier = level.multiplier || 1;
      const maxSupply = level.max_supply || 'N/A';
      const currentSupply = level.current_supply || 0;

      console.log(`${index + 1}. 🎯 ${name}`);
      console.log('   ' + '─'.repeat(76));
      console.log(`   🆔 等级 ID: ${id}`);
      console.log(`   💰 价格: ${price !== 'N/A' ? `$${price}` : 'N/A'}`);
      console.log(`   ⚡ 参与权重 (Power): ${power}`);
      console.log(`   🔢 倍数: ${multiplier}x`);
      console.log('');
      
      // 分配信息（使用合规术语）
      console.log(`   📈 示例每日分配: ${dailyReward} EAGLE`);
      console.log(`      ⚠️  注意：这是示例值，实际分配可变且不保证`);
      
      if (dailyReward > 0) {
        const monthlyExample = (dailyReward * 30).toFixed(2);
        const yearlyExample = (dailyReward * 365).toFixed(2);
        console.log(`   📅 示例月度: ~${monthlyExample} EAGLE (仅供参考)`);
        console.log(`   📆 示例年度: ~${yearlyExample} EAGLE (仅供参考)`);
      }
      console.log('');
      
      // 供应信息
      if (maxSupply !== 'N/A') {
        const soldPercentage = maxSupply > 0 
          ? ((currentSupply / maxSupply) * 100).toFixed(1)
          : '0';
        console.log(`   📦 供应情况:`);
        console.log(`      已售: ${currentSupply} / ${maxSupply}`);
        console.log(`      进度: ${soldPercentage}%`);
        console.log(`      剩余: ${maxSupply - currentSupply}`);
      }
      console.log('');
      
      // 合规信息
      if (level.allocation_variable !== undefined) {
        console.log(`   ✅ 分配可变标记: ${level.allocation_variable ? '是（已标记）' : '否'}`);
      }
      
      if (level.allocation_disclaimer) {
        console.log(`   📋 免责声明: ${level.allocation_disclaimer}`);
      }
      
      console.log('');
    });

    // 显示总结
    console.log('='.repeat(80));
    console.log('📊 等级对比总结\n');
    
    console.log('┌────────────────┬─────────┬──────────┬────────────┬──────────────┐');
    console.log('│ 等级名称       │ 价格    │ 权重     │ 示例日分配 │ 示例月分配   │');
    console.log('├────────────────┼─────────┼──────────┼────────────┼──────────────┤');
    
    levels.forEach(level => {
      const name = (level.name || `Level ${level.id}`).padEnd(14);
      const price = (level.price ? `$${level.price}` : 'N/A').padEnd(7);
      const power = String(level.power || level.participation_weight || 'N/A').padEnd(8);
      const daily = String(level.daily_reward || level.example_daily_allocation || 0).padEnd(10);
      const monthly = String(((level.daily_reward || 0) * 30).toFixed(0)).padEnd(12);
      
      console.log(`│ ${name} │ ${price} │ ${power} │ ${daily} │ ${monthly} │`);
    });
    
    console.log('└────────────────┴─────────┴──────────┴────────────┴──────────────┘');
    console.log('');

    // 重要说明
    console.log('='.repeat(80));
    console.log('📌 重要说明\n');
    console.log('1. 参与权重 (Power)：');
    console.log('   - 决定在每日分配池中的份额');
    console.log('   - 权重越高，获得的份额越大');
    console.log('   - 实际分配 = (您的权重 / 总权重) × 每日池\n');
    
    console.log('2. 示例分配：');
    console.log('   - 仅为参考示例，非保证值');
    console.log('   - 实际分配取决于网络总参与量');
    console.log('   - 可能为零或与示例值差异很大\n');
    
    console.log('3. 合规提示：');
    console.log('   - NFT 访问是实用工具，不是投资');
    console.log('   - 不保证任何收益或回报');
    console.log('   - 所有分配均为可变且不确定\n');
    
    console.log('='.repeat(80) + '\n');

    db.close();
  });
});
