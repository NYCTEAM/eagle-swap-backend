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
    rpcUrl: process.env.XLAYER_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/',
    nftAddress: process.env.XLAYER_NFT_ADDRESS || '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7', // Multi-Chain Global
    startBlock: 47700000 // NFT合约部署区块（大约）
  },
  {
    chainId: 56,
    chainName: 'BSC',
    rpcUrl: process.env.BSC_RPC_URL || 'https://rpc1.eagleswap.llc/bsc/',
    nftAddress: process.env.BSC_NFT_ADDRESS || '0x3c117d186C5055071EfF91d87f2600eaF88D591D', // Multi-Chain Global (Auto-decimals)
    startBlock: 72700000 // 更近的区块，避免 RPC 错误
  }
];

// 多链NFT同步服务
class MultiChainNFTSync {
  private chainSyncs: Map<number, ChainSync> = new Map();

  constructor() {
    this.initDatabase();
    this.initChainSyncs();
  }

  // 初始化数据库表 - 使用 nft_holders 表
  private initDatabase() {
    // nft_holders 表应该已经由数据库初始化脚本创建
    // 这里只需要确保表存在即可
    console.log('✅ Using existing nft_holders table for multi-chain sync');

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

  // 获取指定链的NFT列表 - 使用 nft_holders 表
  getUserNFTs(userAddress: string, chainId?: number) {
    const query = chainId
      ? 'SELECT * FROM nft_holders WHERE owner_address = ? AND chain_id = ? ORDER BY global_token_id DESC'
      : 'SELECT * FROM nft_holders WHERE owner_address = ? ORDER BY chain_id, global_token_id DESC';
    
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

    // NFT合约ABI - 包含 globalTokenId
    const nftABI = [
      "event NFTMinted(address indexed to, uint256 indexed localTokenId, uint256 indexed globalTokenId, uint8 level, uint256 weight, string paymentMethod)",
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function nftData(uint256 tokenId) view returns (uint8 level, uint256 mintedAt, uint256 globalTokenId)",
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
      // 如果数据库中已有该链的 NFT 数据，从最新的 NFT 区块开始
      const latestNft = db.prepare(`
        SELECT MAX(CAST(minted_at AS INTEGER)) as latest_block 
        FROM nft_holders 
        WHERE chain_id = ? AND minted_at NOT LIKE '%-%'
      `).get(this.config.chainId) as any;
      
      const startBlock = latestNft?.latest_block || this.config.startBlock || 0;
      
      db.prepare(`
        INSERT INTO sync_status (chain_id, chain_name, last_synced_block)
        VALUES (?, ?, ?)
      `).run(this.config.chainId, this.config.chainName, startBlock);
      
      console.log(`📍 ${this.config.chainName}: Initialized sync from block ${startBlock}`);
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
        
        // 同步 Mint 事件
        const mintEvents = await this.contract.queryFilter(
          this.contract.filters.NFTMinted(),
          start,
          end
        );

        for (const event of mintEvents) {
          await this.handleMintEvent(event);
        }

        // 同步 Transfer 事件（排除 mint 事件，即 from != 0x0）
        const transferEvents = await this.contract.queryFilter(
          this.contract.filters.Transfer(),
          start,
          end
        );

        for (const event of transferEvents) {
          if ('args' in event) {
            const { from, to, tokenId } = event.args as any;
            // 只处理非 mint 的转账（from 不是零地址）
            if (from !== ethers.ZeroAddress) {
              await this.handleTransferEvent(from, to, tokenId);
            }
          }
        }

        // 更新同步进度
        db.prepare('UPDATE sync_status SET last_synced_block = ?, last_sync_time = ? WHERE chain_id = ?')
          .run(end, new Date().toISOString(), this.config.chainId);
        
        console.log(`✅ ${this.config.chainName}: Synced blocks ${start} to ${end} (Mints: ${mintEvents.length}, Transfers: ${transferEvents.filter((e: any) => e.args.from !== ethers.ZeroAddress).length})`);
      }
    } catch (error) {
      console.error(`❌ ${this.config.chainName}: Failed to sync historical events:`, error);
    }
  }

  // 监听新事件
  private listenToEvents() {
    // 监听 NFTMinted 事件 - 包含 globalTokenId
    this.contract.on('NFTMinted', async (to, localTokenId, globalTokenId, level, weight, paymentMethod, event) => {
      console.log(`🎉 ${this.config.chainName}: New NFT minted - Token #${localTokenId} (Global: ${globalTokenId}) to ${to}`);
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

  // 处理铸造事件 - 保存到 nft_holders 表
  private async handleMintEvent(event: any) {
    try {
      const { to, localTokenId, globalTokenId, level, weight, paymentMethod } = event.args;
      const block = await event.getBlock();
      
      // weight 是整数，不是 18 decimals
      const weightValue = Number(weight);
      const now = new Date().toISOString();

      db.prepare(`
        INSERT OR REPLACE INTO nft_holders 
        (global_token_id, chain_id, chain_name, contract_address, 
         owner_address, level, weight, effective_weight, stage, minted_at, 
         tx_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `).run(
        Number(globalTokenId),
        this.config.chainId,
        this.config.chainName,
        this.config.nftAddress.toLowerCase(),
        to.toLowerCase(),
        Number(level),
        weightValue,
        weightValue,
        block.timestamp,
        event.transactionHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
        now,
        now
      );

      console.log(`✅ ${this.config.chainName}: Saved NFT Global #${globalTokenId} (Level ${level}) for ${to}`);
    } catch (error) {
      console.error(`❌ ${this.config.chainName}: Failed to handle mint event:`, error);
    }
  }

  // 处理转移事件 - 更新 nft_holders 表
  private async handleTransferEvent(from: string, to: string, localTokenId: bigint) {
    try {
      // 需要从合约获取 globalTokenId
      const nftData = await this.contract.nftData(localTokenId);
      const globalTokenId = Number(nftData.globalTokenId);
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE nft_holders 
        SET owner_address = ?, updated_at = ?
        WHERE chain_id = ? AND global_token_id = ?
      `).run(
        to.toLowerCase(),
        now,
        this.config.chainId,
        globalTokenId
      );

      console.log(`✅ ${this.config.chainName}: Updated owner for NFT Global #${globalTokenId}`);
    } catch (error) {
      console.error(`❌ ${this.config.chainName}: Failed to handle transfer event:`, error);
    }
  }
}

// 导出单例
export const multiChainNftSync = new MultiChainNFTSync();
export default multiChainNftSync;
