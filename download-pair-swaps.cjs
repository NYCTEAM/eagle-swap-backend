const sqlite3 = require('sqlite3').verbose()
const { ethers } = require('ethers')

const db = new sqlite3.Database('./data/eagle-swap.db')

// 直接使用 Pair 地址
const PAIR_ADDRESS = '0x3Ea2a2F97A8BF3bbb1a3539bce45c612982EA9bF'

// X Layer RPC - 使用 Eagle RPC（和 Backend 相同的配置）
const RPC_URL = 'https://rpc.eagleswap.llc/v1/rpc/egs_33d61a80da0db63ca04054a649df70e152c361b99b45efcd'

// 创建自定义 Provider（避免自动网络检测）
const network = new ethers.Network('xlayer', 196)
const provider = new ethers.JsonRpcProvider(RPC_URL, network, {
  staticNetwork: network,
  batchMaxCount: 1
})

console.log(`🔗 Using Eagle RPC\n`)

// Uniswap V2 Pair ABI
const PAIR_ABI = [
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
]

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
]

console.log('📊 Downloading FULL Swap history from Pair...\n')
console.log(`Pair: ${PAIR_ADDRESS}\n`)

async function main() {
  try {
    // 1. 连接到 X Layer
    console.log('🔗 Connecting to X Layer...')
    const currentBlock = await provider.getBlockNumber()
    console.log(`✅ Connected! Current block: ${currentBlock}\n`)
    
    // 2. 创建 Pair 合约实例
    const pair = new ethers.Contract(PAIR_ADDRESS, PAIR_ABI, provider)
    
    // 3. 获取 token0 和 token1
    console.log('📊 Reading Pair information...')
    const token0Address = await pair.token0()
    const token1Address = await pair.token1()
    
    console.log(`Token0: ${token0Address}`)
    console.log(`Token1: ${token1Address}`)
    
    // 4. 获取代币符号
    const token0 = new ethers.Contract(token0Address, ERC20_ABI, provider)
    const token1 = new ethers.Contract(token1Address, ERC20_ABI, provider)
    
    const symbol0 = await token0.symbol()
    const symbol1 = await token1.symbol()
    const decimals0 = await token0.decimals()
    const decimals1 = await token1.decimals()
    
    console.log(`Token0: ${symbol0} (${decimals0} decimals)`)
    console.log(`Token1: ${symbol1} (${decimals1} decimals)`)
    
    const tokenPair = `${symbol0}/${symbol1}`
    console.log(`\nPair: ${tokenPair}\n`)
    
    // 5. 查询所有 Swap 事件
    // 从较早的区块开始（X Layer 启动区块）
    const startBlock = 1000000
    const endBlock = currentBlock
    
    console.log(`📥 Downloading ALL Swap events...`)
    console.log(`   From block: ${startBlock}`)
    console.log(`   To block:   ${endBlock}`)
    console.log(`   (This may take several minutes...)\n`)
    
    // 分批查询（测试 50000 个区块 - 极限速度）
    const BATCH_SIZE = 50000
    let allEvents = []
    let errorCount = 0
    const MAX_ERRORS = 10
    
    for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += BATCH_SIZE) {
      const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, endBlock)
      
      try {
        const events = await pair.queryFilter(
          pair.filters.Swap(),
          fromBlock,
          toBlock
        )
        
        allEvents = allEvents.concat(events)
        
        const progress = ((toBlock - startBlock) / (endBlock - startBlock) * 100).toFixed(1)
        process.stdout.write(`\r   Progress: ${progress}% | Found ${allEvents.length} events`)
        
      } catch (error) {
        console.error(`\n⚠️  Error querying blocks ${fromBlock}-${toBlock}:`, error.message)
      }
    }
    
    console.log(`\n\n✅ Found ${allEvents.length} Swap events!\n`)
    
    if (allEvents.length === 0) {
      console.log('❌ No Swap events found.')
      db.close()
      return
    }
    
    // 6. 处理每个事件，计算价格
    console.log('📊 Processing Swap events and calculating prices...\n')
    
    const priceSnapshots = []
    
    for (let i = 0; i < allEvents.length; i++) {
      const event = allEvents[i]
      
      try {
        const block = await event.getBlock()
        
        const amount0In = event.args.amount0In
        const amount1In = event.args.amount1In
        const amount0Out = event.args.amount0Out
        const amount1Out = event.args.amount1Out
        
        // 计算价格 (token1 / token0)
        let price = null
        
        if (amount0Out > 0n && amount1In > 0n) {
          // Buying token0 with token1
          price = Number(amount1In) / Number(amount0Out)
        } else if (amount0In > 0n && amount1Out > 0n) {
          // Selling token0 for token1
          price = Number(amount1Out) / Number(amount0In)
        }
        
        if (price && price > 0 && isFinite(price)) {
          priceSnapshots.push({
            timestamp: Number(block.timestamp),
            price: price,
            blockNumber: block.number,
            txHash: event.transactionHash
          })
        }
        
        if ((i + 1) % 100 === 0 || i === allEvents.length - 1) {
          process.stdout.write(`\r   Processed: ${i + 1}/${allEvents.length} events`)
        }
      } catch (error) {
        // 跳过错误的事件
      }
    }
    
    console.log(`\n\n✅ Processed ${priceSnapshots.length} valid price points\n`)
    
    if (priceSnapshots.length === 0) {
      console.log('❌ No valid price data')
      db.close()
      return
    }
    
    // 7. 清除旧数据
    console.log('🗑️  Clearing old data...')
    await new Promise((resolve) => {
      db.run('DELETE FROM price_snapshots WHERE token_pair = ?', [tokenPair], () => {
        db.run('DELETE FROM candles WHERE token_pair = ?', [tokenPair], () => {
          console.log('✅ Old data cleared\n')
          resolve()
        })
      })
    })
    
    // 8. 导入价格快照
    console.log(`📥 Importing ${priceSnapshots.length} price snapshots...\n`)
    
    await new Promise((resolve) => {
      const stmt = db.prepare(`
        INSERT INTO price_snapshots 
        (token_pair, token0_address, token1_address, dex_name, price, reserve0, reserve1, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      let imported = 0
      priceSnapshots.forEach((snap, index) => {
        stmt.run(
          tokenPair, token0Address, token1Address, 'potato',
          snap.price, '0', '0', snap.timestamp,
          (err) => {
            if (!err) imported++
            if (index === priceSnapshots.length - 1) {
              stmt.finalize()
              console.log(`✅ Imported ${imported} snapshots\n`)
              resolve()
            }
          }
        )
      })
    })
    
    // 9. 聚合 K 线
    console.log('📊 Aggregating candles...\n')
    
    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']
    const intervals = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }
    
    for (const timeframe of timeframes) {
      const interval = intervals[timeframe]
      
      const rows = await new Promise((resolve) => {
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
          interval, interval, tokenPair,
          interval, interval, interval, interval, tokenPair,
          interval, interval, interval, interval, tokenPair
        ], (err, rows) => {
          resolve(rows || [])
        })
      })
      
      let greenCandles = 0
      let redCandles = 0
      
      await new Promise((resolve) => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO candles 
          (token_pair, dex_name, timeframe, open_price, high_price, low_price, close_price, volume, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        
        if (rows.length === 0) {
          stmt.finalize()
          resolve()
          return
        }
        
        rows.forEach((row, index) => {
          if (row.close > row.open) greenCandles++
          else if (row.close < row.open) redCandles++
          
          stmt.run(
            tokenPair, 'potato', timeframe,
            row.open, row.high, row.low, row.close, 0, row.candle_time,
            (err) => {
              if (index === rows.length - 1) {
                stmt.finalize()
                resolve()
              }
            }
          )
        })
      })
      
      const total = greenCandles + redCandles
      const greenPct = total > 0 ? (greenCandles / total * 100).toFixed(1) : 0
      const redPct = total > 0 ? (redCandles / total * 100).toFixed(1) : 0
      console.log(`  ${timeframe.padEnd(4)}: ${total.toString().padStart(4)} candles | 🟢 ${greenCandles.toString().padStart(3)} (${greenPct}%) | 🔴 ${redCandles.toString().padStart(3)} (${redPct}%)`)
    }
    
    // 10. 统计
    const prices = priceSnapshots.map(s => s.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const firstPrice = priceSnapshots[0].price
    const lastPrice = priceSnapshots[priceSnapshots.length - 1].price
    
    console.log('\n📊 Statistics:')
    console.log(`  Pair: ${tokenPair}`)
    console.log(`  Pair Address: ${PAIR_ADDRESS}`)
    console.log(`  Total Swaps: ${allEvents.length}`)
    console.log(`  Valid Prices: ${priceSnapshots.length}`)
    console.log(`  Min Price: ${minPrice.toFixed(8)}`)
    console.log(`  Max Price: ${maxPrice.toFixed(8)}`)
    console.log(`  Range: ${((maxPrice - minPrice) / minPrice * 100).toFixed(2)}%`)
    console.log(`  First: ${firstPrice.toFixed(8)}`)
    console.log(`  Last: ${lastPrice.toFixed(8)}`)
    console.log(`  Change: ${((lastPrice - firstPrice) / firstPrice * 100).toFixed(2)}%`)
    
    const firstDate = new Date(priceSnapshots[0].timestamp * 1000)
    const lastDate = new Date(priceSnapshots[priceSnapshots.length - 1].timestamp * 1000)
    console.log(`  First Swap: ${firstDate.toISOString()}`)
    console.log(`  Last Swap: ${lastDate.toISOString()}`)
    
    console.log('\n✅ Download complete!')
    console.log('\n🚀 Refresh your browser (Ctrl+Shift+R)')
    console.log(`   Select ${symbol0} and ${symbol1}`)
    console.log('   You should see the chart with REAL trading data!')
    
    db.close()
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error)
    db.close()
  }
}

main()
