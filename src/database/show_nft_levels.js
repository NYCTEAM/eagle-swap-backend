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

// 查询 node_levels 表的所有信息
db.all(`SELECT * FROM node_levels ORDER BY level`, [], (err, levels) => {
  if (err) {
    console.error('❌ 查询错误:', err.message);
    db.close();
    return;
  }

  console.log('📊 NFT 访问等级详情\n');
  console.log('⚠️  重要提示：所有分配均为示例，实际分配可变且不保证\n');
  console.log('-'.repeat(80) + '\n');

  levels.forEach((level, index) => {
    console.log(`${index + 1}. ${level.name || `Level ${level.level}`}`);
    console.log('   ' + '─'.repeat(76));
    
    // 基本信息
    console.log(`   🏷️  等级: ${level.level || level.id}`);
    console.log(`   💰 价格: ${level.price ? `$${level.price}` : 'N/A'}`);
    console.log(`   📊 参与权重: ${level.power || level.participation_weight || 'N/A'}`);
    console.log(`   🔢 倍数: ${level.multiplier || 'N/A'}x`);
    
    // 分配信息（合规表述）
    const dailyAllocation = level.daily_reward || level.example_daily_allocation || 0;
    console.log(`   📈 示例每日分配: ${dailyAllocation} EAGLE (可变，不保证)`);
    
    // 计算示例月度和年度（仅供参考）
    const monthlyExample = (dailyAllocation * 30).toFixed(2);
    const yearlyExample = (dailyAllocation * 365).toFixed(2);
    console.log(`   📅 示例月度分配: ~${monthlyExample} EAGLE (参考)`);
    console.log(`   📆 示例年度分配: ~${yearlyExample} EAGLE (参考)`);
    
    // 供应信息
    if (level.max_supply) {
      const soldPercentage = level.current_supply && level.max_supply 
        ? ((level.current_supply / level.max_supply) * 100).toFixed(1)
        : '0';
      console.log(`   📦 供应: ${level.current_supply || 0} / ${level.max_supply} (${soldPercentage}% 已售)`);
    }
    
    // 合规标记
    if (level.allocation_variable !== undefined) {
      console.log(`   ⚠️  分配可变: ${level.allocation_variable ? '是' : '否'}`);
    }
    
    if (level.allocation_disclaimer) {
      console.log(`   📋 免责声明: ${level.allocation_disclaimer.substring(0, 60)}...`);
    }
    
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('📌 关键说明\n');
  console.log('   ✓ 参与权重：决定在分配池中的份额，权重越高份额越大');
  console.log('   ✓ 示例分配：仅为参考示例，实际分配取决于：');
  console.log('     - 网络总参与权重');
  console.log('     - 当前年度的分配池大小');
  console.log('     - 活跃参与者数量');
  console.log('     - 其他网络条件');
  console.log('   ✓ 不保证：所有分配均为可变且不保证，可能为零');
  console.log('   ✓ 非投资：NFT 访问是实用工具，不是投资产品\n');

  // 查询年度分配池信息
  db.all(`SELECT * FROM yearly_rewards ORDER BY year LIMIT 5`, [], (err, yearlyData) => {
    if (!err && yearlyData && yearlyData.length > 0) {
      console.log('='.repeat(80));
      console.log('📅 年度分配池信息（示例）\n');
      
      yearlyData.forEach(year => {
        console.log(`   第 ${year.year} 年:`);
        console.log(`      每日池: ${year.daily_reward || year.daily_pool || 'N/A'} EAGLE`);
        console.log(`      年度倍数: ${year.year_multiplier || 'N/A'}x`);
        console.log('');
      });
    }

    // 查询当前活跃节点统计
    db.all(`
      SELECT 
        level,
        COUNT(*) as count
      FROM nodes
      WHERE participation_active = 1 OR (participation_active IS NULL AND 1=1)
      GROUP BY level
      ORDER BY level
    `, [], (err, activeNodes) => {
      if (!err && activeNodes && activeNodes.length > 0) {
        console.log('='.repeat(80));
        console.log('📊 当前活跃参与统计\n');
        
        let totalActive = 0;
        activeNodes.forEach(node => {
          const levelInfo = levels.find(l => l.level === node.level || l.id === node.level);
          const levelName = levelInfo ? levelInfo.name : `Level ${node.level}`;
          console.log(`   ${levelName}: ${node.count} 个活跃`);
          totalActive += node.count;
        });
        
        console.log(`\n   总计: ${totalActive} 个活跃参与\n`);
      }

      console.log('='.repeat(80));
      console.log('💡 提示：这些数据仅供参考，实际分配会根据网络条件动态调整');
      console.log('='.repeat(80) + '\n');

      db.close();
    });
  });
});
