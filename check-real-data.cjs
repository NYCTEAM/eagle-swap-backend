const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./data/eagle-swap.db')

console.log('📊 Checking real data collected by Backend...\n')

// 查看所有交易对
db.all(`
  SELECT 
    token_pair,
    dex_name,
    COUNT(*) as snapshot_count,
    MIN(timestamp) as first_timestamp,
    MAX(timestamp) as last_timestamp,
    datetime(MIN(timestamp), 'unixepoch') as first_time,
    datetime(MAX(timestamp), 'unixepoch') as last_time
  FROM price_snapshots
  GROUP BY token_pair, dex_name
  ORDER BY snapshot_count DESC
`, (err, pairs) => {
  if (err) {
    console.error('Error:', err.message)
    db.close()
    return
  }
  
  if (pairs.length === 0) {
    console.log('❌ No real data collected yet!')
    console.log('\n💡 This means:')
    console.log('   Backend just started and hasn\'t collected data yet')
    console.log('\n⏳ Wait 5-10 minutes for Backend to collect data')
    console.log('   Then refresh your browser to see the chart')
    db.close()
    return
  }
  
  console.log(`✅ Found ${pairs.length} trading pair(s) with real data:\n`)
  
  pairs.forEach((pair, i) => {
    const duration = pair.last_timestamp - pair.first_timestamp
    const hours = (duration / 3600).toFixed(1)
    
    console.log(`${i + 1}. ${pair.token_pair} (${pair.dex_name})`)
    console.log(`   Snapshots: ${pair.snapshot_count}`)
    console.log(`   First: ${pair.first_time}`)
    console.log(`   Last:  ${pair.last_time}`)
    console.log(`   Duration: ${hours} hours`)
    console.log()
  })
  
  // 查看 K 线数据
  console.log('📊 Candle data:\n')
  db.all(`
    SELECT 
      token_pair,
      timeframe,
      COUNT(*) as count,
      SUM(CASE WHEN close_price > open_price THEN 1 ELSE 0 END) as green_count,
      SUM(CASE WHEN close_price < open_price THEN 1 ELSE 0 END) as red_count
    FROM candles
    GROUP BY token_pair, timeframe
    ORDER BY token_pair, timeframe
  `, (err, candles) => {
    if (!err && candles.length > 0) {
      candles.forEach(c => {
        const greenPct = (c.green_count / c.count * 100).toFixed(1)
        const redPct = (c.red_count / c.count * 100).toFixed(1)
        console.log(`${c.token_pair} (${c.timeframe}): ${c.count} candles | 🟢 ${c.green_count} (${greenPct}%) | 🔴 ${c.red_count} (${redPct}%)`)
      })
    } else {
      console.log('❌ No candle data yet')
      console.log('   Wait for Backend to aggregate candles (every 5 minutes)')
    }
    
    console.log('\n💡 Recommendation:')
    if (pairs.length > 0 && pairs[0].snapshot_count > 50) {
      console.log('   ✅ You have enough data!')
      console.log(`   🚀 Use ${pairs[0].token_pair} in your frontend`)
      console.log('   📊 Refresh browser to see the chart')
    } else {
      console.log('   ⏳ Wait 10-20 more minutes for more data')
      console.log('   📈 Backend is collecting real trading data')
    }
    
    db.close()
  })
})
