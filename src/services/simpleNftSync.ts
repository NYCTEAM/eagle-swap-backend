import { ethers } from 'ethers';
import { db } from '../database';

// 简化的NFT同步服务 - 直接监听合约事件并保存到主数据库
class SimpleNFTSync {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private marketplaceContract: ethers.Contract | null = null;

  constructor() {
    // 初始化RPC连接 - 优先使用环境变量，其次自定义RPC，最后使用官方RPC作为兜底
    const rpcUrl = process.env.X_LAYER_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/';
    const fallbackRpc = 'https://rpc.xlayer.tech';
    
    try {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    } catch (e) {
        console.log(`⚠️ Primary RPC failed, using fallback: ${fallbackRpc}`);
        this.provider = new ethers.JsonRpcProvider(fallbackRpc);
    }
    
    // NFT合约ABI
    const nftABI = [
      "event NFTMinted(address indexed to, uint256 indexed tokenId, uint8 level, uint256 weight, string paymentMethod)",
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
      "function getLevelInfo(uint8 level) view returns (string, uint256, uint256, uint256, uint256, uint256, uint256, string)",
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function tokenURI(uint256 tokenId) view returns (string)"
    ];

    // 初始化NFT合约
    this.contract = new ethers.Contract(
      process.env.NFT_CONTRACT_ADDRESS || '0xC301211e0e9ADD883135eA268444649ee6c510c5',
      nftABI,
      this.provider
    );

    // 初始化 Marketplace 合约 (使用默认地址兜底)
    const marketplaceAddress = process.env.MARKETPLACE_CONTRACT_ADDRESS || '0x33d0D4a3fFC727f51d1A91d0d1eDA290193D5Df1';
    if (marketplaceAddress) {
        console.log(`🛒 Marketplace Contract initialized at: ${marketplaceAddress}`);
        const marketplaceABI = [
            "function listings(address nftAddress, uint256 tokenId) view returns (address seller, uint256 price, bool isActive)",
            "event ItemListed(address indexed seller, address indexed nftAddress, uint256 indexed tokenId, uint256 price)",
            "event ItemCanceled(address indexed seller, address indexed nftAddress, uint256 indexed tokenId)",
            "event ItemBought(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 price)"
        ];
        this.marketplaceContract = new ethers.Contract(marketplaceAddress, marketplaceABI, this.provider);
    }

    // 使用主数据库
    this.initDatabase();
  }

  // 初始化数据库表
  private initDatabase() {
    // NFT所有权表 - 简化版
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_nfts (
        token_id INTEGER PRIMARY KEY,
        owner_address TEXT NOT NULL,
        level INTEGER NOT NULL,
        weight REAL NOT NULL,
        minted_at DATETIME NOT NULL,
        payment_method TEXT,
        is_listed INTEGER DEFAULT 0,
        listing_price REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 尝试添加字段 (如果不存在)
    try {
      db.exec(`ALTER TABLE user_nfts ADD COLUMN is_listed INTEGER DEFAULT 0`);
    } catch (e) {}
    
    try {
      db.exec(`ALTER TABLE user_nfts ADD COLUMN listing_price REAL DEFAULT 0`);
    } catch (e) {}

    // NFT等级库存表 - 简化版
    db.exec(`
      CREATE TABLE IF NOT EXISTS nft_inventory (
        level INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        weight REAL NOT NULL,
        price_usdt REAL NOT NULL,
        total_supply INTEGER NOT NULL,
        minted INTEGER DEFAULT 0,
        available INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 同步状态表 (用于增量同步)
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_user_nfts_owner ON user_nfts(owner_address);
      CREATE INDEX IF NOT EXISTS idx_user_nfts_level ON user_nfts(level);
    `);

    console.log('✅ NFT tables initialized in main database (eagle-swap.db)');
  }

  // 启动同步服务
  async start() {
    console.log('🚀 Starting Simple NFT Sync Service...');

    try {
      // 1. 同步NFT等级信息
      await this.syncLevels();

      // 2. 智能扫描历史事件 (增量或全量)
      await this.smartScanEvents();

      // 3. 同步所有NFT的挂单状态 (Marketplace)
      this.syncMarketplaceListings(); // 不等待，后台运行

      // 4. 监听新的NFT铸造事件
      this.contract.on('NFTMinted', async (to, tokenId, level, weight, paymentMethod, event) => {
        console.log(`🎉 NFT Minted: #${tokenId} to ${to}, Level ${level}`);
        await this.handleMintEvent(to, tokenId, level, weight, paymentMethod, event);
        this.updateSyncState(event.blockNumber);
      });

      // 5. 监听NFT转移事件
      this.contract.on('Transfer', async (from, to, tokenId, event) => {
        console.log(`🔄 NFT Transfer: #${tokenId} from ${from} to ${to}`);
        await this.handleTransferEvent(from, to, tokenId);
        this.updateSyncState(event.blockNumber);
      });

      // 6. 监听 Marketplace 事件 (如果已初始化)
      if (this.marketplaceContract) {
          console.log('👂 Listening to Marketplace events...');
          
          this.marketplaceContract.on('ItemListed', async (seller, nftAddress, tokenId, price, event) => {
              console.log(`📢 Item Listed: #${tokenId} by ${seller} for ${ethers.formatUnits(price, 6)} USDT`);
              await this.handleItemListed(tokenId, price);
          });

          this.marketplaceContract.on('ItemCanceled', async (seller, nftAddress, tokenId, event) => {
              console.log(`📢 Item Canceled: #${tokenId} by ${seller}`);
              await this.handleItemCanceled(tokenId);
          });

          // ItemBought 不需要单独处理，因为会触发 Transfer 事件，handleTransferEvent 会处理所有权变更
      }

      console.log('✅ Simple NFT Sync Service started successfully');
    } catch (error) {
      console.error('❌ Failed to start Simple NFT Sync Service:', error);
    }
  }

  // 智能扫描事件 (替代旧的 scanHistoricalEvents)
  private async smartScanEvents() {
    console.log('🧠 Starting Smart Scan...');
    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      // 获取上次同步的区块高度
      const lastSyncedRow = db.prepare("SELECT value FROM sync_state WHERE key = 'last_synced_block'").get() as { value: string };
      const lastSyncedBlock = lastSyncedRow ? parseInt(lastSyncedRow.value) : 0;
      
      // 合约部署的大致区块 (X Layer Mainnet 早期区块作为兜底)
      // 如果从未同步过，从 2,000,000 开始 (假设合约在此之后部署，节省时间)
      const DEPLOY_BLOCK = 2000000; 
      
      let fromBlock = lastSyncedBlock > 0 ? lastSyncedBlock + 1 : DEPLOY_BLOCK;
      
      // 如果 fromBlock > currentBlock，说明节点落后或重置，回退到 scanBlocks 逻辑
      if (fromBlock > currentBlock) {
          fromBlock = Math.max(currentBlock - 100000, 0);
      }

      console.log(`📊 Scanning range: ${fromBlock.toLocaleString()} -> ${currentBlock.toLocaleString()} (${currentBlock - fromBlock} blocks)`);

      if (fromBlock >= currentBlock) {
          console.log('✅ Already up to date.');
          return;
      }

      // 分批扫描，避免 RPC 超时
      const BATCH_SIZE = 50000;
      for (let i = fromBlock; i <= currentBlock; i += BATCH_SIZE) {
          const toBlock = Math.min(i + BATCH_SIZE - 1, currentBlock);
          console.log(`  ↳ Batch: ${i.toLocaleString()} -> ${toBlock.toLocaleString()}`);
          
          await this.scanBatch(i, toBlock);
          
          // 更新同步状态
          this.updateSyncState(toBlock);
      }
      
      console.log('✅ Smart Scan completed');
    } catch (error) {
      console.error('❌ Error in smart scan:', error);
    }
  }

  // 批量扫描内部逻辑
  private async scanBatch(fromBlock: number, toBlock: number) {
      // 扫描NFTMinted事件
      const mintFilter = this.contract.filters.NFTMinted();
      const mintEvents = await this.contract.queryFilter(mintFilter, fromBlock, toBlock);
      for (const event of mintEvents) {
        if ('args' in event) {
          const { to, tokenId, level, weight, paymentMethod } = event.args;
          const existing = db.prepare('SELECT token_id FROM user_nfts WHERE token_id = ?').get(Number(tokenId));
          if (!existing) {
            await this.handleMintEvent(to, tokenId, level, weight, paymentMethod, event);
          }
        }
      }
      
      // 扫描Transfer事件
      const transferFilter = this.contract.filters.Transfer();
      const transferEvents = await this.contract.queryFilter(transferFilter, fromBlock, toBlock);
      for (const event of transferEvents) {
        if ('args' in event) {
          const { from, to, tokenId } = event.args;
          if (from !== '0x0000000000000000000000000000000000000000') {
            await this.handleTransferEvent(from, to, tokenId);
          }
        }
      }
  }

  // 更新同步状态
  private updateSyncState(blockNumber: number) {
      try {
          db.prepare("INSERT OR REPLACE INTO sync_state (key, value, updated_at) VALUES ('last_synced_block', ?, CURRENT_TIMESTAMP)")
            .run(blockNumber.toString());
      } catch(e) {
          console.error('Failed to update sync state', e);
      }
  }

  // 同步所有NFT的挂单状态
  private async syncMarketplaceListings() {
    if (!this.marketplaceContract) return;

    console.log('🏪 Syncing marketplace listings...');
    try {
        const nftAddress = await this.contract.getAddress();
        
        const nfts = db.prepare('SELECT token_id FROM user_nfts').all() as { token_id: number }[];
        console.log(`Checking ${nfts.length} NFTs for marketplace listings...`);

        for (const nft of nfts) {
            try {
                const listing = await this.marketplaceContract.listings(nftAddress, nft.token_id);
                
                if (listing[2]) { // isActive
                    const price = Number(ethers.formatUnits(listing[1], 6)); 
                    
                    db.prepare(`
                        UPDATE user_nfts 
                        SET is_listed = 1, listing_price = ?
                        WHERE token_id = ?
                    `).run(price, nft.token_id);
                    
                    console.log(`✅ Synced listing for #${nft.token_id}: ${price} USDT`);
                } else {
                    db.prepare(`
                        UPDATE user_nfts 
                        SET is_listed = 0, listing_price = 0
                        WHERE token_id = ? AND is_listed = 1
                    `).run(nft.token_id);
                }
                
                await new Promise(r => setTimeout(r, 100));
                
            } catch (e) {
                console.error(`Failed to check listing for #${nft.token_id}:`, e);
            }
        }
        console.log('✅ Marketplace listings sync completed');
    } catch (error) {
        console.error('❌ Error syncing marketplace listings:', error);
    }
  }

  // 同步NFT等级信息
  private async syncLevels() {
    console.log('📊 Syncing NFT levels...');

    for (let level = 1; level <= 7; level++) {
      try {
        const info = await this.contract.getLevelInfo(level);
        
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO nft_inventory 
          (level, name, weight, price_usdt, total_supply, minted, available, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        const weight = Number(info[1]) / 10; // 合约权重除以10
        const priceUSDT = Number(info[2]) / 1e6; // USDT 6位小数
        const supply = Number(info[4]);
        const minted = Number(info[5]);
        const available = Number(info[6]);

        stmt.run(level, info[0], weight, priceUSDT, supply, minted, available);
        
        console.log(`✅ Level ${level}: ${info[0]}, Weight: ${weight}, Available: ${available}`);
      } catch (error) {
        console.error(`❌ Error syncing level ${level}:`, error);
      }
    }
  }

  // 处理NFT铸造事件
  private async handleMintEvent(to: string, tokenId: bigint, level: number, weight: bigint, paymentMethod: string, event: any) {
    try {
      const actualWeight = Number(weight) / 10; 
      const blockTimestamp = await this.getBlockTimestamp(event.blockNumber);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO user_nfts 
        (token_id, owner_address, level, weight, minted_at, payment_method)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        Number(tokenId),
        to.toLowerCase(),
        level,
        actualWeight,
        new Date(blockTimestamp * 1000).toISOString(),
        paymentMethod
      );

      await this.updateInventory(level);

      console.log(`✅ Saved NFT #${tokenId} for ${to}, Level ${level}, Weight ${actualWeight}`);
    } catch (error) {
      console.error('❌ Error handling mint event:', error);
    }
  }

  // 处理上架事件
  private async handleItemListed(tokenId: bigint, price: bigint) {
      try {
          const priceUSDT = Number(ethers.formatUnits(price, 6));
          const stmt = db.prepare(`
            UPDATE user_nfts 
            SET is_listed = 1, listing_price = ?
            WHERE token_id = ?
          `);
          stmt.run(priceUSDT, Number(tokenId));
          console.log(`✅ Updated DB: NFT #${tokenId} is listed for ${priceUSDT} USDT`);
      } catch (error) {
          console.error('❌ Error handling ItemListed:', error);
      }
  }

  // 处理取消上架事件
  private async handleItemCanceled(tokenId: bigint) {
      try {
          const stmt = db.prepare(`
            UPDATE user_nfts 
            SET is_listed = 0, listing_price = 0
            WHERE token_id = ?
          `);
          stmt.run(Number(tokenId));
          console.log(`✅ Updated DB: NFT #${tokenId} listing canceled`);
      } catch (error) {
          console.error('❌ Error handling ItemCanceled:', error);
      }
  }

  // 处理NFT转移事件
  private async handleTransferEvent(from: string, to: string, tokenId: bigint) {
    try {
      const normalizedTo = to.toLowerCase();
      
      // 只要发生 Transfer，就更新 owner 并重置挂单状态
      const stmt = db.prepare(`
        UPDATE user_nfts 
        SET owner_address = ?, is_listed = 0, listing_price = 0
        WHERE token_id = ?
      `);
      stmt.run(normalizedTo, Number(tokenId));
      
      console.log(`✅ Updated NFT #${tokenId} owner: ${from} → ${to} (Listing reset)`);
      
    } catch (error) {
      console.error('❌ Error handling transfer event:', error);
    }
  }

  // 更新库存数量
  private async updateInventory(level: number) {
    try {
      const info = await this.contract.getLevelInfo(level);
      const minted = Number(info[5]);
      const available = Number(info[6]);

      const stmt = db.prepare(`
        UPDATE nft_inventory 
        SET minted = ?, available = ?, updated_at = CURRENT_TIMESTAMP
        WHERE level = ?
      `);

      stmt.run(minted, available, level);
      
      console.log(`✅ Updated inventory Level ${level}: Minted ${minted}, Available ${available}`);
    } catch (error) {
      console.error(`❌ Error updating inventory for level ${level}:`, error);
    }
  }

  // 获取区块时间戳
  private async getBlockTimestamp(blockNumber: number): Promise<number> {
    try {
      const block = await this.provider.getBlock(blockNumber);
      return block?.timestamp || Math.floor(Date.now() / 1000);
    } catch (error) {
      console.error('❌ Error getting block timestamp:', error);
      return Math.floor(Date.now() / 1000);
    }
  }

  // 获取用户NFT列表
  getUserNFTs(address: string) {
    const normalizedAddress = address.toLowerCase();
    console.log(`🔍 [getUserNFTs] Querying for address: ${normalizedAddress}`);
    
    const stmt = db.prepare(`
      SELECT n.*, i.name, i.price_usdt
      FROM user_nfts n
      LEFT JOIN nft_inventory i ON n.level = i.level
      WHERE n.owner_address = ?
      ORDER BY n.token_id DESC
    `);

    const results = stmt.all(normalizedAddress);
    console.log(`📊 [getUserNFTs] Found ${results.length} NFTs in database`);
    
    return results;
  }

  // 获取NFT库存信息
  getInventory() {
    const stmt = db.prepare(`
      SELECT * FROM nft_inventory 
      ORDER BY level ASC
    `);

    return stmt.all();
  }

  // 停止服务
  stop() {
    this.contract.removeAllListeners();
    // 注意：不关闭主数据库，因为其他服务也在使用
    console.log('🛑 Simple NFT Sync Service stopped');
  }
}

export const simpleNftSync = new SimpleNFTSync();
