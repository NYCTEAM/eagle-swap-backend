import { ethers } from 'ethers';
import { db } from '../database';

// 节点等级算力配置
const NODE_POWER_MAP: { [key: number]: number } = {
  1: 0.1,   // Micro
  2: 0.3,   // Mini
  3: 0.5,   // Bronze
  4: 1,     // Silver
  5: 3,     // Gold
  6: 7,     // Platinum
  7: 15,    // Diamond
};

// 节点等级名称
const NODE_LEVEL_NAMES = ['Micro', 'Mini', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

/**
 * 区块链监听服务
 */
export class BlockchainListener {
  private provider: ethers.JsonRpcProvider;
  private nodeNFT: ethers.Contract;
  private isListening: boolean = false;
  
  constructor() {
    // 使用 Eagle Swap 自定义 X Layer RPC 节点
    const rpcUrl = process.env.XLAYER_RPC_URL || process.env.RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const nodeNFTAddress = process.env.NODE_NFT_ADDRESS || '';
    const nodeNFTABI = [
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
      "function nodes(uint256 tokenId) view returns (uint8 level, uint8 stage, uint16 multiplier, uint256 mintTime)",
    ];
    
    this.nodeNFT = new ethers.Contract(nodeNFTAddress, nodeNFTABI, this.provider);
  }
  
  /**
   * 启动监听
   */
  async start() {
    if (this.isListening) {
      console.log('⚠️ Blockchain listener is already running');
      return;
    }
    
    console.log('🚀 Starting blockchain listener...');
    console.log('📍 RPC URL:', this.provider._getConnection().url);
    console.log('📍 Node NFT:', await this.nodeNFT.getAddress());
    
    try {
      // 获取当前区块号
      const currentBlock = await this.provider.getBlockNumber();
      console.log('📦 Current block:', currentBlock);
      
      // 监听节点铸造事件
      this.listenToNodeMints();
      
      // 同步历史数据（如果需要）
      await this.syncHistoricalData();
      
      this.isListening = true;
      console.log('✅ Blockchain listener started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start blockchain listener:', error);
      throw error;
    }
  }
  
  /**
   * 监听节点铸造事件
   */
  private listenToNodeMints() {
    console.log('👂 Listening to node mint events...');
    
    // 监听 Transfer 事件（from = 0x0 表示铸造）
    this.nodeNFT.on('Transfer', async (from, to, tokenId, event) => {
      if (from === ethers.ZeroAddress) {
        console.log(`\n🎉 New node minted!`);
        console.log(`   Token ID: ${tokenId.toString()}`);
        console.log(`   Owner: ${to}`);
        
        try {
          await this.handleNodeMint(tokenId, to, event);
        } catch (error) {
          console.error('❌ Error handling node mint:', error);
        }
      }
    });
  }
  
  /**
   * 处理节点铸造
   */
  private async handleNodeMint(tokenId: bigint, owner: string, event: any) {
    try {
      // 查询节点信息
      const nodeInfo = await this.nodeNFT.nodes(tokenId);
      
      const level = Number(nodeInfo.level);
      const stage = Number(nodeInfo.stage);
      const multiplier = Number(nodeInfo.multiplier) / 100; // 转换为小数
      const mintTime = new Date(Number(nodeInfo.mintTime) * 1000).toISOString();
      const power = NODE_POWER_MAP[level] || 0;
      const txHash = event.log.transactionHash;
      
      console.log(`   Level: ${level} (${NODE_LEVEL_NAMES[level - 1]})`);
      console.log(`   Stage: ${stage}`);
      console.log(`   Multiplier: ${multiplier}x`);
      console.log(`   Power: ${power}x`);
      console.log(`   TX: ${txHash}`);
      
      // 检查是否已存在
      const existing = db.prepare('SELECT id FROM nodes WHERE token_id = ?').get(tokenId.toString());
      
      if (existing) {
        console.log('   ⚠️ Node already exists in database, skipping...');
        return;
      }
      
      // 保存到数据库
      db.prepare(`
        INSERT INTO nodes (token_id, owner_address, level, stage, difficulty_multiplier, power, mint_time, tx_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tokenId.toString(),
        owner.toLowerCase(),
        level,
        stage,
        multiplier,
        power,
        mintTime,
        txHash
      );
      
      console.log('   ✅ Node saved to database');
      
      // 检查推荐关系并记录推荐奖励
      await this.handleReferralReward(owner, level);
      
    } catch (error) {
      console.error('❌ Error processing node mint:', error);
      throw error;
    }
  }
  
  /**
   * 处理推荐奖励
   */
  private async handleReferralReward(buyer: string, level: number) {
    try {
      // 查询推荐关系
      const relationship = db.prepare(`
        SELECT * FROM referral_relationships WHERE referee_address = ?
      `).get(buyer.toLowerCase()) as any;
      
      if (!relationship) {
        return; // 没有推荐人
      }
      
      // 查询推荐人的节点等级
      const referrerNodes = db.prepare(`
        SELECT level FROM nodes WHERE owner_address = ? ORDER BY level DESC LIMIT 1
      `).get(relationship.referrer_address) as any;
      
      if (!referrerNodes) {
        return; // 推荐人没有节点
      }
      
      // NFT 购买推荐奖励：固定 5% USDT
      const commissionRate = 0.05; // 固定 5%
      
      // 节点价格
      const nodePrices = [10, 25, 50, 100, 250, 500, 1000];
      const nodePrice = nodePrices[level - 1];
      
      // 计算奖励金额（USDT）
      const rewardUSDT = nodePrice * commissionRate;
      
      // 奖励直接是 USDT（不转换为 EAGLE）
      const rewardAmount = rewardUSDT;
      
      // 保存推荐奖励
      db.prepare(`
        INSERT INTO referral_rewards (
          referrer_address, referee_address, event_type, 
          amount_usdt, commission_rate, reward_amount
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        relationship.referrer_address,
        buyer.toLowerCase(),
        'node_purchase',
        nodePrice,
        commissionRate,
        rewardAmount
      );
      
      console.log(`   💰 Referral reward: ${rewardAmount.toFixed(2)} USDT (${commissionRate * 100}%)`);
      
    } catch (error) {
      console.error('❌ Error handling referral reward:', error);
    }
  }
  
  /**
   * 同步历史数据
   */
  private async syncHistoricalData() {
    try {
      // 获取最后同步的区块
      const config = db.prepare(`
        SELECT value FROM system_config WHERE key = 'last_synced_block'
      `).get() as { value: string } | undefined;
      
      const lastSyncedBlock = config ? parseInt(config.value) : 0;
      const currentBlock = await this.provider.getBlockNumber();
      
      if (lastSyncedBlock >= currentBlock) {
        console.log('✅ Already synced to latest block');
        return;
      }
      
      console.log(`📥 Syncing historical data from block ${lastSyncedBlock} to ${currentBlock}...`);
      
      // 查询历史 Transfer 事件
      const filter = this.nodeNFT.filters.Transfer(ethers.ZeroAddress, null, null);
      const events = await this.nodeNFT.queryFilter(filter, lastSyncedBlock + 1, currentBlock);
      
      console.log(`   Found ${events.length} mint events`);
      
      for (const event of events) {
        // Type guard to check if event is EventLog
        if ('args' in event && event.args) {
          const [from, to, tokenId] = event.args as unknown as [string, string, bigint];
          await this.handleNodeMint(tokenId, to, event);
        }
      }
      
      // 更新最后同步的区块
      db.prepare(`
        UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE key = 'last_synced_block'
      `).run(currentBlock.toString());
      
      console.log('✅ Historical data synced successfully');
      
    } catch (error) {
      console.error('❌ Error syncing historical data:', error);
    }
  }
  
  /**
   * 停止监听
   */
  stop() {
    if (!this.isListening) {
      return;
    }
    
    console.log('🛑 Stopping blockchain listener...');
    this.nodeNFT.removeAllListeners();
    this.isListening = false;
    console.log('✅ Blockchain listener stopped');
  }
  
  /**
   * 获取监听状态
   */
  getStatus() {
    return {
      isListening: this.isListening,
      rpcUrl: this.provider._getConnection().url,
      nodeNFTAddress: this.nodeNFT.target,
    };
  }
}

// 创建单例实例
export const blockchainListener = new BlockchainListener();
