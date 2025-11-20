const { ethers } = require('ethers')

const FACTORY_ADDRESS = '0x630DB8E822805c82Ca40a54daE02dd5aC31f7fcF' // POTATO SWAP
const RPC_URL = 'https://rpc.eagleswap.llc/v1/rpc/egs_33d61a80da0db63ca04054a649df70e152c361b99b45efcd'

const network = new ethers.Network('xlayer', 196)
const provider = new ethers.JsonRpcProvider(RPC_URL, network, {
  staticNetwork: network,
  batchMaxCount: 1
})

// Uniswap V2 Factory ABI
const FACTORY_ABI = [
  'function allPairsLength() view returns (uint)',
  'function allPairs(uint) view returns (address)',
  'function feeTo() view returns (address)',
  'function feeToSetter() view returns (address)'
]

// 已知的 X Layer DEX 配置
const KNOWN_DEXES = {
  'POTATO SWAP': {
    factory: '0x3Ea2a2F97A8BF3bbb1a3539bce45c612982EA9bF',
    router: '0x...' // 需要填写
  },
  'XSwap': {
    factory: '0x2CcaDb1e437AA9cDc741574bDa154686B1F04C09',
    router: '0x...' // 通常 Router 地址需要从文档或区块浏览器查找
  }
}

async function findRouter() {
  console.log('🔍 Finding Router for Factory...\n')
  console.log(`Factory Address: ${FACTORY_ADDRESS}\n`)
  
  try {
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider)
    
    // 1. 获取 Factory 信息
    console.log('📊 Reading Factory information...')
    const pairsLength = await factory.allPairsLength()
    console.log(`✅ Total Pairs: ${pairsLength.toString()}\n`)
    
    // 2. 获取一些 Pair 地址作为示例
    console.log('📊 Sample Pairs:')
    const sampleCount = Math.min(5, Number(pairsLength))
    for (let i = 0; i < sampleCount; i++) {
      const pairAddress = await factory.allPairs(i)
      console.log(`  Pair ${i + 1}: ${pairAddress}`)
    }
    
    // 3. 获取 feeTo 和 feeToSetter
    console.log('\n📊 Fee Configuration:')
    try {
      const feeTo = await factory.feeTo()
      const feeToSetter = await factory.feeToSetter()
      console.log(`  Fee To: ${feeTo}`)
      console.log(`  Fee To Setter: ${feeToSetter}`)
    } catch (err) {
      console.log('  (Fee configuration not available)')
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('📊 DEX Information:')
    console.log('='.repeat(60))
    console.log(`Factory: ${FACTORY_ADDRESS}`)
    console.log(`Total Pairs: ${pairsLength.toString()}`)
    
    // 4. 尝试识别 DEX
    console.log('\n💡 Router Address:')
    console.log('   Router 地址通常需要从以下途径获取：')
    console.log('   1. DEX 官方文档')
    console.log('   2. X Layer 区块浏览器 (OKLink)')
    console.log('   3. DEX 的部署交易记录')
    console.log('   4. DEX 的 GitHub 仓库')
    
    // 常见的 Router 地址模式
    console.log('\n📝 常见的 Uniswap V2 Router 地址特征：')
    console.log('   - 通常在 Factory 部署后立即部署')
    console.log('   - Router 合约会引用 Factory 地址')
    console.log('   - 可以通过查询 Factory 的部署者地址找到 Router')
    
    // 5. 查询 Factory 的创建信息
    console.log('\n🔍 Checking Factory deployment...')
    const code = await provider.getCode(FACTORY_ADDRESS)
    if (code === '0x') {
      console.log('❌ Factory contract not found!')
    } else {
      console.log('✅ Factory contract exists')
      console.log(`   Code size: ${(code.length - 2) / 2} bytes`)
    }
    
    // 6. 建议
    console.log('\n💡 To find the Router address:')
    console.log(`   1. Visit: https://www.oklink.com/xlayer/address/${FACTORY_ADDRESS}`)
    console.log('   2. Look for "Contract Creator" transaction')
    console.log('   3. Check nearby transactions for Router deployment')
    console.log('   4. Or check the DEX documentation/frontend code')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

findRouter()
