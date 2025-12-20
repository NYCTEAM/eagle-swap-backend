const Database = require('better-sqlite3');
const path = require('path');

// 数据库路径
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'eagleswap.db');

console.log('🧹 Cleaning old pending bridge transactions...');
console.log(`Database: ${dbPath}`);

try {
  const db = new Database(dbPath);
  
  // 查看所有 pending 记录
  const pending = db.prepare('SELECT * FROM bridge_transactions WHERE status = ?').all('pending');
  console.log(`\nFound ${pending.length} pending transactions:`);
  
  pending.forEach((tx, i) => {
    console.log(`${i + 1}. TX: ${tx.tx_hash.substring(0, 10)}... | From: ${tx.from_chain} → ${tx.to_chain} | Amount: ${tx.amount} | Created: ${tx.created_at}`);
  });
  
  if (pending.length === 0) {
    console.log('\n✅ No pending transactions to clean!');
    db.close();
    process.exit(0);
  }
  
  // 询问用户是否删除
  console.log('\n⚠️  Do you want to delete ALL pending transactions? (This script will delete them)');
  
  // 删除所有 pending 记录
  const result = db.prepare('DELETE FROM bridge_transactions WHERE status = ?').run('pending');
  
  console.log(`\n✅ Deleted ${result.changes} pending transactions!`);
  
  db.close();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
