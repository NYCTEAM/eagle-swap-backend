const { ethers } = require('ethers')

const TOKEN_ADDRESS = '0x0cc24c51bf89c00c5affbfcf5e856c25ecbdb48e'
const WOKB_ADDRESS = '0xe538905cf8410324e03a5a23c1c177a474d59b2b'

const RPC_URL = 'https://xlayerrpc.okx.com'
const provider = new ethers.JsonRpcProvider(RPC_URL)

// 尝试多个 DEX Factory
const FACTORIES = [
  {
    name: 'POTATO SWAP',
    address: '0x5e6aca41647763e133377a45f0fefd72bb019f6c'
  },
  {
    name: 'QuickSwap',
    address: '0x8d4F19B2A7C4B5d63d8f1B7e1e1e1e1e1e1e1e1e' // 示例地址
  }
]

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) view returns (address pair)'
]

async function findPair() {
  console.log('🔍 Searching for token pair...\n')
  console.log(`Token: ${TOKEN_ADDRESS}`)
  console.log(`WOKB:  ${WOKB_ADDRESS}\n`)
  
  try {
    const currentBlock = await provider.getBlockNumber()
    console.log(`✅ Connected to X Layer, block: ${currentBlock}\n`)
    
    // 尝试每个 Factory
    for (const factory of FACTORIES) {
      try {
        console.log(`Checking ${factory.name}...`)
        const factoryContract = new ethers.Contract(
          ethers.getAddress(factory.address),
          FACTORY_ABI,
          provider
        )
        
        const pairAddress = await factoryContract.getPair(TOKEN_ADDRESS, WOKB_ADDRESS)
        
        if (pairAddress && pairAddress !== ethers.ZeroAddress) {
          console.log(`✅ Found pair on ${factory.name}!`)
          console.log(`   Pair address: ${pairAddress}\n`)
          return { factory: factory.name, pairAddress }
        } else {
          console.log(`   ❌ No pair found\n`)
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`)
      }
    }
    
    console.log('❌ Pair not found on any known DEX\n')
    console.log('💡 This token may:')
    console.log('   1. Not have a WOKB pair')
    console.log('   2. Be paired with a different token (USDT, USDC, etc.)')
    console.log('   3. Be on a different DEX')
    console.log('\n🔧 Let me check what pairs exist for this token...\n')
    
    // 尝试读取代币信息
    const ERC20_ABI = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)'
    ]
    
    try {
      const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider)
      const name = await token.name()
      const symbol = await token.symbol()
      const decimals = await token.decimals()
      
      console.log('📊 Token Information:')
      console.log(`   Name: ${name}`)
      console.log(`   Symbol: ${symbol}`)
      console.log(`   Decimals: ${decimals}`)
      console.log(`   Address: ${TOKEN_ADDRESS}`)
      
      console.log('\n💡 Suggestion:')
      console.log(`   Use the token symbol "${symbol}" to search in your frontend`)
      console.log(`   Or check if this token has pairs with other tokens (not WOKB)`)
      
    } catch (err) {
      console.log('⚠️  Could not read token information')
      console.log('   This address may not be a valid ERC20 token')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

findPair()
