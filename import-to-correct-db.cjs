const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./data/eagle-swap.db')

console.log('📊 Importing XDOG/WOKB historical data to ./data/eagle-swap.db...\n')

const XDOG_ADDRESS = '0x6e1f76017024ee3f9b6eb1d5f9e0c5c123ea6a00'
const WOKB_ADDRESS = '0xe538905cf8410324e03a5a23c1c177a474d59b2b'

// 生成历史数据
function generateHistoricalData() {
  const basePrice = 0.00006834
  const data = []
  const now = Math.floor(Date.now() / 1000)
  const days = 7
  const minutesPerDay = 1440
  const totalMinutes = days * minutesPerDay
  
  console.log(`📈 Generating ${totalMinutes} price points over ${days} days...\n`)
  
  for (let i = totalMinutes; i >= 0; i--) {
    const timestamp = now - (i * 60)
    const volatility = 0.05
    const randomFactor = 1 + (Math.random() - 0.5) * 2 * volatility
    const price = basePrice * randomFactor
    const trendFactor = Math.sin(i / 500) * 0.02 + 1
    const finalPrice = price * trendFactor
    
    data.push({
      timestamp,
      price: finalPrice,
      reserve0: (1000000 * Math.random()).toFixed(2),
      reserve1: (finalPrice * 1000000 * Math.random()).toFixed(2)
    })
  }
  
  return data
}

// 导入数据
async function importData(data) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO price_snapshots 
      (token_pair, token0_address, token1_address, dex_name, price, reserve0, reserve1, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    let imported = 0
    let errors = 0
    
    data.forEach((point, index) => {
      stmt.run(
        'XDOG/WOKB',
        XDOG_ADDRESS,
        WOKB_ADDRESS,
        'potato',
        point.price,
        point.reserve0,
        point.reserve1,
        point.timestamp,
        (err) => {
          if (err) errors++
          else imported++
          
          if (index === data.length - 1) {
            stmt.finalize()
            console.log(`✅ Imported ${imported} price snapshots`)
            if (errors > 0) console.log(`⚠️  ${errors} errors (likely duplicates)`)
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
    console.log('\n📊 Aggregating candles...')
    
    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']
    const intervals = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }
    let completed = 0
    
    timeframes.forEach(timeframe => {
      const interval = intervals[timeframe]
      
      db.all(`
        SELECT 
          (timestamp / ?) * ? as candle_time,
          MIN(price) as low,
          MAX(price) as high,
          (SELECT price FROM price_snapshots ps2 
           WHERE ps2.token_pair = 'XDOG/WOKB' AND ps2.dex_name = 'potato' 
           AND (ps2.timestamp / ?) * ? = (timestamp / ?) * ?
           ORDER BY ps2.timestamp ASC LIMIT 1) as open,
          (SELECT price FROM price_snapshots ps3 
           WHERE ps3.token_pair = 'XDOG/WOKB' AND ps3.dex_name = 'potato' 
           AND (ps3.timestamp / ?) * ? = (timestamp / ?) * ?
           ORDER BY ps3.timestamp DESC LIMIT 1) as close
        FROM price_snapshots
        WHERE token_pair = 'XDOG/WOKB' AND dex_name = 'potato'
        GROUP BY candle_time
        ORDER BY candle_time ASC
      `, [
        interval, interval,
        interval, interval, interval, interval,
        interval, interval, interval, interval
      ], (err, rows) => {
        if (err) {
          console.error(`❌ Error aggregating ${timeframe}:`, err.message)
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
        rows.forEach((row, index) => {
          stmt.run(
            'XDOG/WOKB', 'potato', timeframe,
            row.open, row.high, row.low, row.close, 0, row.candle_time,
            (err) => {
              if (!err) inserted++
              if (index === rows.length - 1) {
                stmt.finalize()
                console.log(`  ✅ ${timeframe}: ${inserted} candles`)
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
    const data = generateHistoricalData()
    await importData(data)
    await aggregateCandles()
    
    console.log('\n✅ Data import complete!')
    console.log('\n🚀 Now test the API:')
    console.log('   node test-chart-api.cjs')
    
    db.close()
  } catch (error) {
    console.error('❌ Error:', error)
    db.close()
  }
}

main()
