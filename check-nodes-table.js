const db = require('better-sqlite3')('./data/eagle-swap.db');

console.log('=== 检查 nodes 表 ===\n');

// 查看表结构
const columns = db.prepare('PRAGMA table_info(nodes)').all();

console.log('nodes 表字段:');
columns.forEach(col => {
  console.log(`  ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
});

// 查看是否有数据
const count = db.prepare('SELECT COUNT(*) as count FROM nodes').get();
console.log(`\n现有 NFT 数量: ${count.count}`);

if (count.count > 0) {
  const samples = db.prepare('SELECT * FROM nodes LIMIT 3').all();
  console.log('\n示例数据:');
  samples.forEach((node, i) => {
    console.log(`  ${i + 1}. Token ID: ${node.token_id}, Owner: ${node.owner_address}, Level: ${node.level}`);
  });
}

db.close();
