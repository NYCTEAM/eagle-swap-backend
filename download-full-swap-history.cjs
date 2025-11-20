const sqlite3 = require('sqlite3').verbose()
const { ethers } = require('ethers')

const db = new sqlite3.Database('./data/eagle-swap.db')

// 你要查询的代币地址
const TOKEN_ADDRESS = '0x0cc24c51bf89c00c5affbfcf5e856c25ecbdb48e'
const WOKB_ADDRESS = '0xe538905cf8410324e03a5a23c1c177a474d59b2b'

// X Layer RPC
const RPC_URL = 'https://xlayerrpc.okx.com'
const provider = new ethers.JsonRpcProvider(RPC_URL)

// POTATO SWAP Factory (正确地址)
const FACTORY_ADDRESS = '0x3Ea2a2F97A8BF3bbb1a3539bce45c612982EA9bF'
const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) view returns (address pair)'
]

// Uniswap V2 Pair ABI
const PAIR_ABI = [
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
]

console.log('📊 Downloading FULL Swap history for token...\n')
console.log(`Token: ${TOKEN_ADDRESS}`)
console.log(`WOKB:  ${WOKB_ADDRESS}\n`)

async function main() {
  try {
    // 1. 连接到 X Layer
    console.log('🔗 Connecting to X Layer...')
    const currentBlock = await provider.getBlockNumber()
    console.log(`✅ Connected! Current block: ${currentBlock}\n`)
    
    // 2. 查找 Pair 地址
    console.log('🔍 Finding Pair address from POTATO SWAP Factory...')
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider)
    const pairAddress = await factory.getPair(TOKEN_ADDRESS, WOKB_ADDRESS)
    
    if (pairAddress === ethers.ZeroAddress) {
      console.error('❌ Pair not found! This token may not have a WOKB pair on POTATO SWAP')
      db.close()
      return
    }
    
    console.log(`✅ Found Pair: ${pairAddress}\n`)
    
    // 3. 创建 Pair 合约实例
    const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider)
    
    // 4. 获取 token0 和 token1
    const token0 = await pair.token0()
    const token1 = await pair.token1()
    const isTokenToken0 = token0.toLowerCase() === TOKEN_ADDRESS.toLowerCase()
    
    console.log(`Token0: ${token0}`)
    console.log(`Token1: ${token1}`)
    console.log(`Your token is token${isTokenToken0 ? '0' : '1'}\n`)
    
    // 5. 查询 Pair 创建区块（估算）
    // 由于我们不知道确切的创建区块，我们从较早的区块开始
    // X Layer 大约在 2024 年初启动，假设从区块 1000000 开始
    const startBlock = 1000000
    const endBlock = currentBlock
    
    console.log(`📥 Downloading ALL Swap events...`)
    console.log(`   From block: ${startBlock}`)
    console.log(`   To block:   ${endBlock}`)
    console.log(`   (This may take a few minutes...)\n`)
    
    // 6. 分批查询 Swap 事件（避免 RPC 限制）
    const BATCH_SIZE = 10000 // 每次查询 10000 个区块
    let allEvents = []
    
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
        // 继续下一批
      }
    }
    
    console.log(`\n\n✅ Found ${allEvents.length} Swap events!\n`)
    
    if (allEvents.length === 0) {
      console.log('❌ No Swap events found. This pair may be new or inactive.')
      db.close()
      return
    }
    
    // 7. 处理每个 Swap 事件，计算价格
    console.log('📊 Processing Swap events and calculating prices...\n')
    
    const priceSnapshots = []
    
    for (let i = 0; i < allEvents.length; i++) {
      const event = allEvents[i]
      const block = await event.getBlock()
      
      const amount0In = event.args.amount0In
      const amount1In = event.args.amount1In
      const amount0Out = event.args.amount0Out
      const amount1Out = event.args.amount1Out
      
      // 计算价格
      let price = null
      
      if (isTokenToken0) {
        // Token is token0, WOKB is token1
        // Price = WOKB / Token
        if (amount0Out > 0n && amount1In > 0n) {
          // Buying Token with WOKB
          price = Number(amount1In) / Number(amount0Out)
        } else if (amount0In > 0n && amount1Out > 0n) {
          // Selling Token for WOKB
          price = Number(amount1Out) / Number(amount0In)
        }
      } else {
        // Token is token1, WOKB is token0
        // Price = WOKB / Token
        if (amount1Out > 0n && amount0In > 0n) {
          // Buying Token with WOKB
          price = Number(amount0In) / Number(amount1Out)
        } else if (amount1In > 0n && amount0Out > 0n) {
          // Selling Token for WOKB
          price = Number(amount0Out) / Number(amount1In)
        }
      }
      
      if (price && price > 0 && isFinite(price)) {
        priceSnapshots.push({
          timestamp: Number(block.timestamp),
          price: price,
          blockNumber: block.number,
          txHash: event.transactionHash
        })
      }
      
      if ((i + 1) % 100 === 0) {
        process.stdout.write(`\r   Processed: ${i + 1}/${allEvents.length} events`)
      }
    }
    
    console.log(`\n\n✅ Processed ${priceSnapshots.length} valid price points\n`)
    
    if (priceSnapshots.length === 0) {
      console.log('❌ No valid price data extracted')
      db.close()
      return
    }
    
    // 8. 获取代币符号（尝试）
    let tokenSymbol = 'TOKEN'
    try {
      const ERC20_ABI = ['function symbol() view returns (string)']
      const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider)
      tokenSymbol = await tokenContract.symbol()
      console.log(`✅ Token symbol: ${tokenSymbol}\n`)
    } catch (err) {
      console.log(`⚠️  Could not get token symbol, using 'TOKEN'\n`)
    }
    
    const tokenPair = `${tokenSymbol}/WOKB`
    
    // 9. 清除旧数据
    console.log('🗑️  Clearing old data...')
    await new Promise((resolve) => {
      db.run('DELETE FROM price_snapshots WHERE token_pair = ?', [tokenPair], () => {
        db.run('DELETE FROM candles WHERE token_pair = ?', [tokenPair], () => {
          console.log('✅ Old data cleared\n')
          resolve()
        })
      })
    })
    
    // 10. 导入价格快照
    console.log(`📥 Importing ${priceSnapshots.length} price snapshots to database...\n`)
    
    await new Promise((resolve) => {
      const stmt = db.prepare(`
        INSERT INTO price_snapshots 
        (token_pair, token0_address, token1_address, dex_name, price, reserve0, reserve1, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      let imported = 0
      priceSnapshots.forEach((snap, index) => {
        stmt.run(
          tokenPair, TOKEN_ADDRESS, WOKB_ADDRESS, 'potato',
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
    
    // 11. 聚合 K 线
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
    
    // 12. 统计
    const prices = priceSnapshots.map(s => s.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const firstPrice = priceSnapshots[0].price
    const lastPrice = priceSnapshots[priceSnapshots.length - 1].price
    
    console.log('\n📊 Price Statistics:')
    console.log(`  Token Pair: ${tokenPair}`)
    console.log(`  Pair Address: ${pairAddress}`)
    console.log(`  Total Swaps: ${allEvents.length}`)
    console.log(`  Valid Prices: ${priceSnapshots.length}`)
    console.log(`  Min Price: ${minPrice.toFixed(8)}`)
    console.log(`  Max Price: ${maxPrice.toFixed(8)}`)
    console.log(`  Range: ${((maxPrice - minPrice) / minPrice * 100).toFixed(2)}%`)
    console.log(`  First Price: ${firstPrice.toFixed(8)}`)
    console.log(`  Last Price: ${lastPrice.toFixed(8)}`)
    console.log(`  Change: ${((lastPrice - firstPrice) / firstPrice * 100).toFixed(2)}%`)
    
    const firstDate = new Date(priceSnapshots[0].timestamp * 1000)
    const lastDate = new Date(priceSnapshots[priceSnapshots.length - 1].timestamp * 1000)
    console.log(`  First Swap: ${firstDate.toISOString()}`)
    console.log(`  Last Swap: ${lastDate.toISOString()}`)
    
    console.log('\n✅ Download complete!')
    console.log('\n🚀 Now in your frontend:')
    console.log(`   1. Select token: ${TOKEN_ADDRESS}`)
    console.log(`   2. Or search for: ${tokenSymbol}`)
    console.log(`   3. Pair with: WOKB`)
    console.log(`   4. Refresh browser (Ctrl+Shift+R)`)
    console.log(`   5. You should see the chart with REAL green/red candles!`)
    
    db.close()
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error)
    db.close()
  }
}

main()
