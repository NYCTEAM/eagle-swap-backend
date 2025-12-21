const { ethers } = require('ethers');

// 合约地址
const CONTRACTS = {
  xlayer: {
    rpc: 'https://rpc1.eagleswap.llc/xlayer/',
    token: '0x5a746ee9933627ed79822d35a3fe812eddd5ba37',
    bridge: '0xFfa85Db47ba6118B51ce9c65A9cc213060290b62',
  },
  bsc: {
    rpc: 'https://rpc1.eagleswap.llc/bsc/',
    token: '0x480F12D2ECEFe1660e72149c57327f5E0646E5c4',
    bridge: '0xAb13cbC259A592E6b09cf1Ddbdc85eAB7AB2586f',
  },
};

// ERC20 ABI
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

// Bridge ABI
const BRIDGE_ABI = [
  'function token() view returns (address)',
  'function isMintMode() view returns (bool)',
  'function minBridgeAmount() view returns (uint256)',
  'function feeRate() view returns (uint256)',
  'function relayer() view returns (address)',
  'function paused() view returns (bool)',
];

async function verifyChain(chainName, config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Verifying ${chainName.toUpperCase()}`);
  console.log('='.repeat(60));

  const provider = new ethers.JsonRpcProvider(config.rpc);

  // 检查代币合约
  console.log(`\n📝 Token Contract: ${config.token}`);
  try {
    const tokenCode = await provider.getCode(config.token);
    if (tokenCode === '0x') {
      console.log('❌ Token contract NOT deployed!');
      return false;
    }
    console.log('✅ Token contract deployed');

    const token = new ethers.Contract(config.token, ERC20_ABI, provider);
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();

    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} ${symbol}`);
  } catch (error) {
    console.log(`❌ Error reading token: ${error.message}`);
    return false;
  }

  // 检查桥接合约
  console.log(`\n🌉 Bridge Contract: ${config.bridge}`);
  try {
    const bridgeCode = await provider.getCode(config.bridge);
    if (bridgeCode === '0x') {
      console.log('❌ Bridge contract NOT deployed!');
      return false;
    }
    console.log('✅ Bridge contract deployed');

    const bridge = new ethers.Contract(config.bridge, BRIDGE_ABI, provider);
    const tokenAddr = await bridge.token();
    const isMintMode = await bridge.isMintMode();
    const minAmount = await bridge.minBridgeAmount();
    const feeRate = await bridge.feeRate();
    const relayer = await bridge.relayer();
    const paused = await bridge.paused();

    console.log(`   Token Address: ${tokenAddr}`);
    console.log(`   Mode: ${isMintMode ? 'Mint/Burn' : 'Lock/Unlock'}`);
    console.log(`   Min Amount: ${ethers.formatEther(minAmount)} EAGLE`);
    console.log(`   Fee Rate: ${Number(feeRate) / 100}%`);
    console.log(`   Relayer: ${relayer}`);
    console.log(`   Paused: ${paused ? '⚠️ YES' : '✅ NO'}`);

    // 验证代币地址是否匹配
    if (tokenAddr.toLowerCase() !== config.token.toLowerCase()) {
      console.log(`\n❌ ERROR: Bridge token address mismatch!`);
      console.log(`   Expected: ${config.token}`);
      console.log(`   Actual: ${tokenAddr}`);
      return false;
    } else {
      console.log(`\n✅ Token address matches!`);
    }

    if (paused) {
      console.log(`\n⚠️ WARNING: Bridge is PAUSED!`);
      return false;
    }

    return true;
  } catch (error) {
    console.log(`❌ Error reading bridge: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🦅 EAGLE Bridge Contract Verification');
  console.log('='.repeat(60));

  const xlayerOk = await verifyChain('X Layer', CONTRACTS.xlayer);
  const bscOk = await verifyChain('BSC', CONTRACTS.bsc);

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`X Layer: ${xlayerOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`BSC: ${bscOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`Overall: ${xlayerOk && bscOk ? '✅ ALL GOOD' : '❌ ISSUES FOUND'}`);
  console.log('='.repeat(60));

  if (!xlayerOk || !bscOk) {
    console.log('\n⚠️ Please fix the issues above before using the bridge!');
    process.exit(1);
  }
}

main().catch(console.error);
