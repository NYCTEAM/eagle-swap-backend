const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./price_data.db')

console.log('📊 Checking database history...\n')

// 查看所有表
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('Error:', err)
    return
  }
  
  console.log('Tables:', tables.map(t => t.name).join(', '))
  console.log()
  
  // 查看 candles 表的数据
  db.all(`
    SELECT 
      token_pair,
      timeframe,
      COUNT(*) as count,
      MIN(timestamp) as oldest,
      MAX(timestamp) as newest,
      datetime(MIN(timestamp), 'unixepoch') as oldest_date,
      datetime(MAX(timestamp), 'unixepoch') as newest_date
    FROM candles 
    WHERE token_pair = 'XDOG/WOKB'
    GROUP BY token_pair, timeframe
    ORDER BY timeframe
  `, (err, rows) => {
    if (err) {
      console.error('Error:', err)
    } else {
      console.log('📈 XDOG/WOKB Candles by timeframe:')
      rows.forEach(row => {
        console.log(`  ${row.timeframe}: ${row.count} candles`)
        console.log(`    Oldest: ${row.oldest_date}`)
        console.log(`    Newest: ${row.newest_date}`)
        console.log(`    Duration: ${((row.newest - row.oldest) / 3600).toFixed(1)} hours`)
      })
    }
    
    // 查看最近的几根蜡烛
    console.log('\n🕯️ Latest 5 candles (15m):')
    db.all(`
      SELECT 
        datetime(timestamp, 'unixepoch') as time,
        open_price,
        high_price,
        low_price,
        close_price,
        volume
      FROM candles 
      WHERE token_pair = 'XDOG/WOKB' AND timeframe = '15m'
      ORDER BY timestamp DESC
      LIMIT 5
    `, (err, rows) => {
      if (err) {
        console.error('Error:', err)
      } else {
        rows.forEach(row => {
          console.log(`  ${row.time}: O=${row.open_price.toFixed(8)} H=${row.high_price.toFixed(8)} L=${row.low_price.toFixed(8)} C=${row.close_price.toFixed(8)} V=${row.volume}`)
        })
      }
      db.close()
    })
  })
})
