/**
 * 初始化NFT数据库表
 * 创建 nft_holders, nft_level_stats, nft_global_stats 等表
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(process.cwd(), 'data', 'eagle-swap.db');
const SCHEMA_PATH = path.join(__dirname, 'src', 'database', 'schema-nft-global-tokenid.sql');

async function initNFTTables() {
  console.log('🔧 初始化NFT数据库表\n');
  console.log('='.repeat(60));
  
  try {
    // 确保data目录存在
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('✅ 创建data目录');
    }
    
    // 连接数据库
    const db = new Database(DB_PATH);
    console.log('✅ 连接到数据库:', DB_PATH);
    
    // 读取schema文件
    if (!fs.existsSync(SCHEMA_PATH)) {
      console.error('❌ Schema文件不存在:', SCHEMA_PATH);
      process.exit(1);
    }
    
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    console.log('✅ 读取schema文件');
    
    // 执行schema
    db.exec(schema);
    console.log('✅ 执行schema脚本');
    
    // 检查创建的表
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'nft%'
      ORDER BY name
    `).all();
    
    console.log('\n📊 创建的NFT表:');
    tables.forEach(t => console.log(`   ✅ ${t.name}`));
    
    // 初始化等级数据
    console.log('\n🔧 初始化等级数据...');
    
    const levels = [
      { level: 1, name: 'Micro Node', weight: 0.1, max_supply: 5000 },
      { level: 2, name: 'Mini Node', weight: 0.2, max_supply: 3000 },
      { level: 3, name: 'Standard Node', weight: 0.5, max_supply: 2000 },
      { level: 4, name: 'Advanced Node', weight: 1.0, max_supply: 1500 },
      { level: 5, name: 'Elite Node', weight: 2.0, max_supply: 1100 },
      { level: 6, name: 'Master Node', weight: 5.0, max_supply: 700 },
      { level: 7, name: 'Ultra Node', weight: 10.0, max_supply: 600 }
    ];
    
    for (const level of levels) {
      db.prepare(`
        INSERT OR REPLACE INTO nft_level_stats 
        (level, level_name, weight, max_supply, minted_count, available_count)
        VALUES (?, ?, ?, ?, 0, ?)
      `).run(level.level, level.name, level.weight, level.max_supply, level.max_supply);
      
      console.log(`   ✅ Level ${level.level}: ${level.name} (${level.max_supply}个)`);
    }
    
    // 初始化全局统计
    console.log('\n🔧 初始化全局统计...');
    
    const existingStats = db.prepare('SELECT * FROM nft_global_stats WHERE id = 1').get();
    
    if (!existingStats) {
      db.prepare(`
        INSERT INTO nft_global_stats 
        (id, total_minted, total_reserved, max_supply, last_token_id, current_stage, stage_efficiency)
        VALUES (1, 0, 0, 13900, 0, 1, 100)
      `).run();
      console.log('   ✅ 创建全局统计记录');
    } else {
      console.log('   ⏭️  全局统计已存在');
    }
    
    db.close();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ NFT数据库表初始化完成！');
    console.log('\n现在可以运行同步脚本:');
    console.log('  node quick-sync-nft.js');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

initNFTTables().catch(console.error);
