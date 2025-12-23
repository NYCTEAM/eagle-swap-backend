/**
 * 检查NFT合约的所有者
 * 快速查看X Layer和BSC合约的owner地址
 */

const { ethers } = require('ethers');

// 链配置
const CHAINS = {
  XLAYER: {
    name: 'X Layer',
    rpc: 'https://rpc1.eagleswap.llc/xlayer/',
    nftAddress: '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7',
    explorer: 'https://www.okx.com/web3/explorer/xlayer'
  },
  BSC: {
    name: 'BSC',
    rpc: 'https://rpc1.eagleswap.llc/bsc/',
    nftAddress: '0x3c117d186C5055071EfF91d87f2600eaF88D591D',
    explorer: 'https://bscscan.com'
  }
};

const NFT_ABI = [
  'function owner() view returns (address)',
  'function signerAddress() view returns (address)'
];

async function checkChain(chainConfig) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔗 ${chainConfig.name}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
    const contract = new ethers.Contract(chainConfig.nftAddress, NFT_ABI, provider);
    
    console.log('\n📋 合约地址:');
    console.log('   ', chainConfig.nftAddress);
    console.log('   ', `${chainConfig.explorer}/address/${chainConfig.nftAddress}`);
    
    const owner = await contract.owner();
    console.log('\n👤 合约所有者 (Owner):');
    console.log('   ', owner);
    
    const signer = await contract.signerAddress();
    console.log('\n🔐 当前签名地址 (Signer):');
    console.log('   ', signer);
    
    return { chain: chainConfig.name, owner, signer };
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 检查NFT合约所有者\n');
  
  const results = [];
  
  for (const [key, chainConfig] of Object.entries(CHAINS)) {
    const result = await checkChain(chainConfig);
    if (result) {
      results.push(result);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 汇总');
  console.log('='.repeat(60));
  
  for (const result of results) {
    console.log(`\n${result.chain}:`);
    console.log(`   Owner: ${result.owner}`);
    console.log(`   Signer: ${result.signer}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📝 下一步:');
  console.log('');
  console.log('如果你是合约所有者，在Coolify中设置:');
  console.log('   OWNER_PRIVATE_KEY=你的所有者私钥');
  console.log('');
  console.log('然后重启容器并运行:');
  console.log('   docker exec hocg04o8swccwggwc8kosc8g-065901235138 node /app/update-all-nft-signers.js');
  console.log('');
}

main().catch(console.error);
