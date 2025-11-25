import { ethers } from 'ethers';
import { db } from '../database';

// 简化的NFT同步服务 - 直接监听合约事件并保存到主数据库
class SimpleNFTSync {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private marketplaceContract: ethers.Contract | null = null;

  constructor() {
    // 初始化RPC连接 - 使用你的HTTPS RPC1
    this.provider = new ethers.JsonRpcProvider(process.env.X_LAYER_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/');
    
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

    // 初始化 Marketplace 合约 (如果地址存在)
    const marketplaceAddress = process.env.MARKETPLACE_CONTRACT_ADDRESS;
    if (marketplaceAddress) {
        const marketplaceABI = [
            "function listings(address nftAddress, uint256 tokenId) view returns (address seller, uint256 price, bool isActive)"
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

      // 2. 扫描历史NFT事件 (重要：找到用户已购买的NFT)
      await this.scanHistoricalEvents();

      // 3. 同步所有NFT的挂单状态 (Marketplace)
      this.syncMarketplaceListings(); // 不等待，后台运行

      // 4. 监听新的NFT铸造事件
      this.contract.on('NFTMinted', async (to, tokenId, level, weight, paymentMethod, event) => {
        console.log(`🎉 NFT Minted: #${tokenId} to ${to}, Level ${level}`);
        await this.handleMintEvent(to, tokenId, level, weight, paymentMethod, event);
      });

      // 5. 监听NFT转移事件
      this.contract.on('Transfer', async (from, to, tokenId, event) => {
        console.log(`🔄 NFT Transfer: #${tokenId} from ${from} to ${to}`);
        await this.handleTransferEvent(from, to, tokenId);
      });

      console.log('✅ Simple NFT Sync Service started successfully');
    } catch (error) {
      console.error('❌ Failed to start Simple NFT Sync Service:', error);
    }
  }

  // 同步所有NFT的挂单状态
  private async syncMarketplaceListings() {
    if (!this.marketplaceContract) return;

    console.log('🏪 Syncing marketplace listings...');
    try {
        const nftAddress = await this.contract.getAddress();
        
        // 获取所有NFT
        const nfts = db.prepare('SELECT token_id FROM user_nfts').all() as { token_id: number }[];
        console.log(`Checking ${nfts.length} NFTs for marketplace listings...`);

        for (const nft of nfts) {
            try {
                const listing = await this.marketplaceContract.listings(nftAddress, nft.token_id);
                
                if (listing[2]) { // isActive
                    const price = Number(ethers.formatUnits(listing[1], 6)); // USDT 6 decimals
                    
                    db.prepare(`
                        UPDATE user_nfts 
                        SET is_listed = 1, listing_price = ?
                        WHERE token_id = ?
                    `).run(price, nft.token_id);
                    
                    console.log(`✅ Synced listing for #${nft.token_id}: ${price} USDT`);
                } else {
                    // 确保非挂单状态正确
                    db.prepare(`
                        UPDATE user_nfts 
                        SET is_listed = 0, listing_price = 0
                        WHERE token_id = ? AND is_listed = 1
                    `).run(nft.token_id);
                }
                
                // 稍微延时避免请求过快
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

  // 扫描历史NFT事件 - 找到已存在的NFT购买记录
  private async scanHistoricalEvents() {
    console.log('🔍 Scanning historical NFT events...');
    
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const scanBlocks = 50000; // 扫描最近50,000个区块
      const fromBlock = Math.max(currentBlock - scanBlocks, 0);
      
      console.log(`📊 Scanning from block ${fromBlock.toLocaleString()} to ${currentBlock.toLocaleString()}`);
      
      // 扫描NFTMinted事件
      const mintFilter = this.contract.filters.NFTMinted();
      const mintEvents = await this.contract.queryFilter(mintFilter, fromBlock, currentBlock);
      
      console.log(`🎉 Found ${mintEvents.length} historical NFT mint events`);
      
      for (const event of mintEvents) {
        // 类型检查：确保是EventLog而不是Log
        if ('args' in event) {
          const { to, tokenId, level, weight, paymentMethod } = event.args;
          console.log(`📝 Processing historical mint: NFT #${tokenId} to ${to}, Level ${level}`);
          
          // 检查是否已存在于数据库
          const existingStmt = db.prepare('SELECT token_id FROM user_nfts WHERE token_id = ?');
          const existing = existingStmt.get(Number(tokenId));
          
          if (!existing) {
            await this.handleMintEvent(to, tokenId, level, weight, paymentMethod, event);
            console.log(`✅ Added historical NFT #${tokenId} to database`);
          }
        }
      }
      
      // 扫描Transfer事件 (可能有转账)
      const transferFilter = this.contract.filters.Transfer();
      const transferEvents = await this.contract.queryFilter(transferFilter, fromBlock, currentBlock);
      
      console.log(`📨 Found ${transferEvents.length} historical transfer events`);
      
      for (const event of transferEvents) {
        // 类型检查：确保是EventLog而不是Log
        if ('args' in event) {
          const { from, to, tokenId } = event.args;
          
          // 只处理非零地址的转账 (跳过铸造事件，因为已经在上面处理了)
          if (from !== '0x0000000000000000000000000000000000000000') {
            console.log(`🔄 Processing historical transfer: NFT #${tokenId} from ${from} to ${to}`);
            await this.handleTransferEvent(from, to, tokenId);
          }
        }
      }
      
      console.log('✅ Historical event scan completed');
      
    } catch (error) {
      console.error('❌ Error scanning historical events:', error);
    }
  }

  // 处理NFT铸造事件
  private async handleMintEvent(to: string, tokenId: bigint, level: number, weight: bigint, paymentMethod: string, event: any) {
    try {
      const actualWeight = Number(weight) / 10; // 权重除以10
      const blockTimestamp = await this.getBlockTimestamp(event.blockNumber);

      // 保存NFT所有权
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

      // 更新库存
      await this.updateInventory(level);

      console.log(`✅ Saved NFT #${tokenId} for ${to}, Level ${level}, Weight ${actualWeight}`);
    } catch (error) {
      console.error('❌ Error handling mint event:', error);
    }
  }

  // 处理NFT转移事件
  private async handleTransferEvent(from: string, to: string, tokenId: bigint) {
    try {
      const marketplaceAddress = (process.env.MARKETPLACE_CONTRACT_ADDRESS || '').toLowerCase();
      const normalizedTo = to.toLowerCase();
      const normalizedFrom = from.toLowerCase();
      
      if (marketplaceAddress && normalizedTo === marketplaceAddress) {
        // Case 1: 上架 (User -> Marketplace)
        
        // 获取挂单价格
        let price = 0;
        if (this.marketplaceContract) {
            // 等待一下，确保合约状态已更新
            await new Promise(r => setTimeout(r, 2000));
            try {
                const nftAddress = await this.contract.getAddress();
                const listing = await this.marketplaceContract.listings(nftAddress, tokenId);
                if (listing[2]) { // isActive
                    price = Number(ethers.formatUnits(listing[1], 6)); // USDT 6 decimals
                    console.log(`💰 Fetched listing price for #${tokenId}: ${price} USDT`);
                }
            } catch(e) {
                console.error('⚠️ Failed to fetch listing price:', e);
            }
        }

        // 标记为已挂单，但保留 owner 为原用户
        const stmt = db.prepare(`
          UPDATE user_nfts 
          SET is_listed = 1, listing_price = ?
          WHERE token_id = ?
        `);
        stmt.run(price, Number(tokenId));
        console.log(`✅ NFT #${tokenId} listed on Marketplace (Owner kept as ${from} for rewards)`);
        
      } else if (marketplaceAddress && normalizedFrom === marketplaceAddress) {
        // Case 2: 购买或取消 (Marketplace -> Buyer/User)
        // 取消挂单标记，更新 owner 为新接收者
        const stmt = db.prepare(`
          UPDATE user_nfts 
          SET owner_address = ?, is_listed = 0, listing_price = 0
          WHERE token_id = ?
        `);
        stmt.run(normalizedTo, Number(tokenId));
        console.log(`✅ NFT #${tokenId} sold/returned from Marketplace to ${to}`);
        
      } else {
        // Case 3: 普通转账
        // 更新NFT所有者
        const stmt = db.prepare(`
          UPDATE user_nfts 
          SET owner_address = ?, is_listed = 0, listing_price = 0
          WHERE token_id = ?
        `);
        stmt.run(normalizedTo, Number(tokenId));
        console.log(`✅ Updated NFT #${tokenId} owner: ${from} → ${to}`);
      }
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
