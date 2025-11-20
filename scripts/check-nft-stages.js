const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');
const db = new Database(dbPath);

console.log('='.repeat(80));
console.log('NFT STAGES CONFIGURATION');
console.log('='.repeat(80));

// Check node_levels table
console.log('\n📊 NODE LEVELS:');
const levels = db.prepare(`
  SELECT * FROM node_levels ORDER BY level
`).all();

levels.forEach(level => {
  console.log(`\n${level.name} (Level ${level.level})`);
  console.log(`  Price: $${level.price} USDT`);
  console.log(`  Power: ${level.power}x`);
  console.log(`  Daily Reward: ${level.daily_reward} EAGLE`);
  console.log(`  Total Supply: ${level.total_supply || 'N/A'}`);
});

// Check if there's a stages table
console.log('\n\n📈 CHECKING FOR STAGES TABLE:');
const tables = db.prepare(`
  SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%stage%'
`).all();

if (tables.length > 0) {
  console.log('Found stage-related tables:', tables.map(t => t.name).join(', '));
  
  tables.forEach(table => {
    console.log(`\n\nTable: ${table.name}`);
    const data = db.prepare(`SELECT * FROM ${table.name}`).all();
    console.table(data);
  });
} else {
  console.log('❌ No stage-related tables found');
}

// Check node_stage_config if exists
console.log('\n\n🔍 CHECKING NODE_STAGE_CONFIG:');
try {
  const stageConfig = db.prepare(`
    SELECT * FROM node_stage_config ORDER BY level, stage
  `).all();
  
  if (stageConfig.length > 0) {
    console.log('\n✅ Found node_stage_config table:');
    console.table(stageConfig);
    
    // Group by level
    const grouped = {};
    stageConfig.forEach(config => {
      if (!grouped[config.level]) {
        grouped[config.level] = [];
      }
      grouped[config.level].push(config);
    });
    
    console.log('\n📋 STAGES BY LEVEL:');
    Object.keys(grouped).forEach(level => {
      const levelName = levels.find(l => l.level == level)?.name || `Level ${level}`;
      console.log(`\n${levelName}:`);
      grouped[level].forEach(stage => {
        console.log(`  Stage ${stage.stage}: ${stage.quantity} nodes @ $${stage.price} USDT`);
      });
    });
  }
} catch (error) {
  console.log('❌ node_stage_config table not found');
}

// List all tables
console.log('\n\n📚 ALL TABLES IN DATABASE:');
const allTables = db.prepare(`
  SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
`).all();
console.log(allTables.map(t => t.name).join('\n'));

db.close();
console.log('\n' + '='.repeat(80));
