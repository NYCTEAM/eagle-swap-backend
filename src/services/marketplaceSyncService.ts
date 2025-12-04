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
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
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
    // 初始化 providers 和 contracts
    for (const config of CHAIN_CONFIGS) {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(config.marketplaceAddress, MARKETPLACE_ABI, provider);
      this.providers.set(config.chainId, provider);
      this.contracts.set(config.chainId, contract);
    }
  }

  /**
   * 启动同步服务
   */
  start(intervalMs: number = 30000) {
    console.log('🛍️ Starting Marketplace Sync Service...');
    
    // 立即执行一次同步
    this.syncAllChains();
    
    // 定期同步
    this.syncInterval = setInterval(() => {
      this.syncAllChains();
    }, intervalMs);
    
    console.log(`🛍️ Marketplace sync running every ${intervalMs / 1000}s`);
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
