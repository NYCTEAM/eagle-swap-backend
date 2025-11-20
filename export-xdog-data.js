const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('./data/eagle-swap.db');

console.log('📊 Exporting XDOG/WOKB data...\n');

// 查询快照数据
db.all(
  `SELECT * FROM price_snapshots WHERE token_pair = 'XDOG/WOKB' ORDER BY timestamp DESC LIMIT 100`,
  (err, snapshots) => {
    if (err) {
      console.error('Error fetching snapshots:', err);
      return;
    }

    console.log(`✅ Found ${snapshots.length} price snapshots\n`);

    if (snapshots.length > 0) {
      console.log('Latest 10 snapshots:');
      snapshots.slice(0, 10).forEach((snap, i) => {
        const date = new Date(snap.timestamp * 1000);
        console.log(`${i + 1}. Price: ${snap.price}, Time: ${date.toLocaleString()}`);
      });
    }

    // 查询 K 线数据
    db.all(
      `SELECT * FROM candles WHERE token_pair = 'XDOG/WOKB' ORDER BY timestamp DESC LIMIT 100`,
      (err, candles) => {
        if (err) {
          console.error('Error fetching candles:', err);
          db.close();
          return;
        }

        console.log(`\n✅ Found ${candles.length} candles\n`);

        if (candles.length > 0) {
          console.log('Latest 10 candles:');
          candles.slice(0, 10).forEach((candle, i) => {
            const date = new Date(candle.timestamp * 1000);
            console.log(`${i + 1}. O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} V:${candle.volume} Time:${date.toLocaleString()}`);
          });

          // 导出到 JSON 文件
          const exportData = {
            snapshots: snapshots,
            candles: candles,
            summary: {
              total_snapshots: snapshots.length,
              total_candles: candles.length,
              token_pair: 'XDOG/WOKB',
              export_time: new Date().toISOString()
            }
          };

          fs.writeFileSync('./xdog-wokb-data.json', JSON.stringify(exportData, null, 2));
          console.log('\n✅ Data exported to: xdog-wokb-data.json');
        }

        db.close();
      }
    );
  }
);
