const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/eagle-swap.db');

console.log('Checking database...\n');

// 检查代币对
db.all(`SELECT DISTINCT token_pair, dex_name, COUNT(*) as count 
        FROM price_snapshots 
        GROUP BY token_pair, dex_name 
        ORDER BY count DESC 
        LIMIT 20`, [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('=== Price Snapshots ===');
  console.log('Token pairs with data:');
  rows.forEach(row => {
    console.log(`  ${row.token_pair} (${row.dex_name}): ${row.count} snapshots`);
  });
  
  // 检查 K 线数据
  db.all(`SELECT DISTINCT token_pair, dex_name, timeframe, COUNT(*) as count 
          FROM candles 
          GROUP BY token_pair, dex_name, timeframe 
          ORDER BY count DESC 
          LIMIT 20`, [], (err, rows) => {
    if (err) {
      console.error('Error:', err);
      return;
    }
    
    console.log('\n=== Candles ===');
    console.log('K-line data:');
    rows.forEach(row => {
      console.log(`  ${row.token_pair} (${row.dex_name}) ${row.timeframe}: ${row.count} candles`);
    });
    
    // 检查最新的价格快照
    db.all(`SELECT token_pair, dex_name, price, timestamp 
            FROM price_snapshots 
            ORDER BY timestamp DESC 
            LIMIT 10`, [], (err, rows) => {
      if (err) {
        console.error('Error:', err);
        return;
      }
      
      console.log('\n=== Latest Price Snapshots ===');
      rows.forEach(row => {
        const date = new Date(row.timestamp * 1000);
        console.log(`  ${row.token_pair}: $${row.price} at ${date.toLocaleString()}`);
      });
      
      db.close();
    });
  });
});
