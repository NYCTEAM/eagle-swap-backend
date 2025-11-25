import { ethers } from 'ethers';
import { db } from '../database';

/**
 * NFT 合约同步服务
 * 监听链上事件并同步到数据库
 */

// NFT 合约配置
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS || '';
const RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';

// NFT 合约 ABI (只需要事件和查询函数)
const NFT_ABI = [
  'event NFTMinted(address indexed to, uint256 indexed tokenId, uint8 level, uint256 weight, string paymentMethod)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function getLevelInfo(uint8 level) view returns (string name, uint256 weight, uint256 priceUSDT, uint256 priceETH, uint256 supply, uint256 minted, uint256 available, string description)',
  'function getCurrentStage(uint256 tokenId) view returns (uint8)',
  'function getEffectiveWeight(uint256 tokenId) view returns (uint256)',
  'function tokensOfOwner(address owner) view returns (uint256[])',
];

class NFTSyncService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private isRunning: boolean = false;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, this.provider);
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
    console.log('🚀 Starting NFT sync service...');

    // 1. 初始化数据库表
    await this.initDatabase();

    // 2. 同步历史数据
    await this.syncHistoricalData();

    // 3. 监听新事件
    this.listenToEvents();

    console.log('✅ NFT sync service started');
  }

  /**
   * 初始化数据库表
   */
  private async initDatabase() {
    // NFT 等级配置表
    db.exec(`
      CREATE TABLE IF NOT EXISTS nft_levels (
        level INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        weight REAL NOT NULL,
        price_usdt REAL NOT NULL,
        price_eth REAL NOT NULL,
        supply INTEGER NOT NULL,
        minted INTEGER DEFAULT 0,
        available INTEGER NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // NFT 所有权表
    db.exec(`
      CREATE TABLE IF NOT EXISTS nft_ownership (
        token_id INTEGER PRIMARY KEY,
        owner_address TEXT NOT NULL,
        level INTEGER NOT NULL,
        stage INTEGER NOT NULL,
        effective_weight REAL NOT NULL,
        minted_at DATETIME NOT NULL,
        payment_method TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (level) REFERENCES nft_levels(level)
      )
    `);

    // NFT 交易历史表
    db.exec(`
      CREATE TABLE IF NOT EXISTS nft_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_hash TEXT NOT NULL,
        token_id INTEGER NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        event_type TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        timestamp DATETIME NOT NULL,
        UNIQUE(tx_hash, token_id)
      )
    `);

    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_nft_ownership_owner ON nft_ownership(owner_address);
      CREATE INDEX IF NOT EXISTS idx_nft_ownership_level ON nft_ownership(level);
      CREATE INDEX IF NOT EXISTS idx_nft_transactions_token ON nft_transactions(token_id);
      CREATE INDEX IF NOT EXISTS idx_nft_transactions_address ON nft_transactions(to_address);
    `);

    console.log('✅ Database initialized');
  }

  /**
   * 同步历史数据
   */
  private async syncHistoricalData() {
    console.log('📊 Syncing historical data...');

    try {
      // 同步所有等级配置
      for (let level = 1; level <= 7; level++) {
        await this.syncLevelInfo(level);
      }

      // 同步所有 NFT (从合约事件)
      const filter = this.contract.filters.NFTMinted();
      const events = await this.contract.queryFilter(filter);

      for (const event of events) {
        await this.handleMintEvent(event);
      }

      console.log(`✅ Synced ${events.length} NFTs`);
    } catch (error) {
      console.error('❌ Error syncing historical data:', error);
    }
  }

  /**
   * 同步等级信息
   */
  private async syncLevelInfo(level: number) {
    try {
      const info = await this.contract.getLevelInfo(level);
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO nft_levels 
        (level, name, weight, price_usdt, price_eth, supply, minted, available, description, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(
        level,
        info[0], // name
        Number(info[1]) / 10, // weight (除以 10)
        Number(info[2]) / 1e6, // priceUSDT (6 decimals)
        Number(ethers.formatEther(info[3])), // priceETH
        Number(info[4]), // supply
        Number(info[5]), // minted
        Number(info[6]), // available
        info[7] // description
      );

      console.log(`✅ Synced level ${level}: ${info[0]}`);
    } catch (error) {
      console.error(`❌ Error syncing level ${level}:`, error);
    }
  }

  /**
   * 监听合约事件
   */
  private listenToEvents() {
    // 监听 NFTMinted 事件
    this.contract.on('NFTMinted', async (to, tokenId, level, weight, paymentMethod, event) => {
      console.log(`🎉 New NFT minted: #${tokenId} to ${to}`);
      await this.handleMintEvent(event);
      await this.syncLevelInfo(level);
    });

    // 监听 Transfer 事件
    this.contract.on('Transfer', async (from, to, tokenId, event) => {
      console.log(`🔄 NFT transferred: #${tokenId} from ${from} to ${to}`);
      await this.handleTransferEvent(event);
    });

    console.log('👂 Listening to contract events...');
  }

  /**
   * 处理铸造事件
   */
  private async handleMintEvent(event: any) {
    try {
      const { to, tokenId, level, weight, paymentMethod } = event.args;
      const block = await event.getBlock();

      // 查询链上数据
      const stage = await this.contract.getCurrentStage(tokenId);
      const effectiveWeight = await this.contract.getEffectiveWeight(tokenId);

      // 保存到数据库
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO nft_ownership
        (token_id, owner_address, level, stage, effective_weight, minted_at, payment_method, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(
        Number(tokenId),
        to.toLowerCase(),
        Number(level),
        Number(stage),
        Number(effectiveWeight) / 10,
        new Date(block.timestamp * 1000).toISOString(),
        paymentMethod
      );

      // 记录交易历史
      await this.recordTransaction(event, 'mint');
    } catch (error) {
      console.error('❌ Error handling mint event:', error);
    }
  }

  /**
   * 处理转移事件
   */
  private async handleTransferEvent(event: any) {
    try {
      const { from, to, tokenId } = event.args;

      // 如果不是铸造 (from != 0x0),更新所有权
      if (from !== ethers.ZeroAddress) {
        const stmt = db.prepare(`
          UPDATE nft_ownership
          SET owner_address = ?, updated_at = CURRENT_TIMESTAMP
          WHERE token_id = ?
        `);

        stmt.run(to.toLowerCase(), Number(tokenId));
      }

      // 记录交易历史
      await this.recordTransaction(event, 'transfer');
    } catch (error) {
      console.error('❌ Error handling transfer event:', error);
    }
  }

  /**
   * 记录交易历史
   */
  private async recordTransaction(event: any, eventType: string) {
    try {
      const { from, to, tokenId } = event.args;
      const block = await event.getBlock();

      const stmt = db.prepare(`
        INSERT OR IGNORE INTO nft_transactions
        (tx_hash, token_id, from_address, to_address, event_type, block_number, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        event.transactionHash,
        Number(tokenId),
        from.toLowerCase(),
        to.toLowerCase(),
        eventType,
        event.blockNumber,
        new Date(block.timestamp * 1000).toISOString()
      );
    } catch (error) {
      console.error('❌ Error recording transaction:', error);
    }
  }

  /**
   * 停止同步服务
   */
  stop() {
    this.contract.removeAllListeners();
    this.isRunning = false;
    console.log('🛑 NFT sync service stopped');
  }
}

// 导出单例
export const nftSyncService = new NFTSyncService();
export default nftSyncService;
