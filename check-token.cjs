const { ethers } = require('ethers')

const TOKEN_ADDRESS = '0xcfaa5184f3a7e52def49445adb881f268e7a811d'
// 使用 Eagle RPC
const RPC_URL = 'https://rpc.eagleswap.llc/v1/rpc/egs_33d61a80da0db63ca04054a649df70e152c361b99b45efcd'

const network = new ethers.Network('xlayer', 196)
const provider = new ethers.JsonRpcProvider(RPC_URL, network, {
  staticNetwork: network,
  batchMaxCount: 1
})

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)'
]

async function checkToken() {
  console.log('🔍 Checking token address...\n')
  console.log(`Address: ${TOKEN_ADDRESS}\n`)
  
  try {
    // 1. 检查是否是合约
    const code = await provider.getCode(TOKEN_ADDRESS)
    console.log(`Contract code length: ${code.length}`)
    
    if (code === '0x' || code.length <= 2) {
      console.log('❌ This address is NOT a contract!')
      console.log('   It might be an EOA (Externally Owned Account) or the address does not exist on X Layer.')
      return
    }
    
    console.log('✅ This is a contract\n')
    
    // 2. 尝试读取 ERC20 信息
    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider)
    
    console.log('Trying to read token info...')
    
    try {
      const symbol = await token.symbol()
      console.log(`✅ Symbol: ${symbol}`)
    } catch (err) {
      console.log(`❌ Symbol: Failed - ${err.message}`)
    }
    
    try {
      const name = await token.name()
      console.log(`✅ Name: ${name}`)
    } catch (err) {
      console.log(`❌ Name: Failed - ${err.message}`)
    }
    
    try {
      const decimals = await token.decimals()
      console.log(`✅ Decimals: ${decimals}`)
    } catch (err) {
      console.log(`❌ Decimals: Failed - ${err.message}`)
    }
    
    try {
      const totalSupply = await token.totalSupply()
      console.log(`✅ Total Supply: ${totalSupply.toString()}`)
    } catch (err) {
      console.log(`❌ Total Supply: Failed - ${err.message}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkToken()
