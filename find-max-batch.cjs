const { ethers } = require('ethers')

const PAIR_ADDRESS = '0x3Ea2a2F97A8BF3bbb1a3539bce45c612982EA9bF'
const RPC_URL = 'https://rpc.eagleswap.llc/v1/rpc/egs_33d61a80da0db63ca04054a649df70e152c361b99b45efcd'

const network = new ethers.Network('xlayer', 196)
const provider = new ethers.JsonRpcProvider(RPC_URL, network, {
  staticNetwork: network,
  batchMaxCount: 1
})

const PAIR_ABI = [
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)'
]

async function testBatchSize(batchSize) {
  try {
    const currentBlock = await provider.getBlockNumber()
    const pair = new ethers.Contract(PAIR_ADDRESS, PAIR_ABI, provider)
    
    const fromBlock = currentBlock - batchSize
    const toBlock = currentBlock
    
    console.log(`Testing ${batchSize.toLocaleString()} blocks...`)
    
    const startTime = Date.now()
    const events = await pair.queryFilter(
      pair.filters.Swap(),
      fromBlock,
      toBlock
    )
    const endTime = Date.now()
    
    console.log(`✅ Success! Found ${events.length} events in ${(endTime - startTime) / 1000}s\n`)
    return true
    
  } catch (error) {
    console.log(`❌ Failed! Error: ${error.message}\n`)
    return false
  }
}

async function findMaxBatch() {
  console.log('🔍 Finding maximum batch size for Eagle RPC...\n')
  
  // 二分查找最大批次
  let min = 50000  // 已知 50000 可以工作
  let max = 10000000  // 10M 作为上限
  let maxWorking = 50000
  
  console.log(`Starting binary search between ${min.toLocaleString()} and ${max.toLocaleString()} blocks\n`)
  
  while (min <= max) {
    const mid = Math.floor((min + max) / 2)
    
    console.log(`\n📊 Testing ${mid.toLocaleString()} blocks (range: ${min.toLocaleString()} - ${max.toLocaleString()})`)
    
    const success = await testBatchSize(mid)
    
    if (success) {
      maxWorking = mid
      min = mid + 1
      console.log(`✅ ${mid.toLocaleString()} works! Trying larger...`)
    } else {
      max = mid - 1
      console.log(`❌ ${mid.toLocaleString()} failed! Trying smaller...`)
    }
    
    // 等待一下避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log('\n' + '='.repeat(60))
  console.log(`🎯 Maximum batch size: ${maxWorking.toLocaleString()} blocks`)
  console.log('='.repeat(60))
  console.log(`\n📊 Performance:`)
  console.log(`   Total blocks to scan: 41,810,020`)
  console.log(`   Requests needed: ${Math.ceil(41810020 / maxWorking).toLocaleString()}`)
  console.log(`   Estimated time: ~${Math.ceil(41810020 / maxWorking / 10)} minutes`)
  console.log(`\n💡 Recommendation: Use ${maxWorking.toLocaleString()} blocks per batch for optimal speed!`)
}

findMaxBatch()
