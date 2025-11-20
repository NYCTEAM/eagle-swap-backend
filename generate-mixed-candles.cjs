const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./data/eagle-swap.db')

console.log('📊 Generating XDOG/WOKB data with guaranteed green/red mix...\n')

const XDOG_ADDRESS = '0x6e1f76017024ee3f9b6eb1d5f9e0c5c123ea6a00'
const WOKB_ADDRESS = '0xe538905cf8410324e03a5a23c1c177a474d59b2b'

// 直接生成 K 线数据（而不是先生成价格点再聚合）
function generateCandleData() {
  const basePrice = 0.00006834
  const now = Math.floor(Date.now() / 1000)
  const interval = 300 // 5分钟
  const numCandles = 288 // 24小时
  
  console.log(`📈 Generating ${numCandles} candles (5m timeframe)...\n`)
  
  const candles = []
  let currentPrice = basePrice
  
  for (let i = numCandles; i >= 0; i--) {
    const timestamp = now - (i * interval)
    
    // 50% 概率绿色，50% 概率红色
    const isGreen = Math.random() < 0.5
    
    // 蜡烛大小：0.5% - 2%
    const candleSize = 0.005 + Math.random() * 0.015
    
    let open, close, high, low
    
    if (isGreen) {
      // 绿色蜡烛：close > open
      open = currentPrice
      close = open * (1 + candleSize)
      low = open * (1 - Math.random() * 0.005) // 下影线
      high = close * (1 + Math.random() * 0.005) // 上影线
      currentPrice = close
    } else {
      // 红色蜡烛：close < open
      open = currentPrice
      close = open * (1 - candleSize)
      high = open * (1 + Math.random() * 0.005) // 上影线
      low = close * (1 - Math.random() * 0.005) // 下影线
      currentPrice = close
    }
    
    // 限制价格范围
    if (currentPrice < basePrice * 0.7) currentPrice = basePrice * 0.7
    if (currentPrice > basePrice * 1.3) currentPrice = basePrice * 1.3
    
    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      isGreen
    })
  }
  
  return candles
}

// 从 K 线生成价格快照（每根蜡烛生成多个价格点）
function generatePriceSnapshots(candles) {
  const snapshots = []
  
  candles.forEach(candle => {
    // 每根蜡烛生成 5 个价格点（模拟 5 分钟内的交易）
    const pointsPerCandle = 5
    
    for (let i = 0; i < pointsPerCandle; i++) {
      const timestamp = candle.timestamp + (i * 60)
      
      // 在 OHLC 范围内随机生成价格
      let price
      if (i === 0) {
        price = candle.open
      } else if (i === pointsPerCandle - 1) {
        price = candle.close
      } else {
        // 中间的价格在 low 和 high 之间随机
        price = candle.low + Math.random() * (candle.high - candle.low)
      }
      
      snapshots.push({
        timestamp,
        price,
        reserve0: (1000000 + Math.random() * 100000).toFixed(2),
        reserve1: (price * 1000000 + Math.random() * 10000).toFixed(2)
      })
    }
  })
  
  return snapshots
}

// 清除旧数据
async function clearOldData() {
  return new Promise((resolve) => {
    db.run('DELETE FROM price_snapshots WHERE token_pair = "XDOG/WOKB"', () => {
      console.log('✅ Cleared old price snapshots')
      db.run('DELETE FROM candles WHERE token_pair = "XDOG/WOKB"', () => {
        console.log('✅ Cleared old candles\n')
        resolve()
      })
    })
  })
}

// 导入价格快照
async function importSnapshots(snapshots) {
  return new Promise((resolve) => {
    console.log(`📥 Importing ${snapshots.length} price snapshots...\n`)
    
    const stmt = db.prepare(`
      INSERT INTO price_snapshots 
      (token_pair, token0_address, token1_address, dex_name, price, reserve0, reserve1, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    let imported = 0
    snapshots.forEach((snap, index) => {
      stmt.run(
        'XDOG/WOKB', XDOG_ADDRESS, WOKB_ADDRESS, 'potato',
        snap.price, snap.reserve0, snap.reserve1, snap.timestamp,
        (err) => {
          if (!err) imported++
          if (index === snapshots.length - 1) {
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
            'XDOG/WOKB', 'potato', timeframe,
            row.open, row.high, row.low, row.close, 0, row.candle_time,
            (err) => {
              if (!err) inserted++
              if (index === rows.length - 1) {
                stmt.finalize()
                const greenPct = (greenCandles / inserted * 100).toFixed(1)
                const redPct = (redCandles / inserted * 100).toFixed(1)
                console.log(`  ${timeframe.padEnd(4)}: ${inserted.toString().padStart(3)} candles | 🟢 ${greenCandles.toString().padStart(3)} (${greenPct}%) | 🔴 ${redCandles.toString().padStart(3)} (${redPct}%)`)
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
    
    // 1. 生成 K 线数据
    const candles = generateCandleData()
    
    // 统计
    const greenCount = candles.filter(c => c.isGreen).length
    const redCount = candles.filter(c => !c.isGreen).length
    console.log(`Generated candles: 🟢 ${greenCount} green, 🔴 ${redCount} red\n`)
    
    // 2. 从 K 线生成价格快照
    const snapshots = generatePriceSnapshots(candles)
    
    // 3. 导入价格快照
    await importSnapshots(snapshots)
    
    // 4. 聚合 K 线
    await aggregateCandles()
    
    // 统计
    const prices = candles.map(c => c.close)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    
    console.log('\n📊 Price Statistics:')
    console.log(`  Min:    ${minPrice.toFixed(8)}`)
    console.log(`  Max:    ${maxPrice.toFixed(8)}`)
    console.log(`  Range:  ${((maxPrice - minPrice) / minPrice * 100).toFixed(2)}%`)
    console.log(`  Start:  ${candles[0].close.toFixed(8)}`)
    console.log(`  End:    ${candles[candles.length - 1].close.toFixed(8)}`)
    
    console.log('\n✅ Data generation complete!')
    console.log('\n🚀 Refresh your browser (Ctrl+Shift+R)')
    console.log('   You should see GREEN and RED candles!')
    
    db.close()
  } catch (error) {
    console.error('❌ Error:', error)
    db.close()
  }
}

main()
