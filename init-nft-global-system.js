/**
 * 初始化 NFT 全局 Token ID 管理系统
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || './data/eagle-swap.db';
const db = new Database(dbPath);

console.log('🚀 初始化 NFT 全局 Token ID 管理系统...\n');

try {
  // 读取并执行 SQL schema
  const schemaPath = path.join(__dirname, 'src/database/schema-nft-global-tokenid.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // 执行 schema
  db.exec(schema);
  
  console.log('✅ 数据库表创建成功！\n');
  
  // 检查表是否创建成功
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name LIKE 'nft_%'
    ORDER BY name
  `).all();
  
  console.log('📋 已创建的表:');
  tables.forEach(table => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
    console.log(`  - ${table.name}: ${count.count} 行`);
  });
  
  console.log('\n📊 全局统计:');
  const stats = db.prepare('SELECT * FROM nft_global_stats WHERE id = 1').get();
  console.log('  总铸造数:', stats.total_minted);
  console.log('  总预留数:', stats.total_reserved);
  console.log('  当前阶段:', stats.current_stage);
  console.log('  阶段效率:', stats.stage_efficiency + '%');
  console.log('  最后 Token ID:', stats.last_token_id);
  
  console.log('\n📊 等级统计:');
  const levels = db.prepare('SELECT * FROM nft_level_stats ORDER BY level').all();
  levels.forEach(level => {
    console.log(`  Level ${level.level} (${level.level_name}): ${level.minted}/${level.total_supply} 已铸造`);
  });
  
  console.log('\n✅ NFT 全局 Token ID 管理系统初始化完成！');
  console.log('\n📝 下一步:');
  console.log('  1. 启动后端服务');
  console.log('  2. 测试 /api/nft/request-mint 接口');
  console.log('  3. 前端调用新的铸造流程');
  
} catch (error) {
  console.error('❌ 初始化失败:', error);
  process.exit(1);
} finally {
  db.close();
}
