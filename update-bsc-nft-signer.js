/**
 * 更新BSC NFT合约的签名地址
 * 将合约中的signerAddress更新为环境变量中的SIGNER_PRIVATE_KEY对应的地址
 */

const { ethers } = require('ethers');
require('dotenv').config();

// BSC配置
const BSC_RPC = 'https://bsc-dataseed1.binance.org';
const BSC_NFT_ADDRESS = '0x3c117d186C5055071EfF91d87f2600eaF88D591D';

// NFT ABI
const NFT_ABI = [
  'function signerAddress() view returns (address)',
  'function setSigner(address _signer) external',
  'function owner() view returns (address)'
];

async function main() {
  console.log('🔧 更新BSC NFT合约签名地址\n');
  console.log('='.repeat(60));
  
  // 1. 获取签名私钥
  const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
  if (!signerPrivateKey) {
    console.error('❌ SIGNER_PRIVATE_KEY not found in environment');
    console.log('\n请在Coolify中设置环境变量:');
    console.log('   SIGNER_PRIVATE_KEY=你的签名私钥');
    process.exit(1);
  }
  
  // 2. 计算新的签名地址
  const signerWallet = new ethers.Wallet(signerPrivateKey);
  const newSignerAddress = signerWallet.address;
  
  console.log('\n📝 新的签名地址:');
  console.log('   ', newSignerAddress);
  
  // 3. 获取所有者私钥
  const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!ownerPrivateKey) {
    console.error('\n❌ OWNER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY not found');
    console.log('\n请在Coolify中设置环境变量:');
    console.log('   OWNER_PRIVATE_KEY=合约所有者私钥');
    process.exit(1);
  }
  
  // 4. 连接BSC
  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const ownerWallet = new ethers.Wallet(ownerPrivateKey, provider);
  
  console.log('\n👤 合约所有者:');
  console.log('   ', ownerWallet.address);
  
  // 5. 连接合约
  const nftContract = new ethers.Contract(BSC_NFT_ADDRESS, NFT_ABI, ownerWallet);
  
  console.log('\n🔗 BSC NFT合约:');
  console.log('   ', BSC_NFT_ADDRESS);
  
  try {
    // 6. 检查当前签名地址
    const currentSigner = await nftContract.signerAddress();
    console.log('\n📋 当前签名地址:');
    console.log('   ', currentSigner);
    
    if (currentSigner.toLowerCase() === newSignerAddress.toLowerCase()) {
      console.log('\n✅ 签名地址已经是最新的，无需更新');
      return;
    }
    
    // 7. 更新签名地址
    console.log('\n🔄 正在更新签名地址...');
    console.log('   从:', currentSigner);
    console.log('   到:', newSignerAddress);
    
    const tx = await nftContract.setSigner(newSignerAddress);
    console.log('\n📤 交易已发送:', tx.hash);
    console.log('   等待确认...');
    
    const receipt = await tx.wait();
    console.log('\n✅ 交易已确认!');
    console.log('   Block:', receipt.blockNumber);
    console.log('   Gas Used:', receipt.gasUsed.toString());
    
    // 8. 验证更新
    const updatedSigner = await nftContract.signerAddress();
    console.log('\n🔍 验证更新后的签名地址:');
    console.log('   ', updatedSigner);
    
    if (updatedSigner.toLowerCase() === newSignerAddress.toLowerCase()) {
      console.log('\n✅ 签名地址更新成功！');
      console.log('\n现在BSC NFT购买应该可以正常工作了');
    } else {
      console.log('\n❌ 签名地址更新失败');
    }
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    
    if (error.message.includes('Ownable: caller is not the owner')) {
      console.log('\n⚠️  你不是合约所有者，无法更新签名地址');
      console.log('   请使用合约所有者的私钥');
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
