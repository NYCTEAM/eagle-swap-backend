const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./data/eagle-swap.db')

// 你输入的代币地址
const TOKEN_ADDRESS = '0x0cc24c51bf89c00c5affbfcf5e856c25ecbdb48e'
const WOKB_ADDRESS = '0xe538905cf8410324e03a5a23c1c177a474d59b2b'

// 假设这个代币的符号（你可以告诉我实际的符号）
const TOKEN_SYMBOL = 'TOKEN'
const TOKEN_PAIR = `${TOKEN_SYMBOL}/WOKB`

console.log(`📊 Generating test data for ${TOKEN_PAIR}...\n`)
console.log(`Token: ${TOKEN_ADDRESS}`)
console.log(`WOKB:  ${WOKB_ADDRESS}\n`)

// 生成带有绿红混合的 K 线数据
function generateMixedData() {
  const basePrice = 0.00005 // 假设基准价格
  const data = []
  const now = Math.floor(Date.now() / 1000)
  const interval = 60 // 1分钟
  const hours = 24
  const totalPoints = hours * 60
  
  console.log(`📈 Generating ${totalPoints} price points over ${hours} hours...\n`)
  
  let currentPrice = basePrice
  
  for (let i = totalPoints; i >= 0; i--) {
    const timestamp = now - (i * interval)
    
    // 使用完整的正弦波周期，确保起点和终点价格相同
    // 使用 2*PI 的完整周期
    const angle = (i / totalPoints) * 2 * Math.PI
    const wave = Math.sin(angle) * 0.15 // ±15% 的波动
    const noise = (Math.random() - 0.5) * 0.02 // ±1% 的随机噪音
    
    currentPrice = basePrice * (1 + wave + noise)
    
    // 确保价格在合理范围内
    currentPrice = Math.max(basePrice * 0.7, Math.min(basePrice * 1.3, currentPrice))
    
    data.push({
      timestamp,
      price: currentPrice,
      reserve0: (1000000 + Math.random() * 100000).toFixed(2),
      reserve1: (currentPrice * 1000000 + Math.random() * 10000).toFixed(2)
    })
  }
  
  return data
}

// 清除旧数据
async function clearOldData() {
  return new Promise((resolve) => {
    db.run(`DELETE FROM price_snapshots WHERE token_pair = ?`, [TOKEN_PAIR], () => {
      console.log('✅ Cleared old price snapshots')
      db.run(`DELETE FROM candles WHERE token_pair = ?`, [TOKEN_PAIR], () => {
        console.log('✅ Cleared old candles\n')
        resolve()
      })
    })
  })
}

// 导入数据
async function importData(data) {
  return new Promise((resolve) => {
    console.log(`📥 Importing ${data.length} price snapshots...\n`)
    
    const stmt = db.prepare(`
      INSERT INTO price_snapshots 
      (token_pair, token0_address, token1_address, dex_name, price, reserve0, reserve1, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    let imported = 0
    data.forEach((point, index) => {
      stmt.run(
        TOKEN_PAIR, TOKEN_ADDRESS, WOKB_ADDRESS, 'potato',
        point.price, point.reserve0, point.reserve1, point.timestamp,
        (err) => {
          if (!err) imported++
          if (index === data.length - 1) {
            stmt.finalize()
            console.log(`✅ Imported ${imported} snapshots\n`)
            resolve()
          }
        }
      )
    })
  })
}

// 聚合 K 线
async function aggregateCandles() {
  return new Promise((resolve) => {
    console.log('📊 Aggregating candles...\n')
    
    const timeframes = ['1m', '5m', '15m', '1h', '4h']
    const intervals = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400 }
    let completed = 0
    
    timeframes.forEach(timeframe => {
      const interval = intervals[timeframe]
      
      db.all(`
        SELECT 
          (timestamp / ?) * ? as candle_time,
          MIN(price) as low,
          MAX(price) as high,
          (SELECT price FROM price_snapshots ps2 
           WHERE ps2.token_pair = ? AND ps2.dex_name = 'potato' 
           AND (ps2.timestamp / ?) * ? = (timestamp / ?) * ?
           ORDER BY ps2.timestamp ASC LIMIT 1) as open,
          (SELECT price FROM price_snapshots ps3 
           WHERE ps3.token_pair = ? AND ps3.dex_name = 'potato' 
           AND (ps3.timestamp / ?) * ? = (timestamp / ?) * ?
           ORDER BY ps3.timestamp DESC LIMIT 1) as close
        FROM price_snapshots
        WHERE token_pair = ? AND dex_name = 'potato'
        GROUP BY candle_time
        ORDER BY candle_time ASC
      `, [
        interval, interval, TOKEN_PAIR,
        interval, interval, interval, interval, TOKEN_PAIR,
        interval, interval, interval, interval, TOKEN_PAIR
      ], (err, rows) => {
        if (err) {
          console.error(`❌ Error:`, err.message)
          completed++
          if (completed === timeframes.length) resolve()
          return
        }
        
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO candles 
          (token_pair, dex_name, timeframe, open_price, high_price, low_price, close_price, volume, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        
        let inserted = 0
        let greenCandles = 0
        let redCandles = 0
        
        rows.forEach((row, index) => {
          if (row.close > row.open) greenCandles++
          else if (row.close < row.open) redCandles++
          
          stmt.run(
            TOKEN_PAIR, 'potato', timeframe,
            row.open, row.high, row.low, row.close, 0, row.candle_time,
            (err) => {
              if (!err) inserted++
              if (index === rows.length - 1) {
                stmt.finalize()
                const greenPct = inserted > 0 ? (greenCandles / inserted * 100).toFixed(1) : 0
                const redPct = inserted > 0 ? (redCandles / inserted * 100).toFixed(1) : 0
                console.log(`  ${timeframe.padEnd(4)}: ${inserted.toString().padStart(4)} candles | 🟢 ${greenCandles.toString().padStart(3)} (${greenPct}%) | 🔴 ${redCandles.toString().padStart(3)} (${redPct}%)`)
                completed++
                if (completed === timeframes.length) resolve()
              }
            }
          )
        })
      })
    })
  })
}

// 主流程
async function main() {
  try {
    await clearOldData()
    const data = generateMixedData()
    await importData(data)
    await aggregateCandles()
    
    // 统计
    const prices = data.map(d => d.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    
    console.log('\n📊 Price Statistics:')
    console.log(`  Min:    ${minPrice.toFixed(8)}`)
    console.log(`  Max:    ${maxPrice.toFixed(8)}`)
    console.log(`  Range:  ${((maxPrice - minPrice) / minPrice * 100).toFixed(2)}%`)
    console.log(`  Start:  ${data[0].price.toFixed(8)}`)
    console.log(`  End:    ${data[data.length - 1].price.toFixed(8)}`)
    
    console.log('\n✅ Data generation complete!')
    console.log(`\n🚀 Now in your frontend:`)
    console.log(`   1. Select token: ${TOKEN_ADDRESS}`)
    console.log(`   2. Pair with: WOKB`)
    console.log(`   3. Refresh browser (Ctrl+Shift+R)`)
    console.log(`   4. You should see the chart with green/red candles!`)
    
    db.close()
  } catch (error) {
    console.error('❌ Error:', error)
    db.close()
  }
}

main()
