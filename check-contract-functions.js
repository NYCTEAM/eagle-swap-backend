/**
 * 检查NFT合约支持的函数
 * 测试不同的函数名来找到正确的ABI
 */

const { ethers } = require('ethers');

const CONTRACTS = [
  {
    name: 'X Layer NFT',
    address: '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7',
    rpc: 'https://rpc1.eagleswap.llc/xlayer/'
  },
  {
    name: 'BSC NFT (正确地址)',
    address: '0x3c117d186C5055071EfF91d87f2600eaF88D591D',
    rpc: 'https://rpc1.eagleswap.llc/bsc/'
  },
  {
    name: 'BSC OTC (错误地址)',
    address: '0x594952F7A9fAE9Cca7E91A3d64FE396F53431170',
    rpc: 'https://rpc1.eagleswap.llc/bsc/'
  }
];

// 尝试不同的函数签名
const FUNCTION_TESTS = [
  { name: 'owner()', abi: ['function owner() view returns (address)'] },
  { name: 'signer()', abi: ['function signer() view returns (address)'] },
  { name: 'signerAddress()', abi: ['function signerAddress() view returns (address)'] },
  { name: 'getSigner()', abi: ['function getSigner() view returns (address)'] },
  { name: 'getContractInfo()', abi: ['function getContractInfo() view returns (address, address, uint256, uint256)'] },
  { name: 'name()', abi: ['function name() view returns (string)'] },
  { name: 'symbol()', abi: ['function symbol() view returns (string)'] }
];

async function checkContract(contractInfo) {
  console.log('\n' + '='.repeat(60));
  console.log(`🔍 检查合约: ${contractInfo.name}`);
  console.log('='.repeat(60));
  console.log(`地址: ${contractInfo.address}`);
  console.log(`RPC: ${contractInfo.rpc}`);
  
  const provider = new ethers.JsonRpcProvider(contractInfo.rpc);
  
  const results = {};
  
  for (const test of FUNCTION_TESTS) {
    try {
      const contract = new ethers.Contract(contractInfo.address, test.abi, provider);
      const functionName = test.name.replace('()', '');
      const result = await contract[functionName]();
      
      console.log(`\n✅ ${test.name}`);
      if (typeof result === 'object' && !Array.isArray(result)) {
        console.log(`   返回值: ${result.toString()}`);
      } else if (Array.isArray(result)) {
        console.log(`   返回值: [${result.join(', ')}]`);
      } else {
        console.log(`   返回值: ${result}`);
      }
      
      results[test.name] = result;
    } catch (error) {
      console.log(`\n❌ ${test.name}`);
      console.log(`   错误: ${error.message.split('\n')[0]}`);
    }
  }
  
  return results;
}

async function main() {
  console.log('🔍 检查NFT合约支持的函数\n');
  
  for (const contractInfo of CONTRACTS) {
    await checkContract(contractInfo);
    console.log('\n');
  }
  
  console.log('='.repeat(60));
  console.log('📝 总结:');
  console.log('');
  console.log('根据上面的测试结果，我们可以确定:');
  console.log('1. 合约支持哪些函数');
  console.log('2. 如何读取签名地址');
  console.log('3. 正确的ABI应该是什么');
  console.log('='.repeat(60));
}

main().catch(console.error);
