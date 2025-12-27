import { ethers } from 'ethers';
import { db } from '../src/database';

// 链配置
const CHAINS = [
  {
    chainId: 196,
    chainName: 'X Layer',
    rpcUrl: process.env.XLAYER_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/',
    nftAddress: '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7',
    startBlock: 47700000
  },
  {
    chainId: 56,
    chainName: 'BSC',
    rpcUrl: process.env.BSC_RPC_URL || 'https://rpc1.eagleswap.llc/bsc/',
    nftAddress: '0x3c117d186C5055071EfF91d87f2600eaF88D591D',
    startBlock: 44000000
  }
];

const NFT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function nftData(uint256 tokenId) view returns (uint8 level, uint256 mintedAt, uint256 globalTokenId)"
];

async function syncTransfers() {
  console.log('🔄 开始同步 NFT Transfer 事件...\n');

  for (const chain of CHAINS) {
    console.log(`\n📊 处理 ${chain.chainName} (Chain ID: ${chain.chainId})`);
    
    try {
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
      const contract = new ethers.Contract(chain.nftAddress, NFT_ABI, provider);
      
      const currentBlock = await provider.getBlockNumber();
      console.log(`当前区块: ${currentBlock}`);
      
      // 分批查询
      const batchSize = 5000;
      let totalTransfers = 0;
      
      for (let start = chain.startBlock; start <= currentBlock; start += batchSize) {
        const end = Math.min(start + batchSize - 1, currentBlock);
        
        console.log(`  查询区块 ${start} 到 ${end}...`);
        
        const transferEvents = await contract.queryFilter(
          contract.filters.Transfer(),
          start,
          end
        );
        
        // 过滤掉 mint 事件（from = 0x0）
        const realTransfers = transferEvents.filter((e: any) => 
          'args' in e && e.args.from !== ethers.ZeroAddress
        );
        
        console.log(`  找到 ${realTransfers.length} 个转账事件`);
        
        for (const event of realTransfers) {
          if ('args' in event) {
            const { from, to, tokenId } = event.args as any;
            
            try {
              // 获取 globalTokenId
              const nftData = await contract.nftData(tokenId);
              const globalTokenId = Number(nftData.globalTokenId);
              
              // 更新数据库
              const result = db.prepare(`
                UPDATE nft_holders 
                SET owner_address = ?, updated_at = ?
                WHERE chain_id = ? AND global_token_id = ?
              `).run(
                to.toLowerCase(),
                new Date().toISOString(),
                chain.chainId,
                globalTokenId
              );
              
              if (result.changes > 0) {
                console.log(`    ✅ 更新 NFT #${globalTokenId}: ${from.slice(0, 8)}... -> ${to.slice(0, 8)}...`);
                totalTransfers++;
              }
            } catch (error) {
              console.error(`    ❌ 处理 Token #${tokenId} 失败:`, error);
            }
          }
        }
      }
      
      console.log(`\n✅ ${chain.chainName} 完成！共更新 ${totalTransfers} 个 NFT 的持有者信息`);
      
    } catch (error) {
      console.error(`❌ ${chain.chainName} 同步失败:`, error);
    }
  }
  
  console.log('\n🎉 所有链的 Transfer 事件同步完成！');
  
  // 显示统计
  console.log('\n📊 当前 NFT 持有统计:');
  const stats = db.prepare(`
    SELECT chain_name, owner_address, COUNT(*) as count
    FROM nft_holders
    GROUP BY chain_name, owner_address
    ORDER BY chain_name, count DESC
  `).all();
  
  console.table(stats);
}

// 运行同步
syncTransfers().catch(console.error);
