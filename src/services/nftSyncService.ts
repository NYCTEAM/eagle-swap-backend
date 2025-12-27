import { ethers } from 'ethers';
import { db } from '../database';

/**
 * 多链 NFT 合约同步服务
 * 监听 X Layer 和 BSC 链上事件并同步到数据库
 */

// 多链配置
interface ChainConfig {
  name: string;
  chainId: number;
  nftAddress: string;
  rpcUrl: string;
}

const CHAINS: ChainConfig[] = [
  {
    name: 'X Layer',
    chainId: 196,
    nftAddress: '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7',
    rpcUrl: 'https://rpc1.eagleswap.llc/xlayer/'
  },
  {
    name: 'BSC',
    chainId: 56,
    nftAddress: '0x3c117d186C5055071EfF91d87f2600eaF88D591D',
    rpcUrl: 'https://rpc1.eagleswap.llc/bsc/'
  }
];

// NFT 合约 ABI
const NFT_ABI = [
  'event NFTMinted(address indexed to, uint256 indexed localTokenId, uint256 indexed globalTokenId, uint8 level, uint256 weight, string paymentMethod)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function tokensOfOwner(address owner) view returns (uint256[])',
  'function nftData(uint256 tokenId) view returns (uint8 level, uint256 mintedAt, uint256 globalTokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

// 等级权重配置
const LEVEL_WEIGHTS: Record<number, number> = {
  1: 150,   // Micro
  2: 300,   // Mini
  3: 500,   // Bronze
  4: 1000,  // Silver
  5: 3000,  // Gold
  6: 7000,  // Platinum
  7: 15000  // Diamond
};

class NFTSyncService {
  private chains: Map<number, { provider: ethers.JsonRpcProvider; contract: ethers.Contract; config: ChainConfig }> = new Map();
  private isRunning: boolean = false;

  constructor() {
    // 初始化所有链的连接
    for (const config of CHAINS) {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(config.nftAddress, NFT_ABI, provider);
      this.chains.set(config.chainId, { provider, contract, config });
    }
  }

  /**
   * 启动同步服务
   */
  async start() {
    if (this.isRunning) {
      console.log('NFT sync service is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting Multi-Chain NFT sync service...');

    // 1. 初始化数据库表
    await this.initDatabase();

    // 2. 同步所有链的历史数据
    for (const [chainId, chainData] of this.chains) {
      console.log(`📊 Syncing ${chainData.config.name}...`);
      await this.syncChainData(chainId);
    }

    // 3. 监听所有链的新事件
    for (const [chainId, chainData] of this.chains) {
      this.listenToChainEvents(chainId);
    }

    console.log('✅ Multi-Chain NFT sync service started');
  }

  /**
   * 初始化数据库表
   */
  private async initDatabase() {
    // NFT 所有权表（多链支持）
    db.exec(`
      CREATE TABLE IF NOT EXISTS nft_ownership (
        token_id INTEGER PRIMARY KEY,
        owner_address TEXT NOT NULL,
        level INTEGER NOT NULL,
        stage INTEGER DEFAULT 1,
        effective_weight REAL NOT NULL,
        chain_id INTEGER DEFAULT 196,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 检查并添加 chain_id 列（如果表已存在但没有此列）
    try {
      db.exec(`ALTER TABLE nft_ownership ADD COLUMN chain_id INTEGER DEFAULT 196`);
    } catch (e) {
      // 列已存在，忽略错误
    }

    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_nft_ownership_owner ON nft_ownership(owner_address);
      CREATE INDEX IF NOT EXISTS idx_nft_ownership_chain ON nft_ownership(chain_id);
    `);

    console.log('✅ Database initialized');
  }

  /**
   * 同步单条链的数据
   */
  private async syncChainData(chainId: number) {
    const chainData = this.chains.get(chainId);
    if (!chainData) return;

    const { contract, config } = chainData;

    try {
      // 监听 NFTMinted 事件并同步历史数据
      const filter = contract.filters.NFTMinted();
      const events = await contract.queryFilter(filter, -10000); // 最近 10000 个区块

      console.log(`Found ${events.length} NFT mint events on ${config.name}`);

      for (const event of events) {
        await this.handleMintEvent(event, chainId);
      }

      console.log(`✅ Synced ${config.name}`);
    } catch (error: any) {
      console.error(`❌ Error syncing ${config.name}:`, error?.message);
    }
  }

  /**
   * 监听单条链的事件
   */
  private listenToChainEvents(chainId: number) {
    const chainData = this.chains.get(chainId);
    if (!chainData) return;

    const { contract, config } = chainData;

    // 监听 NFTMinted 事件
    contract.on('NFTMinted', async (to, localTokenId, globalTokenId, level, weight, paymentMethod, event) => {
      console.log(`🎉 New NFT minted on ${config.name}: #${globalTokenId} to ${to}`);
      await this.handleMintEvent(event, chainId);
    });

    // 监听 Transfer 事件
    contract.on('Transfer', async (from, to, tokenId, event) => {
      console.log(`🔄 NFT transferred on ${config.name}: #${tokenId} from ${from} to ${to}`);
      await this.handleTransferEvent(event, chainId);
    });

    console.log(`👂 Listening to ${config.name} events...`);
  }

  /**
   * 处理铸造事件
   */
  private async handleMintEvent(event: any, chainId: number) {
    try {
      const { to, localTokenId, globalTokenId, level } = event.args;
      const effectiveWeight = LEVEL_WEIGHTS[Number(level)] || 150;

      // 保存到数据库
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO nft_ownership
        (token_id, owner_address, level, stage, effective_weight, chain_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(
        Number(globalTokenId),
        to.toLowerCase(),
        Number(level),
        1, // stage
        effectiveWeight,
        chainId
      );
    } catch (error: any) {
      console.error('❌ Error handling mint event:', error?.message);
    }
  }

  /**
   * 处理转移事件
   */
  private async handleTransferEvent(event: any, chainId: number) {
    try {
      const { from, to, tokenId } = event.args;

      // 如果不是铸造 (from != 0x0),更新所有权
      if (from !== ethers.ZeroAddress) {
        const chainData = this.chains.get(chainId);
        if (!chainData) return;

        // 需要获取 globalTokenId
        const nftData = await chainData.contract.nftData(tokenId);
        const globalTokenId = Number(nftData.globalTokenId);

        const stmt = db.prepare(`
          UPDATE nft_ownership
          SET owner_address = ?, updated_at = CURRENT_TIMESTAMP
          WHERE token_id = ? AND chain_id = ?
        `);

        stmt.run(to.toLowerCase(), globalTokenId, chainId);
      }
    } catch (error: any) {
      console.error('❌ Error handling transfer event:', error?.message);
    }
  }

  /**
   * 停止同步服务
   */
  stop() {
    for (const [chainId, chainData] of this.chains) {
      chainData.contract.removeAllListeners();
    }
    this.isRunning = false;
    console.log('🛑 Multi-Chain NFT sync service stopped');
  }
}

// 导出单例
export const nftSyncService = new NFTSyncService();
export default nftSyncService;
