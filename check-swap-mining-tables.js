#!/usr/bin/env node

const Database = require('better-sqlite3');

// 数据库路径
const DB_PATH = process.env.DATABASE_PATH || './data/eagleswap.db';

console.log('🔍 检查 Swap Mining 数据库表');
console.log('📁 数据库路径:', DB_PATH);
console.log('');

try {
  const db = new Database(DB_PATH, { readonly: true });
  
  // 1. 列出所有表
  console.log('📊 所有数据库表:');
  const allTables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  console.log(`总共 ${allTables.length} 个表:\n`);
  allTables.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name}`);
  });
  
  // 2. 检查 Swap Mining 相关表
  console.log('\n\n🎯 Swap Mining 相关表:');
  const swapMiningTables = [
    'user_claim_nonce',
    'user_swap_stats', 
    'swap_transactions',
    'swap_mining_nft_bonus_log'
  ];
  
  swapMiningTables.forEach(tableName => {
    const exists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(tableName);
    
    if (exists) {
      console.log(`\n✅ ${tableName} - 存在`);
      
      // 获取表结构
      const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
      console.log('   字段:');
      schema.forEach(col => {
        const pk = col.pk ? ' [PRIMARY KEY]' : '';
        const notnull = col.notnull ? ' NOT NULL' : '';
        console.log(`     - ${col.name}: ${col.type}${pk}${notnull}`);
      });
      
      // 获取记录数
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      console.log(`   记录数: ${count.count}`);
      
      // 如果有记录，显示最近的几条
      if (count.count > 0 && count.count <= 5) {
        console.log('   最近记录:');
        const records = db.prepare(`SELECT * FROM ${tableName} LIMIT 5`).all();
        records.forEach(r => {
          console.log('     ', JSON.stringify(r));
        });
      }
    } else {
      console.log(`\n❌ ${tableName} - 不存在`);
    }
  });
  
  // 3. 检查索引
  console.log('\n\n📑 Swap Mining 相关索引:');
  const indexes = db.prepare(`
    SELECT name, tbl_name, sql 
    FROM sqlite_master 
    WHERE type='index' 
    AND (tbl_name LIKE '%claim%' OR tbl_name LIKE '%swap%')
    ORDER BY tbl_name, name
  `).all();
  
  if (indexes.length > 0) {
    indexes.forEach(idx => {
      console.log(`  - ${idx.name} (${idx.tbl_name})`);
    });
  } else {
    console.log('  (无相关索引)');
  }
  
  db.close();
  console.log('\n✅ 检查完成');
  
} catch (error) {
  console.error('\n❌ 错误:', error.message);
  process.exit(1);
}
