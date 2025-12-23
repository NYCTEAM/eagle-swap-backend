/**
 * NFT同步诊断和修复工具
 * 检查数据库、同步服务状态，并手动触发同步
 */

const { ethers } = require('ethers');
const Database = require('better-sqlite3');
const path = require('path');

// NFT合约配置
const CONTRACTS = {
  XLAYER: {
    name: 'X Layer',
    chainId: 196,
    rpc: process.env.XLAYER_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/',
    address: process.env.XLAYER_NFT_ADDRESS || '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7',
    explorer: 'https://www.okx.com/web3/explorer/xlayer'
  },
  BSC: {
    name: 'BSC',
    chainId: 56,
    rpc: process.env.BSC_RPC_URL || 'https://rpc1.eagleswap.llc/bsc/',
    address: process.env.BSC_NFT_ADDRESS || '0x3c117d186C5055071EfF91d87f2600eaF88D591D',
    explorer: 'https://bscscan.com'
  }
};

// NFT合约ABI
const NFT_ABI = [
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function nftData(uint256 tokenId) view returns (uint8 level, uint256 mintedAt, uint256 globalTokenId)',
  'function totalMintedGlobal() view returns (uint256)',
  'event NFTMinted(address indexed to, uint256 indexed localTokenId, uint256 indexed globalTokenId, uint8 level, uint256 weight, string paymentMethod)'
];

// 数据库路径
const DB_PATH = path.join(process.cwd(), 'data', 'eagle-swap.db');

async function checkDatabase() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 检查数据库状态');
  console.log('='.repeat(60));
  
  try {
    const db = new Database(DB_PATH, { readonly: true });
    
    // 检查表是否存在
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('nft_holders', 'nft_level_stats', 'nft_global_stats')
    `).all();
    
    console.log('\n📋 数据库表:');
    tables.forEach(t => console.log(`   ✅ ${t.name}`));
    
    if (tables.length < 3) {
      console.log('\n⚠️  警告: 缺少必要的表！');
      return false;
    }
    
    // 检查NFT持有者数据
    const holders = db.prepare('SELECT COUNT(*) as count FROM nft_holders').get();
    console.log(`\n👥 NFT持有者记录: ${holders.count}`);
    
    // 检查等级统计
    const levelStats = db.prepare('SELECT * FROM nft_level_stats ORDER BY level').all();
    console.log('\n📊 等级统计:');
    levelStats.forEach(stat => {
      console.log(`   Level ${stat.level}: ${stat.minted_count}/${stat.max_supply} (${stat.level_name})`);
    });
    
    // 检查全局统计
    const globalStats = db.prepare('SELECT * FROM nft_global_stats WHERE id = 1').get();
    console.log('\n🌍 全局统计:');
    console.log(`   总铸造数: ${globalStats.total_minted}`);
    console.log(`   最大供应: ${globalStats.max_supply}`);
    console.log(`   最后同步: ${globalStats.last_sync_time}`);
    
    // 检查最近的NFT
    const recentNFTs = db.prepare(`
      SELECT * FROM nft_holders 
      ORDER BY minted_at DESC 
      LIMIT 5
    `).all();
    
    console.log('\n🆕 最近的NFT (数据库):');
    recentNFTs.forEach(nft => {
      console.log(`   Token ${nft.global_token_id} (Local: ${nft.token_id})`);
      console.log(`      Owner: ${nft.owner_address}`);
      console.log(`      Level: ${nft.level}`);
      console.log(`      Chain: ${nft.chain_name}`);
      console.log(`      Time: ${new Date(nft.minted_at * 1000).toLocaleString()}`);
    });
    
    db.close();
    return true;
    
  } catch (error) {
    console.error('\n❌ 数据库错误:', error.message);
    return false;
  }
}

async function checkChainData(chainConfig) {
  console.log('\n' + '='.repeat(60));
  console.log(`🔗 检查链上数据: ${chainConfig.name}`);
  console.log('='.repeat(60));
  
  try {
    const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
    const contract = new ethers.Contract(chainConfig.address, NFT_ABI, provider);
    
    console.log(`\n📋 合约地址: ${chainConfig.address}`);
    
    // 获取总供应量
    const totalSupply = await contract.totalSupply();
    console.log(`📊 链上总供应: ${totalSupply.toString()}`);
    
    // 获取全局铸造数
    const totalMintedGlobal = await contract.totalMintedGlobal();
    console.log(`🌍 全局铸造数: ${totalMintedGlobal.toString()}`);
    
    // 获取最近的NFT
    console.log('\n🆕 最近的NFT (链上):');
    const count = Number(totalSupply);
    const start = Math.max(0, count - 5);
    
    for (let i = start; i < count; i++) {
      try {
        const tokenId = await contract.tokenByIndex(i);
        const owner = await contract.ownerOf(tokenId);
        const nftData = await contract.nftData(tokenId);
        
        console.log(`   Token ${tokenId.toString()}`);
        console.log(`      Owner: ${owner}`);
        console.log(`      Level: ${nftData.level}`);
        console.log(`      Global ID: ${nftData.globalTokenId.toString()}`);
        console.log(`      Minted: ${new Date(Number(nftData.mintedAt) * 1000).toLocaleString()}`);
      } catch (e) {
        console.log(`   Token ${i}: 读取失败`);
      }
    }
    
    return { totalSupply: Number(totalSupply), totalMintedGlobal: Number(totalMintedGlobal) };
    
  } catch (error) {
    console.error(`\n❌ ${chainConfig.name} 错误:`, error.message);
    return null;
  }
}

async function syncNFTData(chainConfig, userAddress = null) {
  console.log('\n' + '='.repeat(60));
  console.log(`🔄 同步NFT数据: ${chainConfig.name}`);
  console.log('='.repeat(60));
  
  try {
    const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
    const contract = new ethers.Contract(chainConfig.address, NFT_ABI, provider);
    const db = new Database(DB_PATH);
    
    const totalSupply = await contract.totalSupply();
    const count = Number(totalSupply);
    
    console.log(`\n📊 开始同步 ${count} 个NFT...`);
    
    let synced = 0;
    let updated = 0;
    
    for (let i = 0; i < count; i++) {
      try {
        const tokenId = await contract.tokenByIndex(i);
        const owner = await contract.ownerOf(tokenId);
        const nftData = await contract.nftData(tokenId);
        
        // 检查是否已存在
        const existing = db.prepare(`
          SELECT * FROM nft_holders 
          WHERE chain_id = ? AND token_id = ?
        `).get(chainConfig.chainId, tokenId.toString());
        
        if (existing) {
          // 更新所有者
          if (existing.owner_address.toLowerCase() !== owner.toLowerCase()) {
            db.prepare(`
              UPDATE nft_holders 
              SET owner_address = ?, updated_at = ?
              WHERE chain_id = ? AND token_id = ?
            `).run(owner.toLowerCase(), Math.floor(Date.now() / 1000), chainConfig.chainId, tokenId.toString());
            updated++;
          }
        } else {
          // 插入新记录
          db.prepare(`
            INSERT INTO nft_holders (
              chain_id, chain_name, contract_address, token_id, global_token_id,
              owner_address, level, weight, minted_at, payment_method
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            chainConfig.chainId,
            chainConfig.name,
            chainConfig.address.toLowerCase(),
            tokenId.toString(),
            nftData.globalTokenId.toString(),
            owner.toLowerCase(),
            nftData.level,
            0, // weight需要从level配置读取
            Number(nftData.mintedAt),
            'USDT'
          );
          synced++;
        }
        
        if ((i + 1) % 10 === 0) {
          console.log(`   进度: ${i + 1}/${count}`);
        }
        
      } catch (e) {
        console.error(`   ❌ Token ${i} 同步失败:`, e.message);
      }
    }
    
    db.close();
    
    console.log(`\n✅ 同步完成!`);
    console.log(`   新增: ${synced}`);
    console.log(`   更新: ${updated}`);
    
    return true;
    
  } catch (error) {
    console.error(`\n❌ 同步失败:`, error.message);
    return false;
  }
}

async function checkUserNFTs(userAddress) {
  console.log('\n' + '='.repeat(60));
  console.log(`👤 检查用户NFT: ${userAddress}`);
  console.log('='.repeat(60));
  
  try {
    const db = new Database(DB_PATH, { readonly: true });
    
    const userNFTs = db.prepare(`
      SELECT h.*, l.level_name, l.weight
      FROM nft_holders h
      LEFT JOIN nft_level_stats l ON h.level = l.level
      WHERE LOWER(h.owner_address) = LOWER(?)
      ORDER BY h.minted_at DESC
    `).all(userAddress);
    
    console.log(`\n📊 找到 ${userNFTs.length} 个NFT:`);
    
    userNFTs.forEach(nft => {
      console.log(`\n   Token ${nft.global_token_id} (Local: ${nft.token_id})`);
      console.log(`      Chain: ${nft.chain_name}`);
      console.log(`      Level: ${nft.level} - ${nft.level_name}`);
      console.log(`      Weight: ${nft.weight}`);
      console.log(`      Minted: ${new Date(nft.minted_at * 1000).toLocaleString()}`);
    });
    
    db.close();
    
  } catch (error) {
    console.error('\n❌ 查询失败:', error.message);
  }
}

async function main() {
  console.log('🔍 NFT同步诊断和修复工具\n');
  
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args[1];
  
  if (command === 'check-db') {
    // 检查数据库
    await checkDatabase();
    
  } else if (command === 'check-chain') {
    // 检查链上数据
    const chain = param?.toUpperCase() || 'XLAYER';
    const chainConfig = CONTRACTS[chain];
    if (!chainConfig) {
      console.error('❌ 无效的链:', param);
      console.log('可用的链: XLAYER, BSC');
      return;
    }
    await checkChainData(chainConfig);
    
  } else if (command === 'sync') {
    // 同步数据
    const chain = param?.toUpperCase() || 'ALL';
    
    if (chain === 'ALL') {
      for (const [key, chainConfig] of Object.entries(CONTRACTS)) {
        await syncNFTData(chainConfig);
      }
    } else {
      const chainConfig = CONTRACTS[chain];
      if (!chainConfig) {
        console.error('❌ 无效的链:', param);
        console.log('可用的链: XLAYER, BSC, ALL');
        return;
      }
      await syncNFTData(chainConfig);
    }
    
  } else if (command === 'check-user') {
    // 检查用户NFT
    if (!param) {
      console.error('❌ 请提供用户地址');
      console.log('用法: node diagnose-nft-sync.js check-user 0x...');
      return;
    }
    await checkUserNFTs(param);
    
  } else if (command === 'full-check') {
    // 完整检查
    console.log('🔍 执行完整检查...\n');
    
    // 1. 检查数据库
    const dbOk = await checkDatabase();
    
    if (!dbOk) {
      console.log('\n❌ 数据库检查失败，请先修复数据库');
      return;
    }
    
    // 2. 检查所有链
    for (const [key, chainConfig] of Object.entries(CONTRACTS)) {
      await checkChainData(chainConfig);
    }
    
    // 3. 如果提供了用户地址，检查用户NFT
    if (param) {
      await checkUserNFTs(param);
    }
    
  } else {
    // 显示帮助
    console.log('用法:');
    console.log('  node diagnose-nft-sync.js check-db              # 检查数据库');
    console.log('  node diagnose-nft-sync.js check-chain [CHAIN]  # 检查链上数据 (XLAYER/BSC)');
    console.log('  node diagnose-nft-sync.js sync [CHAIN]         # 同步NFT数据 (XLAYER/BSC/ALL)');
    console.log('  node diagnose-nft-sync.js check-user [ADDRESS] # 检查用户NFT');
    console.log('  node diagnose-nft-sync.js full-check [ADDRESS] # 完整检查');
    console.log('\n示例:');
    console.log('  node diagnose-nft-sync.js full-check 0x4af7...1e5b');
    console.log('  node diagnose-nft-sync.js sync BSC');
    console.log('  node diagnose-nft-sync.js check-user 0x4af7...1e5b');
  }
}

main().catch(console.error);
