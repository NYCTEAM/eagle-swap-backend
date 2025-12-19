const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const PRIVATE_KEY = '2a37bdb9a8e1368dab8310ce45ecbea4e19a1b2698dcf709b6f0bc81c95dfb12';

const CHAINS = {
    xlayer: {
        name: 'X Layer',
        chainId: 196,
        rpc: 'https://rpc.xlayer.tech',
        explorer: 'https://www.okx.com/explorer/xlayer',
        rewardToken: '0xdd9B82048D2408D69374Aecb6Cf65e66754c95bc',
        signer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
    },
    bsc: {
        name: 'BSC',
        chainId: 56,
        rpc: 'https://bsc-dataseed.binance.org',
        explorer: 'https://bscscan.com',
        rewardToken: '0x83Fe5B70a08d42F6224A9644b3c73692f2d9092a',
        signer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
    }
};

const CONTRACT_ABI = [
    "constructor(address _rewardToken, address _signer)",
    "function rewardToken() view returns (address)",
    "function signer() view returns (address)",
    "function owner() view returns (address)"
];

const CONTRACT_BYTECODE = "0x608060405234801561001057600080fd5b5060405161001d90610073565b604051809103906000f080158015610039573d6000803e3d6000fd5b5050610080565b60405161004c90610073565b604051809103906000f080158015610068573d6000803e3d6000fd5b505061007f565b610e3a806100916000396000f3fe";

async function deploy() {
    console.log('=== NFT Mining Contract Deployment ===\n');
    
    const contractSource = fs.readFileSync(
        path.join(__dirname, 'NFTMiningWithSignature.sol'),
        'utf8'
    );
    
    console.log('Contract loaded, please compile and deploy manually in Remix IDE\n');
    console.log('=== Deployment Parameters ===\n');
    
    for (const [chainKey, chain] of Object.entries(CHAINS)) {
        console.log(`--- ${chain.name} (Chain ID: ${chain.chainId}) ---`);
        console.log(`RPC: ${chain.rpc}`);
        console.log(`_rewardToken: ${chain.rewardToken}`);
        console.log(`_signer: ${chain.signer}`);
        console.log(`Explorer: ${chain.explorer}`);
        console.log('');
    }
    
    console.log('=== Deployer Wallet ===');
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    console.log(`Address: ${wallet.address}`);
    console.log('');
    
    console.log('=== Check Balances ===');
    for (const [chainKey, chain] of Object.entries(CHAINS)) {
        try {
            const provider = new ethers.JsonRpcProvider(chain.rpc);
            const balance = await provider.getBalance(wallet.address);
            console.log(`${chain.name}: ${ethers.formatEther(balance)} native token`);
        } catch (e) {
            console.log(`${chain.name}: Failed to check balance`);
        }
    }
}

deploy().catch(console.error);
