/**
 * 迁移旧NFT数据
 * 从 user_nfts 表迁移到 nft_holders 表
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'eagle-swap.db');

// 等级配置
const LEVEL_CONFIG = {
  1: { name: 'Micro Node', weight: 0.1 },
  2: { name: 'Mini Node', weight: 0.2 },
  3: { name: 'Standard Node', weight: 0.5 },
  4: { name: 'Advanced Node', weight: 1.0 },
  5: { name: 'Elite Node', weight: 2.0 },
  6: { name: 'Master Node', weight: 5.0 },
  7: { name: 'Ultra Node', weight: 10.0 }
};

async function checkTables() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 检查数据库表');
  console.log('='.repeat(60));
  
  const db = new Database(DB_PATH, { readonly: true });
  
  // 检查旧表
  const oldTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='user_nfts'
  `).get();
  
  if (oldTableExists) {
    const oldCount = db.prepare('SELECT COUNT(*) as count FROM user_nfts').get();
    console.log(`\n✅ 旧表 (user_nfts): ${oldCount.count} 条记录`);
    
    // 显示旧表数据
    const oldNFTs = db.prepare('SELECT * FROM user_nfts ORDER BY token_id').all();
    console.log('\n📋 旧表数据:');
    oldNFTs.forEach(nft => {
      console.log(`   Token ${nft.token_id}: ${nft.owner_address.slice(0, 10)}... Level ${nft.level}`);
    });
  } else {
    console.log('\n❌ 旧表 (user_nfts) 不存在');
  }
  
  // 检查新表
  const newTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='nft_holders'
  `).get();
  
  if (newTableExists) {
    const newCount = db.prepare('SELECT COUNT(*) as count FROM nft_holders').get();
    console.log(`\n✅ 新表 (nft_holders): ${newCount.count} 条记录`);
    
    // 显示新表数据
    const newNFTs = db.prepare('SELECT * FROM nft_holders ORDER BY global_token_id').all();
    console.log('\n📋 新表数据:');
    newNFTs.forEach(nft => {
      console.log(`   Global ${nft.global_token_id} (Local: ${nft.token_id}): ${nft.owner_address.slice(0, 10)}... Level ${nft.level} [${nft.chain_name}]`);
    });
  } else {
    console.log('\n❌ 新表 (nft_holders) 不存在');
  }
  
  db.close();
  
  return { oldTableExists: !!oldTableExists, newTableExists: !!newTableExists };
}

async function migrateData() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 开始迁移数据');
  console.log('='.repeat(60));
  
  const db = new Database(DB_PATH);
  
  try {
    // 获取旧表数据
    const oldNFTs = db.prepare('SELECT * FROM user_nfts').all();
    
    if (oldNFTs.length === 0) {
      console.log('\n⚠️  旧表没有数据，无需迁移');
      db.close();
      return;
    }
    
    console.log(`\n📊 找到 ${oldNFTs.length} 条旧记录`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const oldNFT of oldNFTs) {
      try {
        // 检查是否已存在
        const existing = db.prepare(`
          SELECT * FROM nft_holders 
          WHERE chain_id = 196 AND token_id = ?
        `).get(oldNFT.token_id);
        
        if (existing) {
          console.log(`   ⏭️  跳过 Token ${oldNFT.token_id} (已存在)`);
          skipped++;
          continue;
        }
        
        // 获取等级配置
        const levelConfig = LEVEL_CONFIG[oldNFT.level];
        if (!levelConfig) {
          console.log(`   ❌ Token ${oldNFT.token_id}: 无效的等级 ${oldNFT.level}`);
          errors++;
          continue;
        }
        
        // 插入到新表
        // 注意: 旧数据没有 global_token_id，我们使用 token_id 作为临时值
        db.prepare(`
          INSERT INTO nft_holders (
            chain_id, chain_name, contract_address, token_id, global_token_id,
            owner_address, level, weight, minted_at, payment_method,
            is_listed, listing_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          196, // X Layer
          'X Layer',
          '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7',
          oldNFT.token_id,
          oldNFT.token_id, // 临时使用 token_id 作为 global_token_id
          oldNFT.owner_address.toLowerCase(),
          oldNFT.level,
          oldNFT.weight || levelConfig.weight,
          new Date(oldNFT.minted_at).getTime() / 1000,
          oldNFT.payment_method || 'USDT',
          oldNFT.is_listed || 0,
          oldNFT.listing_price || 0
        );
        
        console.log(`   ✅ 迁移 Token ${oldNFT.token_id}: ${oldNFT.owner_address.slice(0, 10)}... Level ${oldNFT.level}`);
        migrated++;
        
      } catch (e) {
        console.error(`   ❌ Token ${oldNFT.token_id} 迁移失败:`, e.message);
        errors++;
      }
    }
    
    db.close();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 迁移结果');
    console.log('='.repeat(60));
    console.log(`   成功迁移: ${migrated}`);
    console.log(`   跳过: ${skipped}`);
    console.log(`   错误: ${errors}`);
    
    if (migrated > 0) {
      console.log('\n✅ 迁移完成！旧数据已导入到新表。');
      console.log('\n⚠️  注意: 旧数据的 global_token_id 临时使用了 token_id');
      console.log('   建议运行 quick-sync-nft.js 从链上重新同步以获取正确的 global_token_id');
    }
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    db.close();
  }
}

async function main() {
  console.log('🔄 NFT数据迁移工具\n');
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'check') {
    // 只检查，不迁移
    await checkTables();
    
  } else if (command === 'migrate') {
    // 检查并迁移
    const { oldTableExists, newTableExists } = await checkTables();
    
    if (!oldTableExists) {
      console.log('\n❌ 旧表不存在，无法迁移');
      return;
    }
    
    if (!newTableExists) {
      console.log('\n❌ 新表不存在，请先初始化数据库');
      return;
    }
    
    await migrateData();
    
  } else {
    // 显示帮助
    console.log('用法:');
    console.log('  node migrate-old-nfts.js check    # 检查两个表的数据');
    console.log('  node migrate-old-nfts.js migrate  # 迁移旧数据到新表');
    console.log('\n示例:');
    console.log('  docker exec CONTAINER_ID node /app/migrate-old-nfts.js check');
    console.log('  docker exec CONTAINER_ID node /app/migrate-old-nfts.js migrate');
  }
}

main().catch(console.error);
