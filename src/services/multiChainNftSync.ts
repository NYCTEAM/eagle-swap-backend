import { ethers } from 'ethers';
import { db } from '../database';

// 链配置接口
interface ChainConfig {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  nftAddress: string;
  startBlock?: number;
}

// 支持的链配置
const CHAIN_CONFIGS: ChainConfig[] = [
  {
    chainId: 196,
    chainName: 'X Layer',
    rpcUrl: process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech',
    nftAddress: process.env.XLAYER_NFT_ADDRESS || '0x8d3FBe540CBe8189333A1758cE3801067A023809',
    startBlock: 0
  },
  {
    chainId: 56,
    chainName: 'BSC',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    nftAddress: process.env.BSC_NFT_ADDRESS || '0xB6966D11898D7c6bC0cC942C013e314e2b4C4d15',
    startBlock: 0
  }
];

// 多链NFT同步服务
class MultiChainNFTSync {
  private chainSyncs: Map<number, ChainSync> = new Map();

  constructor() {
    this.initDatabase();
    this.initChainSyncs();
  }

  // 初始化数据库表
  private initDatabase() {
    // 添加 chain_id 字段到 user_nfts 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_nfts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id INTEGER NOT NULL,
        token_id INTEGER NOT NULL,
        owner_address TEXT NOT NULL,
        level INTEGER NOT NULL,
        weight REAL NOT NULL,
        minted_at DATETIME NOT NULL,
        payment_method TEXT,
        is_listed INTEGER DEFAULT 0,
        listing_price REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chain_id, token_id)
      )
    `);

    // 尝试添加 chain_id 字段（如果表已存在）
    try {
      db.exec(`ALTER TABLE user_nfts ADD COLUMN chain_id INTEGER DEFAULT 196`);
      console.log('✅ Added chain_id column to user_nfts table');
    } catch (e) {
      // 字段已存在，忽略
    }

    // NFT库存表
    db.exec(`
      CREATE TABLE IF NOT EXISTS nft_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id INTEGER NOT NULL,
        level INTEGER NOT NULL,
        total_minted INTEGER DEFAULT 0,
        total_supply INTEGER NOT NULL,
        available INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chain_id, level)
      )
    `);

    // 同步状态表
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_status (
        chain_id INTEGER PRIMARY KEY,
        chain_name TEXT NOT NULL,
        last_synced_block INTEGER DEFAULT 0,
        last_sync_time DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Multi-chain NFT database initialized');
  }

  // 初始化各链的同步服务
  private initChainSyncs() {
    for (const config of CHAIN_CONFIGS) {
      try {
        const chainSync = new ChainSync(config);
        this.chainSyncs.set(config.chainId, chainSync);
        console.log(`✅ Initialized sync for ${config.chainName} (Chain ID: ${config.chainId})`);
      } catch (error) {
        console.error(`❌ Failed to initialize sync for ${config.chainName}:`, error);
      }
    }
  }

  // 启动所有链的同步
  async start() {
    console.log('🚀 Starting multi-chain NFT sync service...');
    
    for (const [chainId, chainSync] of this.chainSyncs) {
      try {
        await chainSync.start();
        console.log(`✅ Started sync for chain ${chainId}`);
      } catch (error) {
        console.error(`❌ Failed to start sync for chain ${chainId}:`, error);
      }
    }
  }

  // 停止所有链的同步
  stop() {
    console.log('⏹️ Stopping multi-chain NFT sync service...');
    
    for (const [chainId, chainSync] of this.chainSyncs) {
      chainSync.stop();
      console.log(`✅ Stopped sync for chain ${chainId}`);
    }
  }

  // 获取指定链的NFT列表
  getUserNFTs(userAddress: string, chainId?: number) {
    const query = chainId
      ? 'SELECT * FROM user_nfts WHERE owner_address = ? AND chain_id = ? ORDER BY token_id DESC'
      : 'SELECT * FROM user_nfts WHERE owner_address = ? ORDER BY chain_id, token_id DESC';
    
    const params = chainId ? [userAddress.toLowerCase(), chainId] : [userAddress.toLowerCase()];
    return db.prepare(query).all(...params);
  }

  // 获取所有链的库存统计
  getInventoryStats(chainId?: number) {
    const query = chainId
      ? 'SELECT * FROM nft_inventory WHERE chain_id = ? ORDER BY level'
      : 'SELECT * FROM nft_inventory ORDER BY chain_id, level';
    
    return chainId
      ? db.prepare(query).all(chainId)
      : db.prepare(query).all();
  }

  // 获取同步状态
  getSyncStatus() {
    return db.prepare('SELECT * FROM sync_status ORDER BY chain_id').all();
  }
}

// 单链同步服务
class ChainSync {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private config: ChainConfig;
  private isRunning: boolean = false;

  constructor(config: ChainConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    // NFT合约ABI
    const nftABI = [
      "event NFTMinted(address indexed to, uint256 indexed tokenId, uint8 level, uint256 weight, string paymentMethod)",
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function tokenURI(uint256 tokenId) view returns (string)"
    ];

    this.contract = new ethers.Contract(config.nftAddress, nftABI, this.provider);
  }

  // 启动同步
  async start() {
    if (this.isRunning) {
      console.log(`⚠️ Sync already running for ${this.config.chainName}`);
      return;
    }

    this.isRunning = true;

    // 初始化同步状态
    this.initSyncStatus();

    // 同步历史事件
    await this.syncHistoricalEvents();

    // 监听新事件
    this.listenToEvents();

    console.log(`✅ ${this.config.chainName} sync started`);
  }

  // 停止同步
  stop() {
    this.isRunning = false;
    this.contract.removeAllListeners();
    console.log(`⏹️ ${this.config.chainName} sync stopped`);
  }

  // 初始化同步状态
  private initSyncStatus() {
    const existing = db.prepare('SELECT * FROM sync_status WHERE chain_id = ?').get(this.config.chainId);
    
    if (!existing) {
      db.prepare(`
        INSERT INTO sync_status (chain_id, chain_name, last_synced_block)
        VALUES (?, ?, ?)
      `).run(this.config.chainId, this.config.chainName, this.config.startBlock || 0);
    }
  }

  // 同步历史事件
  private async syncHistoricalEvents() {
    try {
      const syncStatus = db.prepare('SELECT last_synced_block FROM sync_status WHERE chain_id = ?')
        .get(this.config.chainId) as any;
      
      const fromBlock = syncStatus?.last_synced_block || this.config.startBlock || 0;
      const currentBlock = await this.provider.getBlockNumber();

      console.log(`📊 ${this.config.chainName}: Syncing from block ${fromBlock} to ${currentBlock}`);

      // 分批查询事件（避免RPC限制）
      const batchSize = 5000;
      for (let start = fromBlock; start <= currentBlock; start += batchSize) {
        const end = Math.min(start + batchSize - 1, currentBlock);
        
        const mintEvents = await this.contract.queryFilter(
          this.contract.filters.NFTMinted(),
          start,
          end
        );

        for (const event of mintEvents) {
          await this.handleMintEvent(event);
        }

        // 更新同步进度
        db.prepare('UPDATE sync_status SET last_synced_block = ?, last_sync_time = CURRENT_TIMESTAMP WHERE chain_id = ?')
          .run(end, this.config.chainId);
      }

      console.log(`✅ ${this.config.chainName}: Historical sync completed`);
    } catch (error) {
      console.error(`❌ ${this.config.chainName}: Historical sync failed:`, error);
    }
  }

  // 监听新事件
  private listenToEvents() {
    // 监听 NFTMinted 事件
    this.contract.on('NFTMinted', async (to, tokenId, level, weight, paymentMethod, event) => {
      console.log(`🎉 ${this.config.chainName}: New NFT minted - Token #${tokenId} to ${to}`);
      await this.handleMintEvent(event);
    });

    // 监听 Transfer 事件
    this.contract.on('Transfer', async (from, to, tokenId, event) => {
      if (from !== ethers.ZeroAddress) {
        console.log(`🔄 ${this.config.chainName}: NFT transferred - Token #${tokenId} from ${from} to ${to}`);
        await this.handleTransferEvent(from, to, tokenId);
      }
    });
  }

  // 处理铸造事件
  private async handleMintEvent(event: any) {
    try {
      const { to, tokenId, level, weight, paymentMethod } = event.args;
      const block = await event.getBlock();

      db.prepare(`
        INSERT OR REPLACE INTO user_nfts 
        (chain_id, token_id, owner_address, level, weight, minted_at, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        this.config.chainId,
        tokenId.toString(),
        to.toLowerCase(),
        level,
        ethers.formatUnits(weight, 0),
        new Date(block.timestamp * 1000).toISOString(),
        paymentMethod
      );

      console.log(`✅ ${this.config.chainName}: Saved NFT #${tokenId} for ${to}`);
    } catch (error) {
      console.error(`❌ ${this.config.chainName}: Failed to handle mint event:`, error);
    }
  }

  // 处理转移事件
  private async handleTransferEvent(from: string, to: string, tokenId: bigint) {
    try {
      db.prepare(`
        UPDATE user_nfts 
        SET owner_address = ?
        WHERE chain_id = ? AND token_id = ?
      `).run(to.toLowerCase(), this.config.chainId, tokenId.toString());

      console.log(`✅ ${this.config.chainName}: Updated owner for NFT #${tokenId}`);
    } catch (error) {
      console.error(`❌ ${this.config.chainName}: Failed to handle transfer event:`, error);
    }
  }
}

// 导出单例
export const multiChainNftSync = new MultiChainNFTSync();
export default multiChainNftSync;
