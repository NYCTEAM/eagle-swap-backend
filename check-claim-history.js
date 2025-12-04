const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');

console.log('🔍 检查用户提取记录\n');

const possibleDbPaths = [
  path.join(process.cwd(), 'data/eagleswap.db'),
  '/app/data/eagleswap.db',
  './data/eagleswap.db'
];

let dbPath = '';
for (const p of possibleDbPaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (dbPath === '') {
  console.error('❌ 数据库文件未找到！');
  process.exit(1);
}

console.log('✅ 使用数据库:', dbPath);
const db = new Database(dbPath);

const userAddress = '0x4af7f86c70a6fba4ed9d49074d0805a3c63b1e5b';
const contractAddress = '0x240B0181f0FB4f4d39D953E86ef834bB40811aC5';

try {
  console.log('📊 用户地址:', userAddress);
  console.log('📊 合约地址:', contractAddress);
  
  // 1. 检查数据库中的提取记录
  console.log('\n1️⃣ 数据库提取记录:');
  
  // 检查是否有 claim_history 表
  const hasClaimHistory = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='claim_history'").get();
  
  if (hasClaimHistory) {
    const claims = db.prepare(`
      SELECT * FROM claim_history 
      WHERE user_address = ? 
      ORDER BY created_at DESC
    `).all(userAddress.toLowerCase());
    
    if (claims.length > 0) {
      console.log('找到', claims.length, '条提取记录:');
      claims.forEach(claim => {
        console.log('  - 金额:', claim.amount, 'EAGLE');
        console.log('    交易哈希:', claim.tx_hash);
        console.log('    时间:', claim.created_at);
        console.log('    状态:', claim.status || 'N/A');
        console.log('');
      });
    } else {
      console.log('❌ 没有找到提取记录');
    }
  } else {
    console.log('⚠️  claim_history 表不存在');
  }
  
  // 2. 检查 user_swap_stats 表
  console.log('\n2️⃣ user_swap_stats 表:');
  const stats = db.prepare(`
    SELECT * FROM user_swap_stats WHERE user_address = ?
  `).get(userAddress.toLowerCase());
  
  if (stats) {
    console.log('总奖励:', stats.total_eagle_earned, 'EAGLE');
    console.log('已领取:', stats.total_eagle_claimed, 'EAGLE');
    console.log('待领取:', (stats.total_eagle_earned - stats.total_eagle_claimed).toFixed(6), 'EAGLE');
    console.log('最后更新:', stats.updated_at);
  } else {
    console.log('❌ 没有找到统计数据');
  }
  
  // 3. 检查 user_claim_nonce 表
  console.log('\n3️⃣ user_claim_nonce 表:');
  const nonceRecord = db.prepare(`
    SELECT * FROM user_claim_nonce WHERE user_address = ?
  `).get(userAddress.toLowerCase());
  
  if (nonceRecord) {
    console.log('当前 Nonce:', nonceRecord.nonce);
    console.log('创建时间:', nonceRecord.created_at);
    console.log('更新时间:', nonceRecord.updated_at);
  } else {
    console.log('❌ 没有找到 nonce 记录');
  }
  
  // 4. 查询合约上的提取记录
  console.log('\n4️⃣ 查询合约提取记录:');
  console.log('正在连接 X Layer RPC...');
  
  const provider = new ethers.JsonRpcProvider('https://rpc.xlayer.tech');
  
  // SwapMining 合约 ABI (只需要 Claimed 事件)
  const abi = [
    'event Claimed(address indexed user, uint256 amount, uint256 nonce)'
  ];
  
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  // 查询最近的 Claimed 事件
  const filter = contract.filters.Claimed(userAddress);
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 10000); // 查询最近 10000 个区块
  
  console.log('查询区块范围:', fromBlock, '-', currentBlock);
  
  const events = await contract.queryFilter(filter, fromBlock, currentBlock);
  
  if (events.length > 0) {
    console.log('\n找到', events.length, '条链上提取记录:');
    for (const event of events) {
      const amount = ethers.formatEther(event.args.amount);
      const nonce = event.args.nonce.toString();
      const block = await event.getBlock();
      const tx = await event.getTransaction();
      
      console.log('  - 金额:', amount, 'EAGLE');
      console.log('    Nonce:', nonce);
      console.log('    交易哈希:', event.transactionHash);
      console.log('    区块高度:', event.blockNumber);
      console.log('    时间:', new Date(block.timestamp * 1000).toISOString());
      console.log('    Gas 使用:', tx.gasLimit.toString());
      console.log('');
    }
  } else {
    console.log('❌ 没有找到链上提取记录');
    console.log('可能原因:');
    console.log('  1. 用户从未提取过');
    console.log('  2. 提取交易还未确认');
    console.log('  3. 提取交易失败了');
  }
  
  db.close();
  console.log('\n✅ 检查完成');
  
} catch (error) {
  console.error('\n❌ 错误:', error.message);
  console.error(error);
  db.close();
  process.exit(1);
}
