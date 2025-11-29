import { ethers } from 'ethers';
import { EventEmitter } from 'events';

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
  fromChain: 'xlayer' | 'bsc';
  toChain: 'xlayer' | 'bsc';
  from: string;
  to: string;
  amount: string;
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
  private relayerWallet: ethers.Wallet;
  private pendingRequests: Map<string, BridgeRequest> = new Map();
  private isRunning: boolean = false;

  constructor() {
    super();
    
    // Initialize providers
    this.xlayerProvider = new ethers.JsonRpcProvider(CONTRACTS.xlayer.rpc);
    this.bscProvider = new ethers.JsonRpcProvider(CONTRACTS.bsc.rpc);
    
    // Initialize relayer wallet
    const privateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!privateKey) {
      console.warn('⚠️ RELAYER_PRIVATE_KEY not set, bridge relayer will not work');
      this.relayerWallet = ethers.Wallet.createRandom();
    } else {
      this.relayerWallet = new ethers.Wallet(privateKey);
    }
    
    console.log(`🦅 Bridge Relayer initialized`);
    console.log(`   Relayer address: ${this.relayerWallet.address}`);
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
      console.log(`\n📤 X Layer BridgeOut detected:`);
      console.log(`   From: ${from}`);
      console.log(`   To: ${to}`);
      console.log(`   Amount: ${ethers.formatEther(amount)} EAGLE`);
      console.log(`   Dest Chain: ${destChainId}`);
      console.log(`   Nonce: ${nonce}`);

      const txHash = event.log.transactionHash;
      
      // Create request
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
      
      // Process on BSC
      if (Number(destChainId) === CONTRACTS.bsc.chainId) {
        await this.releaseToBSC(request);
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
      
      console.log(`✅ Release completed on BSC!`);
      this.emit('bridgeCompleted', request);
      
    } catch (error: any) {
      console.error(`❌ Release to BSC failed:`, error.message);
      request.status = 'failed';
      request.error = error.message;
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
      
      console.log(`✅ Release completed on X Layer!`);
      this.emit('bridgeCompleted', request);
      
    } catch (error: any) {
      console.error(`❌ Release to X Layer failed:`, error.message);
      request.status = 'failed';
      request.error = error.message;
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
    return Array.from(this.pendingRequests.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
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
