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
    rpc: process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech',
    token: '0xdd9B82048D2408D69374Aecb6Cf65e66754c95bc',
    bridge: '0x63A65A216c213f636e06D4aD10e1b2995b19e82F',
  },
  bsc: {
    chainId: 56,
    rpc: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
    token: '0x83Fe5B70a08d42F6224A9644b3c73692f2d9092a',
    bridge: '0x0985DB9C2FA117152941521991E06AAfA03c82F3',
  },
  solana: {
    chainId: 501, // Custom chain ID for Solana
    rpc: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    token: 'CRdXNe2wDXXst6fHzpKkTr8X7Esj4B4qNyp6wRqmwGPE', // EAGLE Token Mint
    decimals: 18,
  },
};

// Bridge ABIs
const XLAYER_BRIDGE_ABI = [
  'event BridgeOut(address indexed from, address indexed to, uint256 amount, uint256 fee, uint256 indexed destChainId, uint256 nonce, uint256 timestamp)',
  'function bridgeIn(address to, uint256 amount, uint256 srcChainId, uint256 srcNonce, bytes calldata signature) external',
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
    `);
    console.log('📊 Bridge transactions table initialized');
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
    
    // Listen for X Layer bridge events
    this.listenXLayerEvents();
    
    // Listen for BSC bridge events
    this.listenBSCEvents();
    
    console.log('✅ Bridge Relayer started');
  }

  private async listenXLayerEvents() {
    const bridge = new ethers.Contract(
      CONTRACTS.xlayer.bridge,
      XLAYER_BRIDGE_ABI,
      this.xlayerProvider
    );

    bridge.on('BridgeOut', async (from, to, amount, fee, destChainId, nonce, timestamp, event) => {
      const destChainNum = Number(destChainId);
      const destChainName = destChainNum === CONTRACTS.bsc.chainId ? 'BSC' : 
                            destChainNum === CONTRACTS.solana.chainId ? 'Solana' : `Chain ${destChainNum}`;
      
      console.log(`\n📤 X Layer BridgeOut detected:`);
      console.log(`   From: ${from}`);
      console.log(`   To: ${to}`);
      console.log(`   Amount: ${ethers.formatEther(amount)} EAGLE`);
      console.log(`   Dest Chain: ${destChainName} (${destChainId})`);
      console.log(`   Nonce: ${nonce}`);

      const txHash = event.log.transactionHash;
      
      // Determine destination chain
      const toChain = destChainNum === CONTRACTS.bsc.chainId ? 'bsc' : 
                      destChainNum === CONTRACTS.solana.chainId ? 'solana' : 'bsc';
      
      // Create request
      const request: BridgeRequest = {
        txHash,
        fromChain: 'xlayer',
        toChain,
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
      
      // Process based on destination chain
      if (destChainNum === CONTRACTS.bsc.chainId) {
        await this.releaseToBSC(request);
      } else if (destChainNum === CONTRACTS.solana.chainId) {
        await this.mintToSolana(request);
      }
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
    });

    console.log('👂 Listening for BSC bridge events...');
  }

  private async releaseToBSC(request: BridgeRequest) {
    try {
      request.status = 'processing';
      console.log(`\n🔄 Processing release on BSC for nonce ${request.nonce}...`);

      const wallet = this.relayerWallet.connect(this.bscProvider);
      const bridge = new ethers.Contract(CONTRACTS.bsc.bridge, BSC_BRIDGE_ABI, wallet);

      // Create signature
      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
        [request.to, request.amount, request.nonce, CONTRACTS.xlayer.chainId, CONTRACTS.bsc.chainId, CONTRACTS.bsc.bridge]
      );
      const signature = await this.relayerWallet.signMessage(ethers.getBytes(messageHash));

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

      // Create signature
      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
        [request.to, request.amount, CONTRACTS.bsc.chainId, request.nonce, CONTRACTS.xlayer.chainId, CONTRACTS.xlayer.bridge]
      );
      const signature = await this.relayerWallet.signMessage(ethers.getBytes(messageHash));

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
      // Amount is in wei (18 decimals), Solana token also has 18 decimals
      const mintAmount = BigInt(request.amount);
      
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

  // Manual trigger (for API endpoint)
  async notifyBridge(txHash: string, fromChain: 'xlayer' | 'bsc') {
    console.log(`📬 Manual bridge notification: ${txHash} from ${fromChain}`);
    // The event listener will pick this up automatically
    // This is just for logging/tracking purposes
    return { received: true, txHash };
  }
}

// Singleton instance
export const bridgeRelayerService = new BridgeRelayerService();
export default bridgeRelayerService;
