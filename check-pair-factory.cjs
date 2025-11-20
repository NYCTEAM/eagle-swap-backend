const { ethers } = require('ethers')

// 这是 XX人生 代币的 Pair 地址
const PAIR_ADDRESS = '0xD9d5ac48eC9A573A9988f0dc02d9325624b5F4f5'
const RPC_URL = 'https://rpc.eagleswap.llc/v1/rpc/egs_33d61a80da0db63ca04054a649df70e152c361b99b45efcd'

const network = new ethers.Network('xlayer', 196)
const provider = new ethers.JsonRpcProvider(RPC_URL, network, {
  staticNetwork: network,
  batchMaxCount: 1
})

// Uniswap V2 Pair ABI
const PAIR_ABI = [
  'function factory() view returns (address)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
]

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
]

async function checkPairFactory() {
  console.log('🔍 Checking Pair information...\n')
  console.log(`Pair Address: ${PAIR_ADDRESS}\n`)
  
  try {
    const pair = new ethers.Contract(PAIR_ADDRESS, PAIR_ABI, provider)
    
    // 1. 获取 Factory 地址
    console.log('📊 Reading Factory address...')
    const factoryAddress = await pair.factory()
    console.log(`✅ Factory: ${factoryAddress}\n`)
    
    // 2. 获取 Token0 和 Token1
    console.log('📊 Reading token addresses...')
    const token0Address = await pair.token0()
    const token1Address = await pair.token1()
    console.log(`Token0: ${token0Address}`)
    console.log(`Token1: ${token1Address}\n`)
    
    // 3. 获取代币信息
    console.log('📊 Reading token information...')
    const token0 = new ethers.Contract(token0Address, ERC20_ABI, provider)
    const token1 = new ethers.Contract(token1Address, ERC20_ABI, provider)
    
    const [name0, symbol0, decimals0] = await Promise.all([
      token0.name(),
      token0.symbol(),
      token0.decimals()
    ])
    
    const [name1, symbol1, decimals1] = await Promise.all([
      token1.name(),
      token1.symbol(),
      token1.decimals()
    ])
    
    console.log(`\nToken0:`)
    console.log(`  Name: ${name0}`)
    console.log(`  Symbol: ${symbol0}`)
    console.log(`  Decimals: ${decimals0}`)
    console.log(`  Address: ${token0Address}`)
    
    console.log(`\nToken1:`)
    console.log(`  Name: ${name1}`)
    console.log(`  Symbol: ${symbol1}`)
    console.log(`  Decimals: ${decimals1}`)
    console.log(`  Address: ${token1Address}`)
    
    // 4. 获取储备量
    console.log('\n📊 Reading reserves...')
    const reserves = await pair.getReserves()
    const reserve0 = ethers.formatUnits(reserves.reserve0, decimals0)
    const reserve1 = ethers.formatUnits(reserves.reserve1, decimals1)
    
    console.log(`\nReserves:`)
    console.log(`  ${symbol0}: ${parseFloat(reserve0).toLocaleString()}`)
    console.log(`  ${symbol1}: ${parseFloat(reserve1).toLocaleString()}`)
    
    // 5. 计算价格
    const price = parseFloat(reserve1) / parseFloat(reserve0)
    console.log(`\nPrice: 1 ${symbol0} = ${price.toFixed(8)} ${symbol1}`)
    
    // 6. 识别 Factory
    console.log('\n' + '='.repeat(60))
    console.log('📊 Summary:')
    console.log('='.repeat(60))
    console.log(`Pair: ${symbol0}/${symbol1}`)
    console.log(`Pair Address: ${PAIR_ADDRESS}`)
    console.log(`Factory Address: ${factoryAddress}`)
    
    // 已知的 Factory 地址
    const knownFactories = {
      '0x3Ea2a2F97A8BF3bbb1a3539bce45c612982EA9bF': 'POTATO SWAP',
      '0x5e6aca41647763e133377a45f0fefd72bb019f6c': 'Unknown Factory 1',
      // 可以添加更多已知的 Factory
    }
    
    const factoryName = knownFactories[factoryAddress] || 'Unknown DEX'
    console.log(`Factory Name: ${factoryName}`)
    
    if (factoryName === 'Unknown DEX') {
      console.log('\n💡 This is a custom or unknown DEX factory')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkPairFactory()
