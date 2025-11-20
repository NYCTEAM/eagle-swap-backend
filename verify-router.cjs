const { ethers } = require('ethers')

const ROUTER_ADDRESS = '0x1E690F24F704672e44255013C2cB22FC04c46036'
const FACTORY_ADDRESS = '0x2CcaDb1e437AA9cDc741574bDa154686B1F04C09'
const RPC_URL = 'https://rpc.eagleswap.llc/v1/rpc/egs_33d61a80da0db63ca04054a649df70e152c361b99b45efcd'

const network = new ethers.Network('xlayer', 196)
const provider = new ethers.JsonRpcProvider(RPC_URL, network, {
  staticNetwork: network,
  batchMaxCount: 1
})

// Uniswap V2 Router ABI
const ROUTER_ABI = [
  'function factory() view returns (address)',
  'function WETH() view returns (address)',
  'function WOKT() view returns (address)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
]

async function verifyRouter() {
  console.log('🔍 Verifying Router address...\n')
  console.log(`Router Address: ${ROUTER_ADDRESS}`)
  console.log(`Expected Factory: ${FACTORY_ADDRESS}\n`)
  
  try {
    // 1. 检查合约是否存在
    console.log('📊 Checking if contract exists...')
    const code = await provider.getCode(ROUTER_ADDRESS)
    if (code === '0x') {
      console.log('❌ No contract found at this address!')
      return
    }
    console.log(`✅ Contract exists (${(code.length - 2) / 2} bytes)\n`)
    
    // 2. 尝试读取 Factory 地址
    console.log('📊 Reading Router configuration...')
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, provider)
    
    try {
      const factoryFromRouter = await router.factory()
      console.log(`✅ Factory from Router: ${factoryFromRouter}`)
      
      if (factoryFromRouter.toLowerCase() === FACTORY_ADDRESS.toLowerCase()) {
        console.log('✅ ✅ ✅ MATCH! This Router belongs to this Factory!\n')
      } else {
        console.log('❌ Factory address does not match!\n')
        console.log(`Expected: ${FACTORY_ADDRESS}`)
        console.log(`Got:      ${factoryFromRouter}\n`)
      }
    } catch (err) {
      console.log(`⚠️  Could not read factory(): ${err.message}`)
    }
    
    // 3. 尝试读取 WETH/WOKT 地址
    console.log('📊 Reading wrapped native token...')
    try {
      const weth = await router.WETH()
      console.log(`✅ WETH/Wrapped Token: ${weth}`)
    } catch (err) {
      try {
        const wokt = await router.WOKT()
        console.log(`✅ WOKT/Wrapped Token: ${wokt}`)
      } catch (err2) {
        console.log(`⚠️  Could not read wrapped token address`)
      }
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('📊 Verification Result:')
    console.log('='.repeat(60))
    console.log(`Router: ${ROUTER_ADDRESS}`)
    console.log(`Factory: ${FACTORY_ADDRESS}`)
    
    // 4. 最终判断
    try {
      const factoryFromRouter = await router.factory()
      if (factoryFromRouter.toLowerCase() === FACTORY_ADDRESS.toLowerCase()) {
        console.log('\n✅ ✅ ✅ VERIFIED!')
        console.log('This is the correct Router for this Factory!')
        console.log('\n💡 You can use this Router address in your DEX frontend')
      }
    } catch (err) {
      console.log('\n⚠️  Could not fully verify')
      console.log('But the contract exists at this address')
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
  }
}

verifyRouter()
