import { ethers } from 'ethers';
import { db } from '../database';

/**
 * NFT 持有挖矿服务
 * 完全链下计算奖励，使用签名验证方式领取
 * 
 * 奖励计算公式：
 * 每日奖励 = yearly_rewards 表中预计算的值（已包含年度衰减 + 阶段衰减）
 * 
 * 三重衰减机制：
 * 1. 年度衰减: 第1年100% → 第2年75% → 第3年67.5% → ... → 第10年32.3%
 * 2. 阶段衰减: Stage1=100%, Stage2=95%, Stage3=90%, Stage4=85%, Stage5=80%
 * 3. 等级差异: Level 1-7 不同的基础奖励
 * 
 * 额外加成：
 * - 社区加成: 成员 5-25%, 社区长 10-50%
 */

// 项目启动时间（用于计算当前年份）
const PROJECT_START_DATE = new Date('2025-01-01');

// 多链合约地址配置
const CONTRACT_ADDRESSES: Record<number, string> = {
  196: '0x48a8f56e9dc2b182940fca241fb9c85dfa9e274f',  // X Layer
  56: '0x1c5fD42F77F5D331F08174b1e9dA6E3986cc8364',   // BSC
};

export class NFTMiningService {
  private signerWallet: ethers.Wallet;
  private contractAddresses: Record<number, string>;
  private defaultChainId: number;
  
  constructor() {
    const privateKey = process.env.NFT_MINING_SIGNER_KEY;
    
    if (privateKey) {
      try {
        this.signerWallet = new ethers.Wallet(privateKey);
        console.log(`🔐 NFT Mining Signer: ${this.signerWallet.address}`);
      } catch (e) {
        console.warn('⚠️ NFT_MINING_SIGNER_KEY invalid, signing disabled');
        this.signerWallet = null as any;
      }
    } else {
      console.warn('⚠️ NFT_MINING_SIGNER_KEY not set, signing disabled');
      this.signerWallet = null as any;
    }
    
    this.contractAddresses = CONTRACT_ADDRESSES;
    this.defaultChainId = parseInt(process.env.CHAIN_ID || '196');
    
    console.log('📋 NFT Mining Contracts:');
    console.log(`   X Layer (196): ${this.contractAddresses[196]}`);
    console.log(`   BSC (56): ${this.contractAddresses[56]}`);
  }
  
  getContractAddress(chainId: number): string {
    return this.contractAddresses[chainId] || this.contractAddresses[this.defaultChainId];
  }
  
  /**
   * 计算当前年份（从项目启动开始）
   */
  private getCurrentYear(): number {
    const now = new Date();
    const yearsDiff = Math.floor((now.getTime() - PROJECT_START_DATE.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(yearsDiff + 1, 1), 10); // 1-10年
  }
  
  /**
   * 从数据库获取每日奖励
   * @param level NFT 等级 (1-7)
   * @param stage NFT 阶段 (1-5)
   * @param year 当前年份 (1-10)
   */
  private getDailyReward(level: number, stage: number, year: number): number {
    try {
      const reward = db.prepare(`
        SELECT daily_reward FROM yearly_rewards
        WHERE year = ? AND level_id = ? AND stage = ?
      `).get(year, level, stage) as any;
      
      return reward?.daily_reward || 0;
    } catch (e) {
      console.warn('Failed to get daily reward:', e);
      return 0;
    }
  }
  
  /**
   * 计算用户待领取奖励
   */
  async calculatePendingReward(userAddress: string): Promise<{
    baseReward: number;
    communityBonus: number;
    totalReward: number;
    breakdown: any;
  }> {
    // ============================================
    // 1. 获取用户所有 NFT（支持多链）
    // ============================================
    const nfts = db.prepare(`
      SELECT global_token_id, level, stage, minted_at, chain_id, chain_name
      FROM nft_holders
      WHERE LOWER(owner_address) = LOWER(?)
    `).all(userAddress) as any[];
    
    if (nfts.length === 0) {
      return {
        baseReward: 0,
        communityBonus: 0,
        totalReward: 0,
        breakdown: {
          nftCount: 0,
          highestLevel: 0,
          currentYear: this.getCurrentYear(),
          communityLevel: 0,
          communityBonusPercent: 0,
          isLeader: false,
          daysAccumulated: 0,
        }
      };
    }
    
    // ============================================
    // 2. 获取上次领取时间
    // ============================================
    const lastClaimData = db.prepare(`
      SELECT last_claim_time FROM nft_mining_claims
      WHERE LOWER(user_address) = LOWER(?)
    `).get(userAddress) as any;
    
    const lastClaimTime = lastClaimData?.last_claim_time 
      ? new Date(lastClaimData.last_claim_time) 
      : null;
    
    // ============================================
    // 3. 计算基础奖励
    // 使用 yearly_rewards 表（已包含年度衰减 + 阶段衰减）
    // ============================================
    let baseReward = 0;
    let highestNftLevel = 0;
    const currentYear = this.getCurrentYear();
    const now = new Date();
    
    for (const nft of nfts) {
      const level = nft.level || 1;
      const stage = nft.stage || 1;
      
      // 从数据库获取每日奖励（已包含年度和阶段衰减）
      const dailyReward = this.getDailyReward(level, stage, currentYear);
      
      // 计算持有时间 (从上次领取或 NFT 创建时间开始)
      const nftCreatedAt = nft.minted_at 
        ? new Date(nft.minted_at * 1000) // minted_at 是 Unix 时间戳
        : new Date(nft.created_at);
      const startTime = lastClaimTime || nftCreatedAt;
      const startTimeMs = startTime instanceof Date ? startTime.getTime() : startTime;
      const daysHeld = Math.max(0, (now.getTime() - startTimeMs) / (1000 * 60 * 60 * 24));
      
      baseReward += dailyReward * daysHeld;
      
      if (level > highestNftLevel) {
        highestNftLevel = level;
      }
    }
    
    // 计算累积天数
    const oldestNft = nfts.reduce((oldest, nft) => {
      const nftTime = nft.minted_at ? nft.minted_at * 1000 : new Date(nft.created_at).getTime();
      return nftTime < oldest ? nftTime : oldest;
    }, Date.now());
    const lastClaimTimeMs = lastClaimTime instanceof Date ? lastClaimTime.getTime() : null;
    const startTimeForDays = lastClaimTimeMs || oldestNft;
    const daysAccumulated = Math.max(0, (now.getTime() - startTimeForDays) / (1000 * 60 * 60 * 24));
    
    // ============================================
    // 5. 计算社区加成
    // ============================================
    let communityLevel = 0;
    let communityBonusPercent = 0;
    let isLeader = false;
    
    try {
      const memberData = db.prepare(`
        SELECT 
          cm.is_leader,
          c.community_level,
          COALESCE(clc.member_bonus_rate, 5) as member_bonus_rate,
          COALESCE(clc.leader_bonus_rate, 10) as leader_bonus_rate
        FROM community_members cm
        JOIN communities c ON cm.community_id = c.id
        LEFT JOIN community_level_config clc ON c.community_level = clc.level
        WHERE LOWER(cm.member_address) = LOWER(?)
      `).get(userAddress) as any;
      
      if (memberData) {
        communityLevel = memberData.community_level || 1;
        isLeader = memberData.is_leader === 1;
        communityBonusPercent = isLeader 
          ? memberData.leader_bonus_rate 
          : memberData.member_bonus_rate;
      }
    } catch (e) {
      console.warn('Failed to query community bonus:', e);
    }
    
    const communityBonus = baseReward * (communityBonusPercent / 100);
    
    // ============================================
    // 4. 计算总奖励
    // 注意：基础奖励已经包含了年度衰减和阶段衰减
    // 社区加成是额外的加成
    // ============================================
    const totalReward = baseReward + communityBonus;
    
    console.log(`📊 NFT挖矿奖励计算: 用户 ${userAddress.slice(0, 10)}...`);
    console.log(`   NFT数量: ${nfts.length}, 最高等级: Level ${highestNftLevel}`);
    console.log(`   当前年份: 第${currentYear}年, 累积天数: ${daysAccumulated.toFixed(2)}天`);
    console.log(`   基础奖励: ${baseReward.toFixed(4)} EAGLE (已含年度+阶段衰减)`);
    console.log(`   社区加成: +${communityBonusPercent}% = ${communityBonus.toFixed(4)} EAGLE`);
    console.log(`   总奖励: ${totalReward.toFixed(4)} EAGLE`);
    
    return {
      baseReward,
      communityBonus,
      totalReward,
      breakdown: {
        nftCount: nfts.length,
        highestLevel: highestNftLevel,
        currentYear,
        communityLevel,
        communityBonusPercent,
        isLeader,
        daysAccumulated,
      }
    };
  }
  
  /**
   * 生成领取奖励的签名
   * @param userAddress 用户地址
   * @param chainId 链ID (196=X Layer, 56=BSC)
   */
  async generateClaimSignature(userAddress: string, chainId: number = 196): Promise<{
    success: boolean;
    data?: {
      amount: string;
      nonce: number;
      deadline: number;
      baseReward: string;
      communityBonus: string;
      signature: string;
      contractAddress: string;
      chainId: number;
      breakdown: any;
    };
    error?: string;
  }> {
    try {
      // 检查签名者是否可用
      if (!this.signerWallet) {
        return {
          success: false,
          error: '签名服务未配置，请联系管理员'
        };
      }
      
      // 计算奖励
      const reward = await this.calculatePendingReward(userAddress);
      
      if (reward.totalReward <= 0) {
        return {
          success: false,
          error: '没有可领取的奖励'
        };
      }
      
      // 生成 nonce (使用时间戳 + 随机数)
      const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      
      // 设置过期时间 (10 分钟后)
      const deadline = Math.floor(Date.now() / 1000) + 600;
      
      // 转换为 wei
      const amountWei = ethers.parseEther(reward.totalReward.toFixed(18));
      const baseRewardWei = ethers.parseEther(reward.baseReward.toFixed(18));
      const communityBonusWei = ethers.parseEther(reward.communityBonus.toFixed(18));
      
      // 获取对应链的合约地址
      const contractAddress = this.getContractAddress(chainId);
      
      // 构造消息哈希（简化版，只包含必要参数）
      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
        [
          userAddress,
          amountWei,
          nonce,
          deadline,
          contractAddress,
          chainId
        ]
      );
      
      // 签名
      const signature = await this.signerWallet.signMessage(ethers.getBytes(messageHash));
      
      // 记录签名请求
      try {
        db.prepare(`
          INSERT INTO nft_mining_signature_log 
          (user_address, amount, nonce, deadline, signature, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).run(
          userAddress,
          reward.totalReward.toString(),
          nonce,
          deadline,
          signature
        );
      } catch (e) {
        // 表可能不存在，忽略
      }
      
      console.log(`✅ 签名生成成功: ${userAddress.slice(0, 10)}... 金额: ${reward.totalReward.toFixed(4)} EAGLE`);
      
      return {
        success: true,
        data: {
          amount: amountWei.toString(),
          nonce,
          deadline,
          baseReward: baseRewardWei.toString(),
          communityBonus: communityBonusWei.toString(),
          signature,
          contractAddress,
          chainId,
          breakdown: reward.breakdown
        }
      };
      
    } catch (error: any) {
      console.error('❌ 生成签名失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 记录领取成功 (合约事件回调)
   */
  async recordClaim(params: {
    userAddress: string;
    amount: string;
    nonce: number;
    txHash: string;
  }): Promise<void> {
    try {
      // 更新最后领取时间
      db.prepare(`
        INSERT INTO nft_mining_claims (user_address, last_claim_time, total_claimed)
        VALUES (?, datetime('now'), ?)
        ON CONFLICT(user_address) DO UPDATE SET
          last_claim_time = datetime('now'),
          total_claimed = total_claimed + excluded.total_claimed
      `).run(params.userAddress, params.amount);
      
      // 记录领取历史
      db.prepare(`
        INSERT INTO nft_mining_claim_history 
        (user_address, amount, nonce, tx_hash, claimed_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(params.userAddress, params.amount, params.nonce, params.txHash);
      
      console.log(`✅ 领取记录已保存: ${params.userAddress.slice(0, 10)}... 金额: ${params.amount}`);
      
    } catch (error) {
      console.error('❌ 记录领取失败:', error);
    }
  }
  
  /**
   * 获取用户挖矿统计（支持多链）
   */
  async getUserStats(userAddress: string): Promise<{
    nftCount: number;
    highestLevel: number;
    totalClaimed: number;
    pendingReward: number;
    lastClaimTime: string | null;
    breakdown: any;
  }> {
    // 获取 NFT 数量和最高等级（统计所有链）
    const nftStats = db.prepare(`
      SELECT 
        COUNT(*) as count,
        MAX(level) as highest_level,
        COUNT(DISTINCT chain_id) as chain_count
      FROM nft_holders
      WHERE LOWER(owner_address) = LOWER(?)
    `).get(userAddress) as any;
    
    // 获取已领取总量和最后领取时间
    const claimStats = db.prepare(`
      SELECT 
        COALESCE(total_claimed, 0) as total_claimed,
        last_claim_time
      FROM nft_mining_claims
      WHERE LOWER(user_address) = LOWER(?)
    `).get(userAddress) as any;
    
    // 计算待领取奖励
    const pending = await this.calculatePendingReward(userAddress);
    
    return {
      nftCount: nftStats?.count || 0,
      highestLevel: nftStats?.highest_level || 0,
      totalClaimed: parseFloat(claimStats?.total_claimed || '0'),
      pendingReward: pending.totalReward,
      lastClaimTime: claimStats?.last_claim_time || null,
      breakdown: pending.breakdown
    };
  }
}

// 导出单例
export const nftMiningService = new NFTMiningService();
