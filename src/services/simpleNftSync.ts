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

  // ... (initDatabase remains same)

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

  // ... (syncMarketplaceListings remains same)

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

  // 处理NFT转移事件 (修正版)
  private async handleTransferEvent(from: string, to: string, tokenId: bigint) {
    try {
      const normalizedTo = to.toLowerCase();
      const normalizedFrom = from.toLowerCase();
      
      // 只要发生 Transfer，就更新 owner 并重置挂单状态
      // (因为如果是通过 Marketplace 购买，是从 Seller -> Buyer，属于 Transfer)
      // (如果是普通转账，也是 Transfer)
      
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
