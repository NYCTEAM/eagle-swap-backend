const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./data/eagle-swap.db')

const TOKEN_ADDRESS = '0x0cc24c51bf89c00c5affbfcf5e856c25ecbdb48e'

console.log(`📊 Checking data for token: ${TOKEN_ADDRESS}\n`)

// 查找包含这个代币的所有交易对
db.all(`
  SELECT DISTINCT token_pair, COUNT(*) as count
  FROM price_snapshots
  WHERE token0_address = ? OR token1_address = ?
  GROUP BY token_pair
  ORDER BY count DESC
`, [TOKEN_ADDRESS, TOKEN_ADDRESS], (err, pairs) => {
  if (err) {
    console.error('Error:', err.message)
    db.close()
    return
  }
  
  if (pairs.length === 0) {
    console.log('❌ No data found for this token')
    console.log('\n💡 This means:')
    console.log('   1. Backend hasn\'t collected data for this token yet')
    console.log('   2. Or this token doesn\'t have a trading pair on POTATO SWAP')
    console.log('\n🔧 Solutions:')
    console.log('   1. Wait for Backend to collect data (takes a few minutes)')
    console.log('   2. Or use XDOG/WOKB which we have test data for')
    console.log('   3. Or I can generate test data for this token')
  } else {
    console.log(`✅ Found ${pairs.length} trading pair(s) for this token:\n`)
    pairs.forEach((pair, i) => {
      console.log(`${i + 1}. ${pair.token_pair}: ${pair.count} price snapshots`)
    })
    
    // 显示最新的价格数据
    console.log('\n📈 Latest price snapshots:')
    db.all(`
      SELECT token_pair, price, datetime(timestamp, 'unixepoch') as time
      FROM price_snapshots
      WHERE token0_address = ? OR token1_address = ?
      ORDER BY timestamp DESC
      LIMIT 10
    `, [TOKEN_ADDRESS, TOKEN_ADDRESS], (err, snapshots) => {
      if (!err && snapshots.length > 0) {
        snapshots.forEach((s, i) => {
          console.log(`  ${i + 1}. ${s.token_pair}: ${s.price.toFixed(8)} at ${s.time}`)
        })
      }
      
      // 检查 K 线数据
      console.log('\n📊 Candle data:')
      db.all(`
        SELECT token_pair, timeframe, COUNT(*) as count
        FROM candles
        WHERE token_pair IN (
          SELECT DISTINCT token_pair FROM price_snapshots
          WHERE token0_address = ? OR token1_address = ?
        )
        GROUP BY token_pair, timeframe
        ORDER BY token_pair, timeframe
      `, [TOKEN_ADDRESS, TOKEN_ADDRESS], (err, candles) => {
        if (!err && candles.length > 0) {
          candles.forEach(c => {
            console.log(`  ${c.token_pair} (${c.timeframe}): ${c.count} candles`)
          })
        } else {
          console.log('  ❌ No candle data found')
        }
        
        db.close()
      })
    })
  }
})
