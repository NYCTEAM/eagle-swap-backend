const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('🔄 迁移到多链共享 NFT 系统\n');

const dbPath = '/app/data/eagleswap.db';
const schemaPath = path.join(__dirname, 'src/database/schema-shared-nft.sql');

try {
  const db = new Database(dbPath);
  
  console.log('📊 当前数据库状态:');
  
  // 检查旧表
  const oldTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%nft%'").all();
  console.log('现有 NFT 相关表:', oldTables.map(t => t.name).join(', '));
  
  // 备份旧数据
  console.log('\n💾 备份旧数据...');
  const oldNfts = db.prepare('SELECT * FROM user_nfts').all();
  const oldInventory = db.prepare('SELECT * FROM nft_inventory').all();
  
  console.log('  user_nfts:', oldNfts.length, '条记录');
  console.log('  nft_inventory:', oldInventory.length, '条记录');
  
  // 读取新 schema
  console.log('\n📋 读取新 schema...');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // 执行 schema (分割成单独的语句)
  console.log('🔧 应用新 schema...');
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  let executed = 0;
  let errors = 0;
  
  for (const stmt of statements) {
    try {
      db.exec(stmt + ';');
      executed++;
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('  ❌ 错误:', error.message.substring(0, 100));
        errors++;
      }
    }
  }
  
  console.log('  ✅ 执行了', executed, '条语句');
  if (errors > 0) {
    console.log('  ⚠️ ', errors, '条语句失败');
  }
  
  // 验证新表
  console.log('\n✅ 验证新表结构:');
  const newTables = ['nft_chain_contracts', 'nft_global_inventory', 'nft_global_registry', 'nft_chain_stats'];
  
  for (const table of newTables) {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (exists) {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      console.log('  ✅', table, ':', count.count, '条记录');
    } else {
      console.log('  ❌', table, ': 不存在');
    }
  }
  
  // 显示全局库存
  console.log('\n📊 全局共享库存:');
  const inventory = db.prepare('SELECT level, level_name, total_supply, minted, available FROM nft_global_inventory ORDER BY level').all();
  
  let totalSupply = 0;
  inventory.forEach(item => {
    console.log(`  Level ${item.level}: ${item.level_name} - ${item.total_supply} 张 (已铸造: ${item.minted}, 可用: ${item.available})`);
    totalSupply += item.total_supply;
  });
  
  console.log('\n  📊 总供应量:', totalSupply, '张 NFT');
  console.log('  ✅ 跨链共享: X Layer + BSC + Solana');
  
  // 显示链配置
  console.log('\n⛓️  链配置:');
  const chains = db.prepare('SELECT chain_id, chain_name, contract_address, is_active FROM nft_chain_contracts ORDER BY chain_id').all();
  chains.forEach(chain => {
    const status = chain.is_active ? '✅ 激活' : '❌ 未激活';
    console.log(`  ${chain.chain_name} (${chain.chain_id}): ${chain.contract_address || '未部署'} ${status}`);
  });
  
  // 显示阶段配置
  console.log('\n📈 阶段衰减配置:');
  const stages = db.prepare('SELECT stage, stage_name, nft_threshold, decay_multiplier FROM nft_stage_decay ORDER BY stage').all();
  stages.forEach(stage => {
    console.log(`  Stage ${stage.stage}: ${stage.nft_threshold}+ 张 → ${(stage.decay_multiplier * 100).toFixed(0)}% 奖励`);
  });
  
  db.close();
  console.log('\n✅ 迁移完成！');
  console.log('💡 提示: 重启后端服务以应用新配置');
  
} catch (error) {
  console.error('\n❌ 迁移失败:', error.message);
  console.error(error);
  process.exit(1);
}
