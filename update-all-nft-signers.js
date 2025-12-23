/**
 * 更新所有链的NFT合约签名地址
 * 同时更新X Layer和BSC的签名地址
 */

const { ethers } = require('ethers');
require('dotenv').config();

// 链配置 - 优先使用环境变量中的RPC
const CHAINS = {
  XLAYER: {
    name: 'X Layer',
    chainId: 196,
    rpc: process.env.XLAYER_RPC_URL || process.env.X_LAYER_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/',
    nftAddress: process.env.XLAYER_NFT_ADDRESS || '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7',
    explorer: 'https://www.okx.com/web3/explorer/xlayer'
  },
  BSC: {
    name: 'BSC',
    chainId: 56,
    rpc: process.env.BSC_RPC_URL || 'https://rpc1.eagleswap.llc/bsc/',
    nftAddress: process.env.BSC_NFT_ADDRESS || '0x3c117d186C5055071EfF91d87f2600eaF88D591D',
    explorer: 'https://bscscan.com'
  }
};

// NFT ABI
const NFT_ABI = [
  'function signerAddress() view returns (address)',
  'function setSigner(address _signer) external',
  'function owner() view returns (address)'
];

async function updateChain(chainConfig, newSignerAddress, ownerWallet) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔧 更新 ${chainConfig.name} (Chain ID: ${chainConfig.chainId})`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // 连接RPC
    const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
    const wallet = ownerWallet.connect(provider);
    const nftContract = new ethers.Contract(chainConfig.nftAddress, NFT_ABI, wallet);
    
    console.log('\n📋 合约信息:');
    console.log('   Address:', chainConfig.nftAddress);
    console.log('   Explorer:', `${chainConfig.explorer}/address/${chainConfig.nftAddress}`);
    
    // 检查当前签名地址
    const currentSigner = await nftContract.signerAddress();
    console.log('\n🔐 当前签名地址:');
    console.log('   ', currentSigner);
    
    if (currentSigner.toLowerCase() === newSignerAddress.toLowerCase()) {
      console.log('\n✅ 签名地址已经是最新的，无需更新');
      return { success: true, updated: false };
    }
    
    // 更新签名地址
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
    console.log('   Tx:', `${chainConfig.explorer}/tx/${tx.hash}`);
    
    // 验证更新
    const updatedSigner = await nftContract.signerAddress();
    console.log('\n🔍 验证更新后的签名地址:');
    console.log('   ', updatedSigner);
    
    if (updatedSigner.toLowerCase() === newSignerAddress.toLowerCase()) {
      console.log('\n✅ 签名地址更新成功！');
      return { success: true, updated: true, txHash: tx.hash };
    } else {
      console.log('\n❌ 签名地址更新失败');
      return { success: false, updated: false };
    }
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    
    if (error.message.includes('Ownable: caller is not the owner')) {
      console.log('\n⚠️  你不是合约所有者，无法更新签名地址');
      console.log('   请使用合约所有者的私钥');
    }
    
    return { success: false, updated: false, error: error.message };
  }
}

async function main() {
  console.log('🔧 更新所有链的NFT合约签名地址\n');
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
  
  // 4. 创建所有者钱包
  const ownerWallet = new ethers.Wallet(ownerPrivateKey);
  
  console.log('\n👤 合约所有者:');
  console.log('   ', ownerWallet.address);
  
  // 5. 更新所有链
  const results = [];
  
  for (const [key, chainConfig] of Object.entries(CHAINS)) {
    const result = await updateChain(chainConfig, newSignerAddress, ownerWallet);
    results.push({
      chain: chainConfig.name,
      ...result
    });
    
    // 等待一下，避免RPC限流
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 6. 汇总结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 更新结果汇总');
  console.log('='.repeat(60));
  
  let allSuccess = true;
  let anyUpdated = false;
  
  for (const result of results) {
    console.log(`\n${result.chain}:`);
    
    if (result.success) {
      if (result.updated) {
        console.log('   ✅ 已更新');
        console.log('   Tx:', result.txHash);
        anyUpdated = true;
      } else {
        console.log('   ✅ 已是最新');
      }
    } else {
      console.log('   ❌ 更新失败');
      if (result.error) {
        console.log('   Error:', result.error);
      }
      allSuccess = false;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (allSuccess) {
    if (anyUpdated) {
      console.log('✅ 所有链的签名地址已更新！');
    } else {
      console.log('✅ 所有链的签名地址已经是最新的！');
    }
    console.log('\n现在X Layer和BSC的NFT购买都应该可以正常工作了');
    
    console.log('\n🔍 验证更新:');
    console.log('   node test-all-nft-signatures.js');
  } else {
    console.log('❌ 部分链更新失败');
    console.log('\n请检查错误信息并重试');
  }
  
  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
