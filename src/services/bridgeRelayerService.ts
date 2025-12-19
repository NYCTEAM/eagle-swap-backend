import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import path from 'path';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createMintToInstruction, getOrCreateAssociatedTokenAccount, createBurnInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';

// Contract addresses
const CONTRACTS = {
  xlayer: {
    chainId: 196,
    rpc: process.env.XLAYER_RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/',
    token: '0x9fF9eABCe63977F90d2564C9B223567A41B48AdE',
    bridge: '0xC5564e2A9D3b1A3d1400bAa4951F571af0b265E2',
  },
  bsc: {
    chainId: 56,
    rpc: process.env.BSC_RPC_URL || 'https://rpc1.eagleswap.llc/bsc/',
    token: '0x390ad250461a2a8e62264299C132171E0e180fD1',
    bridge: '0xF964264c4Bb47f4a36AB619ec16be0B139F897d0',
  },
  solana: {
    chainId: 501, // Custom chain ID for Solana
    rpc: process.env.SOLANA_RPC_URL || 'https://rpc1.eagleswap.llc/sol/',
    token: 'ESZCBFmiArHThvQGKWn6pAZgC88TcVA3G6QxUwjyT8cH', // EAGLE Token (Token-2022 with metadata)
    decimals: 9,
    program: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022 program
  },
};

// Bridge ABIs
const XLAYER_BRIDGE_ABI = [
  'event BridgeInitiated(address indexed from, address indexed to, uint256 amount, uint256 fee, uint256 indexed nonce, uint256 timestamp)',
  'function release(address to, uint256 amount, uint256 srcNonce, uint256 srcChainId, bytes calldata signature) external',
];

const BSC_BRIDGE_ABI = [
  'event BridgeInitiated(address indexed from, address indexed to, uint256 amount, uint256 fee, uint256 indexed nonce, uint256 timestamp)',
  'function release(address to, uint256 amount, uint256 srcNonce, uint256 srcChainId, bytes calldata signature) external',
];

interface BridgeRequest {
  txHash: string;
  fromChain: 'xlayer' | 'bsc' | 'solana';
  toChain: 'xlayer' | 'bsc' | 'solana';
  from: string;
  to: string;
  amount: string;
  fee?: string;
  nonce: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  destTxHash?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

class BridgeRelayerService extends EventEmitter {
  private xlayerProvider: ethers.JsonRpcProvider;
  private bscProvider: ethers.JsonRpcProvider;
  private solanaConnection: Connection;
  private relayerWallet: ethers.Wallet | ethers.HDNodeWallet;
  private solanaKeypair: Keypair | null = null;
  private pendingRequests: Map<string, BridgeRequest> = new Map();
  private isRunning: boolean = false;
  private db: Database.Database;

  constructor() {
    super();
    
    // Initialize database
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'eagleswap.db');
    this.db = new Database(dbPath);
    this.initDatabase();
    
    // Initialize providers
    this.xlayerProvider = new ethers.JsonRpcProvider(CONTRACTS.xlayer.rpc);
    this.bscProvider = new ethers.JsonRpcProvider(CONTRACTS.bsc.rpc);
    this.solanaConnection = new Connection(CONTRACTS.solana.rpc, 'confirmed');
    
    // Initialize relayer wallet (EVM)
    const privateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!privateKey) {
      console.warn('⚠️ RELAYER_PRIVATE_KEY not set, bridge relayer will not work');
      this.relayerWallet = ethers.Wallet.createRandom();
    } else {
      this.relayerWallet = new ethers.Wallet(privateKey);
    }
    
    // Initialize Solana keypair
    const solanaPrivateKey = process.env.SOLANA_PRIVATE_KEY;
    if (solanaPrivateKey) {
      try {
        this.solanaKeypair = Keypair.fromSecretKey(bs58.decode(solanaPrivateKey));
        console.log(`🌞 Solana Relayer: ${this.solanaKeypair.publicKey.toBase58()}`);
      } catch (e) {
        console.warn('⚠️ Invalid SOLANA_PRIVATE_KEY');
      }
    } else {
      console.warn('⚠️ SOLANA_PRIVATE_KEY not set, Solana bridge will not work');
    }
    
    console.log(`🦅 Bridge Relayer initialized`);
    console.log(`   EVM Relayer: ${this.relayerWallet.address}`);
    console.log(`   Solana Token: ${CONTRACTS.solana.token}`);
    
    // Load pending requests from database
    this.loadPendingFromDb();
  }

  private initDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bridge_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_hash TEXT UNIQUE NOT NULL,
        from_chain TEXT NOT NULL,
        to_chain TEXT NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount TEXT NOT NULL,
        fee TEXT DEFAULT '0',
        nonce INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        dest_tx_hash TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
      
      CREATE INDEX IF NOT EXISTS idx_bridge_status ON bridge_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_bridge_from_address ON bridge_transactions(from_address);
      CREATE INDEX IF NOT EXISTS idx_bridge_created_at ON bridge_transactions(created_at);
      
      -- 同步状态表 (保存最后同步的区块号)
      CREATE TABLE IF NOT EXISTS bridge_sync_state (
        chain TEXT PRIMARY KEY,
        last_block INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('📊 Bridge transactions table initialized');
  }
  
  // 获取最后同步的区块号
  private getLastSyncedBlock(chain: string): number {
    try {
      const result = this.db.prepare('SELECT last_block FROM bridge_sync_state WHERE chain = ?').get(chain) as { last_block: number } | undefined;
      return result?.last_block || 0;
    } catch {
      return 0;
    }
  }
  
  // 保存最后同步的区块号
  private saveLastSyncedBlock(chain: string, blockNumber: number) {
    this.db.prepare(`
      INSERT INTO bridge_sync_state (chain, last_block, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(chain) DO UPDATE SET last_block = ?, updated_at = CURRENT_TIMESTAMP
    `).run(chain, blockNumber, blockNumber);
  }

  private loadPendingFromDb() {
    const pending = this.db.prepare(`
      SELECT * FROM bridge_transactions WHERE status IN ('pending', 'processing')
    `).all() as any[];
    
    for (const row of pending) {
      this.pendingRequests.set(row.tx_hash, {
        txHash: row.tx_hash,
        fromChain: row.from_chain,
        toChain: row.to_chain,
        from: row.from_address,
        to: row.to_address,
        amount: row.amount,
        nonce: row.nonce,
        status: row.status,
        destTxHash: row.dest_tx_hash,
        error: row.error,
        createdAt: new Date(row.created_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      });
    }
    console.log(`📥 Loaded ${pending.length} pending bridge requests from database`);
  }

  private saveToDb(request: BridgeRequest, fee: string = '0') {
    const stmt = this.db.prepare(`
      INSERT INTO bridge_transactions (tx_hash, from_chain, to_chain, from_address, to_address, amount, fee, nonce, status, dest_tx_hash, error, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tx_hash) DO UPDATE SET
        status = excluded.status,
        dest_tx_hash = excluded.dest_tx_hash,
        error = excluded.error,
        completed_at = excluded.completed_at
    `);
    
    stmt.run(
      request.txHash,
      request.fromChain,
      request.toChain,
      request.from,
      request.to,
      request.amount,
      fee,
      request.nonce,
      request.status,
      request.destTxHash || null,
      request.error || null,
      request.createdAt.toISOString(),
      request.completedAt?.toISOString() || null
    );
  }

  private updateStatusInDb(txHash: string, status: string, destTxHash?: string, error?: string) {
    const stmt = this.db.prepare(`
      UPDATE bridge_transactions 
      SET status = ?, dest_tx_hash = ?, error = ?, completed_at = ?
      WHERE tx_hash = ?
    `);
    
    stmt.run(
      status,
      destTxHash || null,
      error || null,
      status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
      txHash
    );
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('🚀 Starting Bridge Relayer...');
    
    // 先扫描历史事件（从上次同步的区块开始）
    await this.syncHistoricalEvents();
    
    // Listen for X Layer bridge events
    this.listenXLayerEvents();
    
    // Listen for BSC bridge events
    this.listenBSCEvents();
    
    console.log('✅ Bridge Relayer started');
  }
  
  // 扫描历史事件
  private async syncHistoricalEvents() {
    console.log('📜 Syncing historical bridge events...');
    
    // X Layer
    await this.syncChainHistory('xlayer', this.xlayerProvider, CONTRACTS.xlayer.bridge, XLAYER_BRIDGE_ABI);
    
    // BSC
    await this.syncChainHistory('bsc', this.bscProvider, CONTRACTS.bsc.bridge, BSC_BRIDGE_ABI);
  }
  
  private async syncChainHistory(chain: string, provider: ethers.JsonRpcProvider, bridgeAddress: string, abi: string[]) {
    try {
      const currentBlock = await provider.getBlockNumber();
      const lastSyncedBlock = this.getLastSyncedBlock(chain);
      
      console.log(`   [${chain.toUpperCase()}] Last synced: ${lastSyncedBlock}, Current: ${currentBlock}`);
      
      if (lastSyncedBlock >= currentBlock) {
        console.log(`   [${chain.toUpperCase()}] Already up to date`);
        return;
      }
      
      const fromBlock = lastSyncedBlock > 0 ? lastSyncedBlock + 1 : Math.max(0, currentBlock - 10000);
      const bridge = new ethers.Contract(bridgeAddress, abi, provider);
      
      // 分批扫描
      const BATCH_SIZE = 5000;
      for (let start = fromBlock; start <= currentBlock; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE - 1, currentBlock);
        
        try {
          // 根据链类型选择事件 - 两条链都使用 BridgeInitiated
          const events = await bridge.queryFilter('BridgeInitiated', start, end);
          for (const event of events) {
            if (chain === 'xlayer') {
              await this.processXLayerEvent(event);
            } else if (chain === 'bsc') {
              await this.processBSCEvent(event);
            }
          }
        } catch (e) {
          console.error(`   [${chain.toUpperCase()}] Error scanning blocks ${start}-${end}:`, e);
        }
      }
      
      // 保存同步状态
      this.saveLastSyncedBlock(chain, currentBlock);
      console.log(`   [${chain.toUpperCase()}] Synced to block ${currentBlock}`);
      
    } catch (error) {
      console.error(`   [${chain.toUpperCase()}] Sync error:`, error);
    }
  }
  
  // 处理 X Layer BridgeInitiated 事件
  private async processXLayerEvent(event: any) {
    try {
      const [from, to, amount, fee, nonce] = event.args;
      const txHash = event.transactionHash;
      
      // 检查是否已存在
      const existing = this.db.prepare('SELECT tx_hash FROM bridge_transactions WHERE tx_hash = ?').get(txHash);
      if (existing) return;
      
      // X Layer Bridge 只能桥接到 BSC
      const request: BridgeRequest = {
        txHash,
        fromChain: 'xlayer',
        toChain: 'bsc',
        from,
        to,
        amount: amount.toString(),
        fee: fee?.toString() || '0',
        nonce: Number(nonce),
        status: 'pending',
        createdAt: new Date(),
      };
      
      this.pendingRequests.set(txHash, request);
      this.saveToDb(request, fee?.toString() || '0');
      console.log(`   📥 Loaded historical X Layer event: ${txHash}`);
      
      // 处理请求 - 释放到 BSC
      await this.releaseToBSC(request);
    } catch (e) {
      console.error('Error processing X Layer event:', e);
    }
  }
  
  // 处理 BSC BridgeInitiated 事件
  private async processBSCEvent(event: any) {
    try {
      const [from, to, amount, fee, nonce] = event.args;
      const txHash = event.transactionHash;
      
      // 检查是否已存在
      const existing = this.db.prepare('SELECT tx_hash FROM bridge_transactions WHERE tx_hash = ?').get(txHash);
      if (existing) return;
      
      const request: BridgeRequest = {
        txHash,
        fromChain: 'bsc',
        toChain: 'xlayer',
        from,
        to,
        amount: amount.toString(),
        fee: fee?.toString() || '0',
        nonce: Number(nonce),
        status: 'pending',
        createdAt: new Date(),
      };
      
      this.pendingRequests.set(txHash, request);
      this.saveToDb(request, fee?.toString() || '0');
      console.log(`   📥 Loaded historical BSC event: ${txHash}`);
      
      // 处理请求 - 释放到 X Layer
      await this.releaseToXLayer(request);
    } catch (e) {
      console.error('Error processing BSC event:', e);
    }
  }
  
  // 处理跨链请求
  private async processRequest(request: BridgeRequest) {
    if (request.toChain === 'bsc') {
      await this.releaseToBSC(request);
    } else if (request.toChain === 'xlayer') {
      await this.releaseToXLayer(request);
    } else if (request.toChain === 'solana') {
      await this.mintToSolana(request);
    }
  }

  private async listenXLayerEvents() {
    const bridge = new ethers.Contract(
      CONTRACTS.xlayer.bridge,
      XLAYER_BRIDGE_ABI,
      this.xlayerProvider
    );

    bridge.on('BridgeInitiated', async (from, to, amount, fee, nonce, timestamp, event) => {
      console.log(`\n📤 X Layer BridgeInitiated detected:`);
      console.log(`   From: ${from}`);
      console.log(`   To: ${to}`);
      console.log(`   Amount: ${ethers.formatEther(amount)} EAGLE`);
      console.log(`   Nonce: ${nonce}`);

      const txHash = event.log.transactionHash;
      
      // Create request - X Layer 只能桥接到 BSC
      const request: BridgeRequest = {
        txHash,
        fromChain: 'xlayer',
        toChain: 'bsc',
        from,
        to,
        amount: amount.toString(),
        nonce: Number(nonce),
        status: 'pending',
        createdAt: new Date(),
      };
      
      this.pendingRequests.set(txHash, request);
      
      // Save to database
      this.saveToDb(request, ethers.formatEther(fee));
      
      // Process - 释放到 BSC
      await this.releaseToBSC(request);
      
      // 保存区块号
      this.saveLastSyncedBlock('xlayer', event.log.blockNumber);
    });

    console.log('👂 Listening for X Layer bridge events...');
  }

  private async listenBSCEvents() {
    const bridge = new ethers.Contract(
      CONTRACTS.bsc.bridge,
      BSC_BRIDGE_ABI,
      this.bscProvider
    );

    bridge.on('BridgeInitiated', async (from, to, amount, fee, nonce, timestamp, event) => {
      console.log(`\n📤 BSC BridgeInitiated detected:`);
      console.log(`   From: ${from}`);
      console.log(`   To: ${to}`);
      console.log(`   Amount: ${ethers.formatEther(amount)} EAGLE`);
      console.log(`   Nonce: ${nonce}`);

      const txHash = event.log.transactionHash;
      
      // Create request
      const request: BridgeRequest = {
        txHash,
        fromChain: 'bsc',
        toChain: 'xlayer',
        from,
        to,
        amount: amount.toString(),
        nonce: Number(nonce),
        status: 'pending',
        createdAt: new Date(),
      };
      
      this.pendingRequests.set(txHash, request);
      
      // Save to database
      this.saveToDb(request, ethers.formatEther(fee));
      
      // Process on X Layer
      await this.releaseToXLayer(request);
      
      // 保存区块号
      this.saveLastSyncedBlock('bsc', event.log.blockNumber);
    });

    console.log('👂 Listening for BSC bridge events...');
  }

  private async releaseToBSC(request: BridgeRequest) {
    try {
      request.status = 'processing';
      console.log(`\n🔄 Processing release on BSC for nonce ${request.nonce}...`);

      const wallet = this.relayerWallet.connect(this.bscProvider);
      const bridge = new ethers.Contract(CONTRACTS.bsc.bridge, BSC_BRIDGE_ABI, wallet);

      // Create signature - 匹配合约的签名验证逻辑
      // 合约会对 messageHash 调用 toEthSignedMessageHash，所以我们直接签名原始哈希
      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
        [request.to, request.amount, request.nonce, CONTRACTS.xlayer.chainId, CONTRACTS.bsc.chainId, CONTRACTS.bsc.bridge]
      );
      const signature = await this.relayerWallet.signingKey.sign(messageHash).serialized;

      // Call release
      const tx = await bridge.release(
        request.to,
        request.amount,
        request.nonce,
        CONTRACTS.xlayer.chainId,
        signature
      );

      console.log(`   TX Hash: ${tx.hash}`);
      const receipt = await tx.wait();
      
      request.status = 'completed';
      request.destTxHash = tx.hash;
      request.completedAt = new Date();
      
      // Update database
      this.updateStatusInDb(request.txHash, 'completed', tx.hash);
      
      console.log(`✅ Release completed on BSC!`);
      this.emit('bridgeCompleted', request);
      
    } catch (error: any) {
      console.error(`❌ Release to BSC failed:`, error.message);
      request.status = 'failed';
      request.error = error.message;
      
      // Update database
      this.updateStatusInDb(request.txHash, 'failed', undefined, error.message);
      
      this.emit('bridgeFailed', request);
    }
  }

  private async releaseToXLayer(request: BridgeRequest) {
    try {
      request.status = 'processing';
      console.log(`\n🔄 Processing release on X Layer for nonce ${request.nonce}...`);

      const wallet = this.relayerWallet.connect(this.xlayerProvider);
      const bridge = new ethers.Contract(CONTRACTS.xlayer.bridge, XLAYER_BRIDGE_ABI, wallet);

      // Create signature - 匹配合约的签名验证逻辑
      // 合约会对 messageHash 调用 toEthSignedMessageHash，所以我们直接签名原始哈希
      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
        [request.to, request.amount, CONTRACTS.bsc.chainId, request.nonce, CONTRACTS.xlayer.chainId, CONTRACTS.xlayer.bridge]
      );
      const signature = await this.relayerWallet.signingKey.sign(messageHash).serialized;

      // Call bridgeIn
      const tx = await bridge.bridgeIn(
        request.to,
        request.amount,
        CONTRACTS.bsc.chainId,
        request.nonce,
        signature
      );

      console.log(`   TX Hash: ${tx.hash}`);
      const receipt = await tx.wait();
      
      request.status = 'completed';
      request.destTxHash = tx.hash;
      request.completedAt = new Date();
      
      // Update database
      this.updateStatusInDb(request.txHash, 'completed', tx.hash);
      
      console.log(`✅ Release completed on X Layer!`);
      this.emit('bridgeCompleted', request);
      
    } catch (error: any) {
      console.error(`❌ Release to X Layer failed:`, error.message);
      request.status = 'failed';
      request.error = error.message;
      
      // Update database
      this.updateStatusInDb(request.txHash, 'failed', undefined, error.message);
      
      this.emit('bridgeFailed', request);
    }
  }

  private async mintToSolana(request: BridgeRequest) {
    try {
      if (!this.solanaKeypair) {
        throw new Error('Solana keypair not configured');
      }
      
      request.status = 'processing';
      console.log(`\n🔄 Processing mint on Solana for nonce ${request.nonce}...`);
      console.log(`   Recipient: ${request.to}`);
      console.log(`   Amount: ${ethers.formatEther(request.amount)} EAGLE`);

      const mintPubkey = new PublicKey(CONTRACTS.solana.token);
      
      // The 'to' address should be a Solana public key (base58)
      // For cross-chain, user provides their Solana address
      let recipientPubkey: PublicKey;
      try {
        recipientPubkey = new PublicKey(request.to);
      } catch (e) {
        throw new Error(`Invalid Solana address: ${request.to}`);
      }

      // Get or create associated token account for recipient
      const recipientATA = await getOrCreateAssociatedTokenAccount(
        this.solanaConnection,
        this.solanaKeypair,
        mintPubkey,
        recipientPubkey
      );

      console.log(`   Recipient ATA: ${recipientATA.address.toBase58()}`);

      // Create mint instruction
      // Amount from X Layer is in wei (18 decimals), Solana token has 9 decimals
      // Convert: amount / 10^9 (divide by 10^9 to go from 18 to 9 decimals)
      const amountBigInt = BigInt(request.amount);
      const mintAmount = amountBigInt / BigInt(10 ** 9); // Convert 18 decimals to 9 decimals
      
      console.log(`   Mint Amount (9 decimals): ${mintAmount.toString()}`);
      
      const mintIx = createMintToInstruction(
        mintPubkey,
        recipientATA.address,
        this.solanaKeypair.publicKey, // Mint authority
        mintAmount
      );

      // Create and send transaction
      const transaction = new Transaction().add(mintIx);
      
      const signature = await sendAndConfirmTransaction(
        this.solanaConnection,
        transaction,
        [this.solanaKeypair]
      );

      console.log(`   TX Signature: ${signature}`);
      
      request.status = 'completed';
      request.destTxHash = signature;
      request.completedAt = new Date();
      
      // Update database
      this.updateStatusInDb(request.txHash, 'completed', signature);
      
      console.log(`✅ Mint completed on Solana!`);
      this.emit('bridgeCompleted', request);
      
    } catch (error: any) {
      console.error(`❌ Mint to Solana failed:`, error.message);
      request.status = 'failed';
      request.error = error.message;
      
      // Update database
      this.updateStatusInDb(request.txHash, 'failed', undefined, error.message);
      
      this.emit('bridgeFailed', request);
    }
  }

  // API methods
  getStatus(txHash: string): BridgeRequest | undefined {
    return this.pendingRequests.get(txHash);
  }

  getAllPending(): BridgeRequest[] {
    return Array.from(this.pendingRequests.values()).filter(r => r.status === 'pending' || r.status === 'processing');
  }

  getHistory(limit: number = 50): BridgeRequest[] {
    // Get from database for complete history
    const rows = this.db.prepare(`
      SELECT * FROM bridge_transactions 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit) as any[];
    
    return rows.map(row => ({
      txHash: row.tx_hash,
      fromChain: row.from_chain,
      toChain: row.to_chain,
      from: row.from_address,
      to: row.to_address,
      amount: row.amount,
      fee: row.fee,
      nonce: row.nonce,
      status: row.status,
      destTxHash: row.dest_tx_hash,
      error: row.error,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    }));
  }

  getStats() {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' OR status = 'processing' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN from_chain = 'xlayer' AND to_chain = 'bsc' THEN 1 ELSE 0 END) as xlayer_to_bsc,
        SUM(CASE WHEN from_chain = 'bsc' AND to_chain = 'xlayer' THEN 1 ELSE 0 END) as bsc_to_xlayer,
        SUM(CASE WHEN from_chain = 'xlayer' AND to_chain = 'solana' THEN 1 ELSE 0 END) as xlayer_to_solana,
        SUM(CASE WHEN from_chain = 'solana' AND to_chain = 'xlayer' THEN 1 ELSE 0 END) as solana_to_xlayer,
        SUM(CAST(amount AS REAL)) / 1e18 as total_volume
      FROM bridge_transactions
    `).get() as any;
    
    return {
      totalTransactions: stats.total || 0,
      completed: stats.completed || 0,
      pending: stats.pending || 0,
      failed: stats.failed || 0,
      xlayerToBsc: stats.xlayer_to_bsc || 0,
      bscToXlayer: stats.bsc_to_xlayer || 0,
      xlayerToSolana: stats.xlayer_to_solana || 0,
      solanaToXlayer: stats.solana_to_xlayer || 0,
      totalVolume: (stats.total_volume || 0).toFixed(2),
    };
  }

  getUserHistory(address: string, limit: number = 20): BridgeRequest[] {
    const rows = this.db.prepare(`
      SELECT * FROM bridge_transactions 
      WHERE LOWER(from_address) = LOWER(?) OR LOWER(to_address) = LOWER(?)
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(address, address, limit) as any[];
    
    return rows.map(row => ({
      txHash: row.tx_hash,
      fromChain: row.from_chain,
      toChain: row.to_chain,
      from: row.from_address,
      to: row.to_address,
      amount: row.amount,
      fee: row.fee,
      nonce: row.nonce,
      status: row.status,
      destTxHash: row.dest_tx_hash,
      error: row.error,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    }));
  }

  // Manual trigger (for API endpoint) - 手动处理跨链交易
  async notifyBridge(txHash: string, fromChain: 'xlayer' | 'bsc') {
    console.log(`📬 Manual bridge notification: ${txHash} from ${fromChain}`);
    
    try {
      // 检查是否已存在
      const existing = this.db.prepare('SELECT tx_hash FROM bridge_transactions WHERE tx_hash = ?').get(txHash);
      if (existing) {
        console.log(`   Transaction already exists in database`);
        return { received: true, txHash, status: 'already_exists' };
      }
      
      // 获取交易收据
      const provider = fromChain === 'xlayer' ? this.xlayerProvider : this.bscProvider;
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        console.log(`   Transaction not found on ${fromChain}`);
        return { received: true, txHash, status: 'not_found' };
      }
      
      console.log(`   Found transaction, processing logs...`);
      
      // 解析事件
      const bridgeAddress = fromChain === 'xlayer' ? CONTRACTS.xlayer.bridge : CONTRACTS.bsc.bridge;
      const bridgeAbi = fromChain === 'xlayer' ? XLAYER_BRIDGE_ABI : BSC_BRIDGE_ABI;
      const bridge = new ethers.Contract(bridgeAddress, bridgeAbi, provider);
      
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== bridgeAddress.toLowerCase()) continue;
        
        try {
          const parsed = bridge.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (!parsed) continue;
          
          console.log(`   Found event: ${parsed.name}`);
          
          if (parsed.name === 'BridgeInitiated') {
            const [from, to, amount, fee, nonce] = parsed.args;
            
            let request: BridgeRequest;
            
            if (fromChain === 'xlayer') {
              // X Layer -> BSC
              request = {
                txHash,
                fromChain: 'xlayer',
                toChain: 'bsc',
                from,
                to,
                amount: amount.toString(),
                fee: fee?.toString() || '0',
                nonce: Number(nonce),
                status: 'pending',
                createdAt: new Date(),
              };
              
              this.pendingRequests.set(txHash, request);
              this.saveToDb(request, ethers.formatEther(fee || 0));
              
              console.log(`   Processing X Layer -> BSC bridge...`);
              await this.releaseToBSC(request);
              
              return { received: true, txHash, status: 'processing', toChain: 'bsc' };
            } else if (fromChain === 'bsc') {
              // BSC -> X Layer
              request = {
                txHash,
                fromChain: 'bsc',
                toChain: 'xlayer',
                from,
                to,
                amount: amount.toString(),
                fee: fee?.toString() || '0',
                nonce: Number(nonce),
                status: 'pending',
                createdAt: new Date(),
              };
              
              this.pendingRequests.set(txHash, request);
              this.saveToDb(request, ethers.formatEther(fee || 0));
              
              console.log(`   Processing BSC -> X Layer bridge...`);
              await this.releaseToXLayer(request);
              
              return { received: true, txHash, status: 'processing', toChain: 'xlayer' };
            }
          }
        } catch (e) {
          // Not a bridge event, skip
        }
      }
      
      console.log(`   No bridge event found in transaction`);
      return { received: true, txHash, status: 'no_bridge_event' };
      
    } catch (error: any) {
      console.error(`   Error processing notification:`, error.message);
      return { received: true, txHash, status: 'error', error: error.message };
    }
  }
}

// Singleton instance
export const bridgeRelayerService = new BridgeRelayerService();
export default bridgeRelayerService;
