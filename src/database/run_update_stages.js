const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/eagle-swap.db');
const db = new Database(dbPath);

console.log('🔄 Updating stage multipliers...\n');

try {
  db.exec('BEGIN TRANSACTION');

  // 更新所有节点等级的阶段系数为 100%, 95%, 90%, 85%, 80%
  const levels = [
    { id: 1, name: 'Micro' },
    { id: 2, name: 'Mini' },
    { id: 3, name: 'Bronze' },
    { id: 4, name: 'Silver' },
    { id: 5, name: 'Gold' },
    { id: 6, name: 'Platinum' },
    { id: 7, name: 'Diamond' }
  ];

  const stages = [
    { stage: 1, multiplier: 1.00, percent: '100%' },
    { stage: 2, multiplier: 0.95, percent: '95%' },
    { stage: 3, multiplier: 0.90, percent: '90%' },
    { stage: 4, multiplier: 0.85, percent: '85%' },
    { stage: 5, multiplier: 0.80, percent: '80%' }
  ];

  const updateStmt = db.prepare(`
    UPDATE node_level_stages 
    SET difficulty_multiplier = ?, description = ?
    WHERE level_id = ? AND stage = ?
  `);

  for (const level of levels) {
    console.log(`📝 Updating ${level.name} Node stages...`);
    for (const stage of stages) {
      const description = `${level.name} Stage ${stage.stage} - ${stage.percent} rewards`;
      updateStmt.run(stage.multiplier, description, level.id, stage.stage);
      console.log(`   Stage ${stage.stage}: ${stage.percent} (${stage.multiplier})`);
    }
  }

  db.exec('COMMIT');
  console.log('\n✅ Stage multipliers updated successfully!\n');

  // 验证更新
  console.log('📊 Verification - Current stage multipliers:\n');
  const results = db.prepare(`
    SELECT 
      nl.name as node_name,
      nls.stage,
      nls.difficulty_multiplier,
      nls.description
    FROM node_level_stages nls
    JOIN node_levels nl ON nls.level_id = nl.id
    ORDER BY nl.id, nls.stage
  `).all();

  let currentNode = '';
  for (const row of results) {
    if (row.node_name !== currentNode) {
      console.log(`\n${row.node_name}:`);
      currentNode = row.node_name;
    }
    console.log(`  Stage ${row.stage}: ${(row.difficulty_multiplier * 100).toFixed(0)}% - ${row.description}`);
  }

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Error updating stages:', error);
  process.exit(1);
} finally {
  db.close();
}

console.log('\n✨ Done!');
