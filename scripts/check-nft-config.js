const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');
const db = new Database(dbPath);

console.log('='.repeat(80));
console.log('NFT NODE CONFIGURATION');
console.log('='.repeat(80));

// Check node_config table
console.log('\n📊 NODE_CONFIG TABLE:');
try {
  const nodeConfig = db.prepare(`SELECT * FROM node_config ORDER BY id`).all();
  if (nodeConfig.length > 0) {
    console.table(nodeConfig);
  } else {
    console.log('❌ No data found');
  }
} catch (error) {
  console.log('❌ Table not found:', error.message);
}

// Check node_stage_prices table
console.log('\n\n💰 NODE_STAGE_PRICES TABLE:');
try {
  const stagePrices = db.prepare(`SELECT * FROM node_stage_prices ORDER BY node_level, stage`).all();
  if (stagePrices.length > 0) {
    console.table(stagePrices);
    
    // Group by level
    console.log('\n📋 GROUPED BY LEVEL:');
    const grouped = {};
    stagePrices.forEach(row => {
      if (!grouped[row.node_level]) {
        grouped[row.node_level] = [];
      }
      grouped[row.node_level].push(row);
    });
    
    Object.keys(grouped).sort((a, b) => a - b).forEach(level => {
      console.log(`\n🏆 Level ${level}:`);
      grouped[level].forEach(stage => {
        console.log(`  Stage ${stage.stage}: ${stage.quantity} nodes @ $${stage.price} USDT (Total: $${stage.quantity * stage.price})`);
      });
      const total = grouped[level].reduce((sum, s) => sum + s.quantity, 0);
      console.log(`  📊 Total Supply: ${total} nodes`);
    });
  } else {
    console.log('❌ No data found');
  }
} catch (error) {
  console.log('❌ Table not found:', error.message);
}

// Check nodes table for sold count
console.log('\n\n📈 NODES SOLD STATISTICS:');
try {
  const soldStats = db.prepare(`
    SELECT 
      level,
      COUNT(*) as sold_count,
      SUM(power) as total_power
    FROM nodes
    GROUP BY level
    ORDER BY level
  `).all();
  
  if (soldStats.length > 0) {
    console.table(soldStats);
  } else {
    console.log('No nodes sold yet');
  }
} catch (error) {
  console.log('❌ Error:', error.message);
}

db.close();
console.log('\n' + '='.repeat(80));
