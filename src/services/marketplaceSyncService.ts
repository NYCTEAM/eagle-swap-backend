/**
 * Marketplace 同步服务
 * 从 Marketplace 合约同步挂单数据到数据库
 */

import { ethers } from 'ethers';
import { db } from '../database/index.js';

// Marketplace ABI (只需要 listings 函数和事件)
const MARKETPLACE_ABI = [
  {
    "type": "function",
    "name": "listings",
    "inputs": [
      {"name": "nftAddress", "type": "address"},
      {"name": "tokenId", "type": "uint256"}
    ],
    "outputs": [
      {"name": "seller", "type": "address"},
      {"name": "price", "type": "uint256"},
      {"name": "isActive", "type": "bool"}
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "ItemListed",
    "inputs": [
      {"name": "seller", "type": "address", "indexed": true},
      {"name": "nftAddress", "type": "address", "indexed": true},
      {"name": "tokenId", "type": "uint256", "indexed": true},
      {"name": "price", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "ItemCanceled",
    "inputs": [
      {"name": "seller", "type": "address", "indexed": true},
      {"name": "nftAddress", "type": "address", "indexed": true},
      {"name": "tokenId", "type": "uint256", "indexed": true}
    ]
  },
  {
    "type": "event",
    "name": "ItemBought",
    "inputs": [
      {"name": "buyer", "type": "address", "indexed": true},
      {"name": "nftAddress", "type": "address", "indexed": true},
      {"name": "tokenId", "type": "uint256", "indexed": true},
      {"name": "price", "type": "uint256", "indexed": false}
    ]
  }
];

// 多链配置
const CHAIN_CONFIGS = [
  {
    chainId: 196,
    chainName: 'X Layer',
    rpcUrl: process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech',
    marketplaceAddress: '0x33d0D4a3fFC727f51d1A91d0d1eDA290193D5Df1',
    nftAddress: '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7',
    usdtDecimals: 6
  },
  {
    chainId: 56,
    chainName: 'BSC',
    rpcUrl: process.env.BSC_RPC_URL || 'https://rpc1.eagleswap.llc/bsc/',
    marketplaceAddress: '0x95c212b1ABa037266155F8af3CCF3DdAb64456E5',
    nftAddress: '0x3c117d186C5055071EfF91d87f2600eaF88D591D',
    usdtDecimals: 18
  }
];

export class MarketplaceSyncService {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private contracts: Map<number, ethers.Contract> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 初始化数据库表
    this.initDatabase();
    
    // 初始化 providers 和 contracts
    for (const config of CHAIN_CONFIGS) {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(config.marketplaceAddress, MARKETPLACE_ABI, provider);
      this.providers.set(config.chainId, provider);
      this.contracts.set(config.chainId, contract);
    }
  }
  
  /**
   * 初始化数据库表
   */
  private initDatabase() {
    // Marketplace 交易历史表
    db.exec(`
      CREATE TABLE IF NOT EXISTS marketplace_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        token_id INTEGER NOT NULL,
        seller_address TEXT,
        buyer_address TEXT,
        price TEXT,
        tx_hash TEXT,
        block_number INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_marketplace_history_chain ON marketplace_history(chain_id);
      CREATE INDEX IF NOT EXISTS idx_marketplace_history_token ON marketplace_history(token_id);
      CREATE INDEX IF NOT EXISTS idx_marketplace_history_seller ON marketplace_history(seller_address);
      CREATE INDEX IF NOT EXISTS idx_marketplace_history_buyer ON marketplace_history(buyer_address);
      
      -- 同步状态表
      CREATE TABLE IF NOT EXISTS marketplace_sync_state (
        chain_id INTEGER PRIMARY KEY,
        last_block INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('📊 Marketplace history table initialized');
  }
  
  /**
   * 获取最后同步的区块号
   */
  private getLastSyncedBlock(chainId: number): number {
    try {
      const result = db.prepare('SELECT last_block FROM marketplace_sync_state WHERE chain_id = ?').get(chainId) as { last_block: number } | undefined;
      return result?.last_block || 0;
    } catch {
      return 0;
    }
  }
  
  /**
   * 保存最后同步的区块号
   */
  private saveLastSyncedBlock(chainId: number, blockNumber: number) {
    db.prepare(`
      INSERT INTO marketplace_sync_state (chain_id, last_block, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(chain_id) DO UPDATE SET last_block = ?, updated_at = CURRENT_TIMESTAMP
    `).run(chainId, blockNumber, blockNumber);
  }
  
  /**
   * 保存 Marketplace 事件到历史记录
   */
  private saveEvent(params: {
    chainId: number;
    eventType: 'listed' | 'canceled' | 'bought';
    tokenId: number;
    sellerAddress?: string;
    buyerAddress?: string;
    price?: string;
    txHash?: string;
    blockNumber?: number;
  }) {
    db.prepare(`
      INSERT INTO marketplace_history (chain_id, event_type, token_id, seller_address, buyer_address, price, tx_hash, block_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.chainId,
      params.eventType,
      params.tokenId,
      params.sellerAddress?.toLowerCase() || null,
      params.buyerAddress?.toLowerCase() || null,
      params.price || null,
      params.txHash || null,
      params.blockNumber || null
    );
  }

  /**
   * 启动同步服务
   */
  async start(intervalMs: number = 30000) {
    console.log('🛍️ Starting Marketplace Sync Service...');
    
    // 1. 先扫描历史事件
    await this.syncHistoricalEvents();
    
    // 2. 启动事件监听
    this.startEventListeners();
    
    // 3. 立即执行一次状态同步
    this.syncAllChains();
    
    // 4. 定期同步状态
    this.syncInterval = setInterval(() => {
      this.syncAllChains();
    }, intervalMs);
    
    console.log(`🛍️ Marketplace sync running every ${intervalMs / 1000}s`);
  }
  
  /**
   * 扫描历史事件
   */
  private async syncHistoricalEvents() {
    console.log('📜 Syncing historical marketplace events...');
    
    for (const config of CHAIN_CONFIGS) {
      await this.syncChainHistory(config);
    }
  }
  
  /**
   * 扫描单个链的历史事件
   */
  private async syncChainHistory(config: typeof CHAIN_CONFIGS[0]) {
    try {
      const provider = this.providers.get(config.chainId);
      const contract = this.contracts.get(config.chainId);
      if (!provider || !contract) return;
      
      const currentBlock = await provider.getBlockNumber();
      const lastSyncedBlock = this.getLastSyncedBlock(config.chainId);
      
      console.log(`   [${config.chainName}] Last synced: ${lastSyncedBlock}, Current: ${currentBlock}`);
      
      if (lastSyncedBlock >= currentBlock) {
        console.log(`   [${config.chainName}] Already up to date`);
        return;
      }
      
      const fromBlock = lastSyncedBlock > 0 ? lastSyncedBlock + 1 : Math.max(0, currentBlock - 50000);
      
      // 分批扫描
      const BATCH_SIZE = 5000;
      for (let start = fromBlock; start <= currentBlock; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE - 1, currentBlock);
        
        try {
          // ItemListed 事件
          const listedEvents = await contract.queryFilter('ItemListed', start, end);
          for (const event of listedEvents) {
            await this.processListedEvent(config, event);
          }
          
          // ItemCanceled 事件
          const canceledEvents = await contract.queryFilter('ItemCanceled', start, end);
          for (const event of canceledEvents) {
            await this.processCanceledEvent(config, event);
          }
          
          // ItemBought 事件
          const boughtEvents = await contract.queryFilter('ItemBought', start, end);
          for (const event of boughtEvents) {
            await this.processBoughtEvent(config, event);
          }
        } catch (e) {
          console.error(`   [${config.chainName}] Error scanning blocks ${start}-${end}:`, e);
        }
      }
      
      // 保存同步状态
      this.saveLastSyncedBlock(config.chainId, currentBlock);
      console.log(`   [${config.chainName}] Synced to block ${currentBlock}`);
      
    } catch (error) {
      console.error(`   [${config.chainName}] Sync error:`, error);
    }
  }
  
  /**
   * 处理 ItemListed 事件
   */
  private async processListedEvent(config: typeof CHAIN_CONFIGS[0], event: any) {
    try {
      const [seller, nftAddress, tokenId, price] = event.args;
      const txHash = event.transactionHash;
      const blockNumber = event.blockNumber;
      
      // 检查是否已存在
      const existing = db.prepare('SELECT id FROM marketplace_history WHERE tx_hash = ? AND event_type = ?').get(txHash, 'listed');
      if (existing) return;
      
      // 保存事件
      this.saveEvent({
        chainId: config.chainId,
        eventType: 'listed',
        tokenId: Number(tokenId),
        sellerAddress: seller,
        price: ethers.formatUnits(price, config.usdtDecimals),
        txHash,
        blockNumber
      });
      
      // 更新 NFT 状态
      db.prepare(`
        UPDATE nft_holders 
        SET is_listed = 1, listing_price = ?
        WHERE global_token_id = ? AND chain_id = ?
      `).run(Number(price), Number(tokenId), config.chainId);
      
      console.log(`   📥 [${config.chainName}] Listed: Token #${tokenId} at ${ethers.formatUnits(price, config.usdtDecimals)} USDT`);
    } catch (e) {
      console.error('Error processing ItemListed event:', e);
    }
  }
  
  /**
   * 处理 ItemCanceled 事件
   */
  private async processCanceledEvent(config: typeof CHAIN_CONFIGS[0], event: any) {
    try {
      const [seller, nftAddress, tokenId] = event.args;
      const txHash = event.transactionHash;
      const blockNumber = event.blockNumber;
      
      // 检查是否已存在
      const existing = db.prepare('SELECT id FROM marketplace_history WHERE tx_hash = ? AND event_type = ?').get(txHash, 'canceled');
      if (existing) return;
      
      // 保存事件
      this.saveEvent({
        chainId: config.chainId,
        eventType: 'canceled',
        tokenId: Number(tokenId),
        sellerAddress: seller,
        txHash,
        blockNumber
      });
      
      // 更新 NFT 状态
      db.prepare(`
        UPDATE nft_holders 
        SET is_listed = 0, listing_price = 0
        WHERE global_token_id = ? AND chain_id = ?
      `).run(Number(tokenId), config.chainId);
      
      console.log(`   📥 [${config.chainName}] Canceled: Token #${tokenId}`);
    } catch (e) {
      console.error('Error processing ItemCanceled event:', e);
    }
  }
  
  /**
   * 处理 ItemBought 事件
   */
  private async processBoughtEvent(config: typeof CHAIN_CONFIGS[0], event: any) {
    try {
      const [buyer, nftAddress, tokenId, price] = event.args;
      const txHash = event.transactionHash;
      const blockNumber = event.blockNumber;
      
      // 检查是否已存在
      const existing = db.prepare('SELECT id FROM marketplace_history WHERE tx_hash = ? AND event_type = ?').get(txHash, 'bought');
      if (existing) return;
      
      // 保存事件
      this.saveEvent({
        chainId: config.chainId,
        eventType: 'bought',
        tokenId: Number(tokenId),
        buyerAddress: buyer,
        price: ethers.formatUnits(price, config.usdtDecimals),
        txHash,
        blockNumber
      });
      
      // 更新 NFT 状态 (所有权会由 Transfer 事件处理)
      db.prepare(`
        UPDATE nft_holders 
        SET is_listed = 0, listing_price = 0
        WHERE global_token_id = ? AND chain_id = ?
      `).run(Number(tokenId), config.chainId);
      
      console.log(`   📥 [${config.chainName}] Bought: Token #${tokenId} for ${ethers.formatUnits(price, config.usdtDecimals)} USDT`);
    } catch (e) {
      console.error('Error processing ItemBought event:', e);
    }
  }
  
  /**
   * 启动事件监听
   */
  private startEventListeners() {
    for (const config of CHAIN_CONFIGS) {
      const contract = this.contracts.get(config.chainId);
      if (!contract) continue;
      
      // ItemListed
      contract.on('ItemListed', async (seller, nftAddress, tokenId, price, event) => {
        console.log(`🛍️ [${config.chainName}] New listing: Token #${tokenId}`);
        await this.processListedEvent(config, event);
        this.saveLastSyncedBlock(config.chainId, event.log.blockNumber);
      });
      
      // ItemCanceled
      contract.on('ItemCanceled', async (seller, nftAddress, tokenId, event) => {
        console.log(`🛍️ [${config.chainName}] Listing canceled: Token #${tokenId}`);
        await this.processCanceledEvent(config, event);
        this.saveLastSyncedBlock(config.chainId, event.log.blockNumber);
      });
      
      // ItemBought
      contract.on('ItemBought', async (buyer, nftAddress, tokenId, price, event) => {
        console.log(`🛍️ [${config.chainName}] Item bought: Token #${tokenId}`);
        await this.processBoughtEvent(config, event);
        this.saveLastSyncedBlock(config.chainId, event.log.blockNumber);
      });
      
      console.log(`👂 [${config.chainName}] Listening for marketplace events...`);
    }
  }

  /**
   * 停止同步服务
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('🛍️ Marketplace Sync Service stopped');
  }

  /**
   * 同步所有链的挂单数据
   */
  async syncAllChains() {
    for (const config of CHAIN_CONFIGS) {
      try {
        await this.syncChainListings(config);
      } catch (error) {
        console.error(`❌ Error syncing ${config.chainName} marketplace:`, error);
      }
    }
  }

  /**
   * 同步单个链的挂单数据
   */
  async syncChainListings(config: typeof CHAIN_CONFIGS[0]) {
    const contract = this.contracts.get(config.chainId);
    if (!contract) return;

    // 获取该链上所有 NFT holders
    const holders = db.prepare(`
      SELECT global_token_id, owner_address 
      FROM nft_holders 
      WHERE chain_id = ?
    `).all(config.chainId) as any[];

    let updatedCount = 0;

    for (const holder of holders) {
      try {
        // 查询合约上的挂单状态
        const listing = await contract.listings(config.nftAddress, holder.global_token_id);
        const [seller, price, isActive] = listing;

        // 更新数据库
        if (isActive) {
          // 有活跃挂单
          const priceNumber = Number(price);
          db.prepare(`
            UPDATE nft_holders 
            SET is_listed = 1, listing_price = ?, owner_address = ?
            WHERE global_token_id = ? AND chain_id = ?
          `).run(priceNumber, seller.toLowerCase(), holder.global_token_id, config.chainId);
          updatedCount++;
        } else {
          // 没有挂单或已取消
          db.prepare(`
            UPDATE nft_holders 
            SET is_listed = 0, listing_price = 0
            WHERE global_token_id = ? AND chain_id = ?
          `).run(holder.global_token_id, config.chainId);
        }
      } catch (error) {
        // 单个 token 查询失败，继续下一个
        console.error(`Error checking listing for token ${holder.global_token_id}:`, error);
      }
    }

    if (updatedCount > 0) {
      console.log(`🛍️ [${config.chainName}] Synced ${updatedCount} active listings`);
    }
  }

  /**
   * 手动同步单个 token 的挂单状态
   */
  async syncTokenListing(chainId: number, tokenId: number): Promise<boolean> {
    const config = CHAIN_CONFIGS.find(c => c.chainId === chainId);
    if (!config) return false;

    const contract = this.contracts.get(chainId);
    if (!contract) return false;

    try {
      const listing = await contract.listings(config.nftAddress, tokenId);
      const [seller, price, isActive] = listing;

      if (isActive) {
        db.prepare(`
          UPDATE nft_holders 
          SET is_listed = 1, listing_price = ?, owner_address = ?
          WHERE global_token_id = ? AND chain_id = ?
        `).run(Number(price), seller.toLowerCase(), tokenId, chainId);
      } else {
        db.prepare(`
          UPDATE nft_holders 
          SET is_listed = 0, listing_price = 0
          WHERE global_token_id = ? AND chain_id = ?
        `).run(tokenId, chainId);
      }

      console.log(`🛍️ Synced token ${tokenId} on ${config.chainName}: isActive=${isActive}`);
      return true;
    } catch (error) {
      console.error(`Error syncing token ${tokenId}:`, error);
      return false;
    }
  }
}

// 导出单例
export const marketplaceSyncService = new MarketplaceSyncService();
