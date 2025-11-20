const { ethers } = require('ethers')

const RPC_URL = 'https://rpc.eagleswap.llc/v1/rpc/egs_33d61a80da0db63ca04054a649df70e152c361b99b45efcd'

const network = new ethers.Network('xlayer', 196)
const provider = new ethers.JsonRpcProvider(RPC_URL, network, {
  staticNetwork: network,
  batchMaxCount: 1
})

const FACTORY_ABI = [
  'function allPairsLength() view returns (uint)',
  'function allPairs(uint) view returns (address)'
]

const PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)'
]

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]

// DYOR SWAP Factory (最多交易对)
const FACTORY_ADDRESS = '0x2CcaDb1e437AA9cDc741574bDa154686B1F04C09'

async function findTokens() {
  console.log('🔍 Finding all tokens on DYOR SWAP...\n')
  
  try {
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider)
    const pairsLength = await factory.allPairsLength()
    
    console.log(`Total pairs: ${pairsLength.toString()}\n`)
    console.log('Scanning first 20 pairs...\n')
    
    const tokens = new Set()
    
    for (let i = 0; i < Math.min(20, Number(pairsLength)); i++) {
      try {
        const pairAddress = await factory.allPairs(i)
        const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider)
        
        const token0 = await pair.token0()
        const token1 = await pair.token1()
        
        tokens.add(token0.toLowerCase())
        tokens.add(token1.toLowerCase())
        
        console.log(`Pair ${i + 1}: ${pairAddress}`)
      } catch (err) {
        // Skip
      }
    }
    
    console.log(`\n\n📊 Found ${tokens.size} unique tokens:\n`)
    
    for (const tokenAddr of tokens) {
      try {
        const token = new ethers.Contract(tokenAddr, ERC20_ABI, provider)
        const symbol = await token.symbol()
        const name = await token.name()
        console.log(`✅ ${symbol.padEnd(10)} ${name}`)
        console.log(`   ${tokenAddr}\n`)
      } catch (err) {
        console.log(`❌ ${tokenAddr} (Failed to read info)\n`)
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

findTokens()
