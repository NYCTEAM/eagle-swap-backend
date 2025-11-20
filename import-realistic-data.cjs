const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./data/eagle-swap.db')

console.log('📊 Importing realistic XDOG/WOKB price data...\n')

const XDOG_ADDRESS = '0x6e1f76017024ee3f9b6eb1d5f9e0c5c123ea6a00'
const WOKB_ADDRESS = '0xe538905cf8410324e03a5a23c1c177a474d59b2b'

// 生成真实的价格波动数据
function generateRealisticData() {
  const basePrice = 0.00006834
  const data = []
  const now = Math.floor(Date.now() / 1000)
  
  // 只生成 24 小时的数据，每 5 分钟一个点（更合理）
  const hours = 24
  const pointsPerHour = 12 // 每小时 12 个点（5分钟间隔）
  const totalPoints = hours * pointsPerHour
  
  console.log(`📈 Generating ${totalPoints} price points over ${hours} hours...\n`)
  
  let currentPrice = basePrice
  
  for (let i = totalPoints; i >= 0; i--) {
    const timestamp = now - (i * 300) // 5分钟间隔
    
    // 模拟真实的价格走势
    // 1. 添加趋势（上涨或下跌）
    const trendCycle = Math.sin(i / 50) * 0.03 // ±3% 的趋势
    
    // 2. 添加随机波动（每次 ±2%）
    const randomChange = (Math.random() - 0.5) * 0.04
    
    // 3. 偶尔有大波动（10% 概率）
    const bigMove = Math.random() < 0.1 ? (Math.random() - 0.5) * 0.1 : 0
    
    // 计算新价格
    const priceChange = trendCycle + randomChange + bigMove
    currentPrice = currentPrice * (1 + priceChange)
    
    // 确保价格在合理范围内（±30% 的基准价格）
    const minPrice = basePrice * 0.7
    const maxPrice = basePrice * 1.3
    currentPrice = Math.max(minPrice, Math.min(maxPrice, currentPrice))
    
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
    db.run('DELETE FROM price_snapshots WHERE token_pair = "XDOG/WOKB"', (err) => {
      if (err) console.error('Error clearing snapshots:', err.message)
      else console.log('✅ Cleared old price snapshots')
      
      db.run('DELETE FROM candles WHERE token_pair = "XDOG/WOKB"', (err) => {
        if (err) console.error('Error clearing candles:', err.message)
        else console.log('✅ Cleared old candles')
        resolve()
      })
    })
  })
}

// 导入数据
async function importData(data) {
  return new Promise((resolve) => {
    const stmt = db.prepare(`
      INSERT INTO price_snapshots 
      (token_pair, token0_address, token1_address, dex_name, price, reserve0, reserve1, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    let imported = 0
    
    data.forEach((point, index) => {
      stmt.run(
        'XDOG/WOKB', XDOG_ADDRESS, WOKB_ADDRESS, 'potato',
        point.price, point.reserve0, point.reserve1, point.timestamp,
        (err) => {
          if (!err) imported++
          
          if (index === data.length - 1) {
            stmt.finalize()
            console.log(`\n✅ Imported ${imported} price snapshots`)
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
    
    const timeframes = ['5m', '15m', '1h', '4h']
    const intervals = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400 }
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
        let greenCandles = 0
        let redCandles = 0
        
        rows.forEach((row, index) => {
          if (row.close > row.open) greenCandles++
          else redCandles++
          
          stmt.run(
            'XDOG/WOKB', 'potato', timeframe,
            row.open, row.high, row.low, row.close, 0, row.candle_time,
            (err) => {
              if (!err) inserted++
              if (index === rows.length - 1) {
                stmt.finalize()
                console.log(`  ✅ ${timeframe}: ${inserted} candles (🟢${greenCandles} green, 🔴${redCandles} red)`)
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
    const data = generateRealisticData()
    await importData(data)
    await aggregateCandles()
    
    // 显示价格统计
    console.log('\n📊 Price Statistics:')
    const prices = data.map(d => d.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length
    
    console.log(`  Min:  ${minPrice.toFixed(8)}`)
    console.log(`  Max:  ${maxPrice.toFixed(8)}`)
    console.log(`  Avg:  ${avgPrice.toFixed(8)}`)
    console.log(`  Range: ${((maxPrice - minPrice) / minPrice * 100).toFixed(2)}%`)
    
    console.log('\n✅ Data import complete!')
    console.log('\n🚀 Now:')
    console.log('1. Refresh your browser (Ctrl+Shift+R)')
    console.log('2. You should see green AND red candles!')
    console.log('3. Try different timeframes (5m, 15m, 1h, 4h)')
    
    db.close()
  } catch (error) {
    console.error('❌ Error:', error)
    db.close()
  }
}

main()
