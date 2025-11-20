const { ethers } = require('ethers')

const RPC_URL = 'https://rpc.eagleswap.llc/v1/rpc/egs_33d61a80da0db63ca04054a649df70e152c361b99b45efcd'

const network = new ethers.Network('xlayer', 196)
const provider = new ethers.JsonRpcProvider(RPC_URL, network, {
  staticNetwork: network,
  batchMaxCount: 1
})

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) view returns (address pair)'
]

const DEXS = [
  {
    name: 'QuickSwap V3',
    factory: '0xd2480162Aa7F02Ead7BF4C127465446150D58452'
  },
  {
    name: 'POTATO SWAP',
    factory: '0x630DB8E822805c82Ca40a54daE02dd5aC31f7fcF'
  },
  {
    name: 'DYOR SWAP',
    factory: '0x2CcaDb1e437AA9cDc741574bDa154686B1F04C09'
  }
]

// 常用代币
const TOKENS = {
  WOKB: '0xe538905cf8410324e03A5A23C1c177a474D59b2b',
  XDOG: '0x0cc24c51BF89c00c5afFBfCf5E856C25ecBdb48e',
  'XX人生': '0x46601785A00FC419d69C69D8599959b6D3c69991'
}

async function checkPair(dexName, factoryAddress, token0, token1) {
  try {
    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider)
    const pairAddress = await factory.getPair(token0, token1)
    
    if (pairAddress && pairAddress !== ethers.ZeroAddress) {
      console.log(`✅ ${dexName}: ${pairAddress}`)
      return true
    } else {
      console.log(`❌ ${dexName}: No pair`)
      return false
    }
  } catch (error) {
    console.log(`❌ ${dexName}: Error - ${error.message}`)
    return false
  }
}

async function main() {
  console.log('🔍 Checking which DEXs have which token pairs...\n')
  
  const pairs = [
    ['XDOG', 'WOKB'],
    ['XX人生', 'WOKB'],
    ['XDOG', 'XX人生']
  ]
  
  for (const [symbol0, symbol1] of pairs) {
    const token0 = TOKENS[symbol0]
    const token1 = TOKENS[symbol1]
    
    console.log(`\n📊 Checking ${symbol0}/${symbol1}:`)
    console.log(`   ${symbol0}: ${token0}`)
    console.log(`   ${symbol1}: ${token1}\n`)
    
    for (const dex of DEXS) {
      await checkPair(dex.name, dex.factory, token0, token1)
    }
  }
  
  console.log('\n✅ Verification complete!')
  console.log('\n💡 Use the token pairs that show ✅ in your Liquidity page')
}

main()
