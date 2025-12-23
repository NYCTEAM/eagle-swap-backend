/**
 * 检查数据库表结构
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'eagle-swap.db');

console.log('📊 检查数据库\n');
console.log('数据库路径:', DB_PATH);
console.log('='.repeat(60));

try {
  const db = new Database(DB_PATH, { readonly: true });
  
  // 列出所有表
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  console.log(`\n✅ 找到 ${tables.length} 个表:\n`);
  tables.forEach(t => console.log(`   - ${t.name}`));
  
  // 检查NFT相关表
  console.log('\n' + '='.repeat(60));
  console.log('🔍 检查NFT相关表:');
  console.log('='.repeat(60));
  
  const nftTables = ['nft_holders', 'nft_level_stats', 'nft_global_stats', 'user_nfts'];
  
  for (const tableName of nftTables) {
    const exists = tables.find(t => t.name === tableName);
    
    if (exists) {
      console.log(`\n✅ ${tableName} 存在`);
      
      // 获取表结构
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
      console.log('   字段:');
      columns.forEach(col => {
        console.log(`      - ${col.name} (${col.type})`);
      });
      
      // 获取记录数
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      console.log(`   记录数: ${count.count}`);
      
      // 如果有记录，显示前3条
      if (count.count > 0) {
        const rows = db.prepare(`SELECT * FROM ${tableName} LIMIT 3`).all();
        console.log('   示例数据:');
        rows.forEach((row, i) => {
          console.log(`      [${i + 1}]`, JSON.stringify(row, null, 2).substring(0, 200));
        });
      }
    } else {
      console.log(`\n❌ ${tableName} 不存在`);
    }
  }
  
  db.close();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 检查完成');
  
} catch (error) {
  console.error('❌ 错误:', error.message);
  process.exit(1);
}
