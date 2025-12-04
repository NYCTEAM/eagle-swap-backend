import { db } from '../database';
import { ethers } from 'ethers';

/**
 * SWAP 交易挖矿服务
 */
export class SwapMiningService {
  
  /**
   * 记录交易并计算奖励
   */
  async recordSwap(params: {
    txHash: string;
    userAddress: string;
    fromToken: string;
    toToken: string;
    fromAmount: number;
    toAmount: number;
    tradeValueUsdt: number;
    chainId: number;
    routeInfo?: string;
    fromTokenSymbol?: string;
    toTokenSymbol?: string;
    swapType?: 'instant' | 'twap' | 'limit';
    fromTokenDecimals?: number;
    toTokenDecimals?: number;
  }) {
    try {
      console.log(`📝 记录 SWAP 交易: ${params.txHash}`);
      
      // 获取配置
      const config = db.prepare('SELECT * FROM swap_mining_config WHERE id = 1').get() as any;
      
      // 计算手续费
      const feeUsdt = params.tradeValueUsdt * config.fee_rate;
      
      // 计算基础奖励
      const baseReward = params.tradeValueUsdt * config.reward_rate;
      
      // 获取用户 NFT 权重并计算加成
      let eagleReward = baseReward;
      let nftMultiplier = 1.0;
      let nftLevel = 0;
      
      if (config.nft_bonus_enabled) {
        // 查询用户最高等级 NFT 的固定倍数 (从 user_nfts + nft_level_bonus 表)
        const topNft = db.prepare(`
          SELECT 
            n.level,
            nb.bonus_multiplier
          FROM user_nfts n
          LEFT JOIN nft_level_bonus nb ON n.level = nb.nft_level
          WHERE n.owner_address = ?
          ORDER BY n.level DESC
          LIMIT 1
        `).get(params.userAddress.toLowerCase()) as any;
        
        if (topNft && topNft.bonus_multiplier) {
          nftLevel = topNft.level;
          nftMultiplier = topNft.bonus_multiplier;
          // NFT 加成：基础奖励 * NFT倍数（不包含VIP，VIP在其他地方计算）
          eagleReward = baseReward * nftMultiplier;
          
          // 记录 NFT 加成日志
          db.prepare(`
            INSERT INTO swap_mining_nft_bonus_log 
            (user_address, tx_hash, base_reward, nft_weight, bonus_percent, bonus_amount, final_reward)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            params.userAddress,
            params.txHash,
            baseReward,
            nftLevel,
            (nftMultiplier - 1) * 100, // 转换为加成百分比
            eagleReward - baseReward,
            eagleReward
          );
          
          console.log(`🎁 NFT 加成: Level ${nftLevel} → ${nftMultiplier}x → ${eagleReward.toFixed(4)} EAGLE (基础 ${baseReward.toFixed(4)})`);
        }
      }
      
      // 确保用户存在
      db.prepare('INSERT OR IGNORE INTO users (wallet_address) VALUES (?)').run(params.userAddress.toLowerCase());
      
      // 插入交易记录
      const insertTx = db.prepare(`
        INSERT INTO swap_transactions 
        (tx_hash, user_address, from_token, to_token, from_amount, to_amount, 
         trade_value_usdt, fee_usdt, eagle_reward, route_info, chain_id, 
         from_token_symbol, to_token_symbol, swap_type, from_token_decimals, to_token_decimals)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertTx.run(
        params.txHash,
        params.userAddress.toLowerCase(),
        params.fromToken,
        params.toToken,
        params.fromAmount,
        params.toAmount,
        params.tradeValueUsdt,
        feeUsdt,
        eagleReward,
        params.routeInfo || 'Direct swap',
        params.chainId,
        params.fromTokenSymbol || null,
        params.toTokenSymbol || null,
        params.swapType || 'instant',
        params.fromTokenDecimals || 18,
        params.toTokenDecimals || 18
      );
      
      // 更新用户统计
      await this.updateUserStats(params.userAddress, params.tradeValueUsdt, feeUsdt, eagleReward);
      
      // 更新每日统计
      await this.updateDailyStats(params.tradeValueUsdt, feeUsdt, eagleReward);
      
      console.log(`✅ 交易记录成功: ${params.tradeValueUsdt} USDT → ${eagleReward.toFixed(4)} EAGLE`);
      
      return {
        success: true,
        data: {
          txHash: params.txHash,
          tradeValue: params.tradeValueUsdt,
          fee: feeUsdt,
          baseReward: baseReward,
          nftLevel: nftLevel,
          nftMultiplier: nftMultiplier,
          bonusAmount: eagleReward - baseReward,
          eagleReward: eagleReward,
        }
      };
    } catch (error) {
      console.error('❌ 记录交易失败:', error);
      throw error;
    }
  }
  
  /**
   * 更新用户统计
   */
  private async updateUserStats(
    userAddress: string, 
    tradeValue: number, 
    fee: number, 
    eagle: number
  ) {
    // 确保用户存在
    db.prepare('INSERT OR IGNORE INTO users (wallet_address) VALUES (?)').run(userAddress);
    
    // 更新统计
    const updateStats = db.prepare(`
      INSERT INTO user_swap_stats 
      (user_address, total_trades, total_volume_usdt, total_fee_paid, total_eagle_earned, 
       first_trade_at, last_trade_at, updated_at)
      VALUES (?, 1, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(user_address) DO UPDATE SET
        total_trades = total_trades + 1,
        total_volume_usdt = total_volume_usdt + ?,
        total_fee_paid = total_fee_paid + ?,
        total_eagle_earned = total_eagle_earned + ?,
        last_trade_at = datetime('now'),
        updated_at = datetime('now')
    `);
    
    updateStats.run(userAddress, tradeValue, fee, eagle, tradeValue, fee, eagle);
  }
  
  /**
   * 更新每日统计
   */
  private async updateDailyStats(tradeValue: number, fee: number, eagle: number) {
    const today = new Date().toISOString().split('T')[0];
    
    const updateDaily = db.prepare(`
      INSERT INTO daily_swap_stats 
      (stat_date, total_trades, total_volume_usdt, total_fee_collected, total_eagle_distributed, unique_traders)
      VALUES (?, 1, ?, ?, ?, 1)
      ON CONFLICT(stat_date) DO UPDATE SET
        total_trades = total_trades + 1,
        total_volume_usdt = total_volume_usdt + ?,
        total_fee_collected = total_fee_collected + ?,
        total_eagle_distributed = total_eagle_distributed + ?
    `);
    
    updateDaily.run(today, tradeValue, fee, eagle, tradeValue, fee, eagle);
  }
  

  
  /**
   * 获取用户统计
   */
  getUserStats(userAddress: string) {
    try {
      // 标准化地址为小写
      const normalizedAddress = userAddress.toLowerCase();
      
      // 用户基本统计 - 从 swap_transactions 表实时计算
      let stats;
      try {
        stats = db.prepare(`
          SELECT 
            COUNT(*) as total_trades,
            COALESCE(SUM(trade_value_usdt), 0) as total_volume_usdt,
            COALESCE(SUM(fee_usdt), 0) as total_fee_paid,
            COALESCE(SUM(eagle_reward), 0) as total_eagle_earned,
            0 as total_eagle_claimed
          FROM swap_transactions 
          WHERE user_address = ?
        `).get(normalizedAddress) as any;
      } catch (e) {
        stats = null;
      }
      
      // 用户等级 (使用 VIP 等级代替)
      let tier;
      try {
        const volumeData = db.prepare(`
          SELECT COALESCE(SUM(trade_value_usdt), 0) as total_volume
          FROM swap_transactions
          WHERE user_address = ?
        `).get(normalizedAddress) as any;
        
        const cumulativeVolume = volumeData?.total_volume || 0;
        
        // 获取当前 VIP 等级
        const currentVip = db.prepare(`
          SELECT * FROM vip_levels 
          WHERE min_volume_usdt <= ? 
          ORDER BY vip_level DESC 
          LIMIT 1
        `).get(cumulativeVolume) as any;
        
        tier = {
          tier_name: currentVip?.vip_name || 'Bronze',
          multiplier: currentVip?.boost_percentage ? currentVip.boost_percentage / 100 : 1.0,
          total_volume: cumulativeVolume,
          vip_level: currentVip?.vip_level || 0,
          boost_percentage: currentVip?.boost_percentage || 100
        };
      } catch (e) {
        tier = {
          tier_name: 'Bronze',
          multiplier: 1.0,
          total_volume: 0,
          vip_level: 0,
          boost_percentage: 100
        };
      }
      
      // 待领取奖励 - 直接从 swap_transactions 计算
      // 因为奖励已经在交易时计算并保存,所有未领取的奖励就是 total_eagle_earned - total_eagle_claimed
      let pendingRewards = 0;
      try {
        // 方案1: 从 swap_mining_rewards 表查询(如果有记录)
        const pending = db.prepare(`
          SELECT COALESCE(SUM(eagle_earned), 0) as total
          FROM swap_mining_rewards 
          WHERE user_address = ? AND claimed = 0
        `).get(normalizedAddress) as any;
        
        // 方案2: 如果 swap_mining_rewards 表为空,直接使用 total_eagle_earned
        if (pending?.total > 0) {
          pendingRewards = pending.total;
        } else {
          // 所有已获得的奖励都是待领取的(因为 total_eagle_claimed = 0)
          pendingRewards = stats?.total_eagle_earned || 0;
        }
      } catch (e) {
        // 出错时使用 total_eagle_earned 作为待领取奖励
        pendingRewards = stats?.total_eagle_earned || 0;
      }
      
      // 获取用户拥有的 NFT 数量
      let ownedNfts = [];
      try {
        ownedNfts = db.prepare(`
          SELECT n.*, i.name as level_name, i.weight as power
          FROM user_nfts n
          LEFT JOIN nft_inventory i ON n.level = i.level
          WHERE n.owner_address = ?
        `).all(normalizedAddress) as any[];
      } catch (e) {
        ownedNfts = [];
      }
      
      // 获取最高等级 NFT 的固定倍数
      let nftMultiplier = 1.0;
      let hasNft = false;
      let topNftData = null;
      try {
        const topNft = db.prepare(`
          SELECT n.level, i.name as level_name, nb.bonus_multiplier, i.weight
          FROM user_nfts n
          LEFT JOIN nft_inventory i ON n.level = i.level
          LEFT JOIN nft_level_bonus nb ON n.level = nb.nft_level
          WHERE n.owner_address = ?
          ORDER BY n.level DESC
          LIMIT 1
        `).get(normalizedAddress) as any;
        
        if (topNft) {
          hasNft = true;
          if (topNft.bonus_multiplier) {
            nftMultiplier = topNft.bonus_multiplier;
          }
          topNftData = {
            level: topNft.level,
            tier_name: topNft.level_name || `Level ${topNft.level}`,
            boost: (nftMultiplier - 1) * 100, // 额外加成百分比 (例如 1.05 -> 5%)
            weight: topNft.weight || 0
          };
        }
      } catch (e) {
        nftMultiplier = 1.0;
        hasNft = false;
      }
      
      // 计算加成:
      // - VIP Boost: 基础 100% + VIP 等级加成 (例如 Bronze = 100%)
      // - NFT Boost: NFT 总倍数百分比 (例如 1.05x = 105%)
      // - Combined Boost: VIP Boost + NFT Boost (例如 100% + 105% = 205%)
      const nftBoostPercentage = hasNft ? nftMultiplier * 100 : 0; // NFT 总倍数百分比
      const combinedBoost = tier.boost_percentage + nftBoostPercentage;
      
      return {
        success: true,
        data: {
          user_address: userAddress,
          total_trades: stats?.total_trades || 0,
          total_volume_usdt: stats?.total_volume_usdt || tier.total_volume,
          total_fee_paid: stats?.total_fee_paid || 0,
          total_eagle_earned: stats?.total_eagle_earned || 0,
          total_eagle_claimed: stats?.total_eagle_claimed || 0,
          pending_rewards: pendingRewards,
          current_vip_level: tier.vip_level,
          vip_boost: tier.boost_percentage,
          nft_boost: nftBoostPercentage, // 返回百分比 (例如 105)
          combined_boost: combinedBoost,
          owned_nfts: ownedNfts,
          nft: topNftData, // 添加最高等级 NFT 信息
          tier: tier
        }
      };
    } catch (error) {
      console.error('❌ 获取用户统计失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取用户交易历史
   */
  getUserTransactions(userAddress: string, limit: number = 50) {
    try {
      const transactions = db.prepare(`
        SELECT * FROM swap_transactions 
        WHERE user_address = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `).all(userAddress, limit);
      
      return {
        success: true,
        data: {
          transactions,
          total: transactions.length,
        }
      };
    } catch (error) {
      console.error('❌ 获取交易历史失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取待领取奖励
   */
  getPendingRewards(userAddress: string) {
    try {
      const rewards = db.prepare(`
        SELECT * FROM swap_mining_rewards 
        WHERE user_address = ? AND claimed = 0
        ORDER BY reward_date DESC
      `).all(userAddress);
      
      const total = rewards.reduce((sum: number, r: any) => sum + r.eagle_earned, 0);
      
      return {
        success: true,
        data: {
          rewards,
          total,
        }
      };
    } catch (error) {
      console.error('❌ 获取待领取奖励失败:', error);
      throw error;
    }
  }
  
  /**
   * 生成领取奖励的签名 (新版本 - 与链上合约配合)
   */
  async generateClaimSignature(userAddress: string) {
    try {
      console.log(`🔐 生成领取签名: ${userAddress}`);
      
      // 1. 计算用户待领取奖励
      const pendingRewards = this.calculatePendingRewards(userAddress);
      
      if (pendingRewards <= 0) {
        return {
          success: false,
          error: 'No pending rewards'
        };
      }
      
      // 2. 获取签名配置 (无最小提取限制，用户支付 Gas)
      const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
      const contractAddress = process.env.SWAP_MINING_REWARDS_ADDRESS;
      const chainId = parseInt(process.env.XLAYER_CHAIN_ID || '196');
      
      if (!signerPrivateKey || !contractAddress) {
        throw new Error('Missing signer configuration');
      }
      
      // 4. 获取用户 nonce (从合约或数据库)
      const userNonce = await this.getUserNonce(userAddress);
      
      // 5. 设置签名过期时间
      const expiryMinutes = parseInt(process.env.SIGNATURE_EXPIRY_MINUTES || '30');
      const deadline = Math.floor(Date.now() / 1000) + (expiryMinutes * 60);
      
      // 6. 生成签名消息 (Match updated SwapMining.sol contract)
      // Contract: keccak256(abi.encode(user, amount, nonce, deadline))
      const amountBN = ethers.parseEther(pendingRewards.toString());
      
      // Use solidityPacked for abi.encode equivalent
      const messageHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256', 'uint256', 'uint256'],
          [userAddress, amountBN, userNonce, deadline]
        )
      );
      
      // 7. 签名
      const wallet = new ethers.Wallet(signerPrivateKey);
      // ethers.wallet.signMessage automatically adds the "\x19Ethereum Signed Message:\n32" prefix
      const signature = await wallet.signMessage(ethers.getBytes(messageHash));
      
      console.log(`✅ 签名生成成功: ${pendingRewards} EAGLE (deadline: ${new Date(deadline * 1000).toISOString()})`);
      
      return {
        success: true,
        data: {
          userAddress,
          amount: amountBN.toString(), // wei format for contract
          amountFormatted: pendingRewards, 
          nonce: userNonce,
          deadline,
          signature,
          contractAddress
        }
      };
      
    } catch (error) {
      console.error('❌ 生成签名失败:', error);
      throw error;
    }
  }
  
  /**
   * 计算用户待领取奖励 (从数据库)
   */
  private calculatePendingRewards(userAddress: string): number {
    try {
      // 方案1: 从 swap_transactions 计算总奖励
      const stats = db.prepare(`
        SELECT COALESCE(SUM(eagle_reward), 0) as total_earned
        FROM swap_transactions 
        WHERE user_address = ?
      `).get(userAddress.toLowerCase()) as any;
      
      // 方案2: 减去已领取的奖励 (如果有记录)
      const claimed = db.prepare(`
        SELECT COALESCE(total_eagle_claimed, 0) as total_claimed
        FROM user_swap_stats 
        WHERE user_address = ?
      `).get(userAddress.toLowerCase()) as any;
      
      const totalEarned = stats?.total_earned || 0;
      const totalClaimed = claimed?.total_claimed || 0;
      const pending = totalEarned - totalClaimed;
      
      console.log(`📊 奖励计算: 总获得=${totalEarned}, 已领取=${totalClaimed}, 待领取=${pending}`);
      
      return Math.max(0, pending);
    } catch (error) {
      console.error('❌ 计算奖励失败:', error);
      return 0;
    }
  }
  
  /**
   * 获取用户 nonce (防重放攻击)
   */
  private async getUserNonce(userAddress: string): Promise<number> {
    try {
      // 从数据库获取或初始化 nonce
      let nonceRecord = db.prepare(`
        SELECT nonce FROM user_claim_nonce WHERE user_address = ?
      `).get(userAddress.toLowerCase()) as any;
      
      if (!nonceRecord) {
        // 初始化 nonce
        db.prepare(`
          INSERT INTO user_claim_nonce (user_address, nonce) VALUES (?, 0)
        `).run(userAddress.toLowerCase());
        return 0;
      }
      
      return nonceRecord.nonce;
    } catch (error) {
      console.error('❌ 获取 nonce 失败:', error);
      return 0;
    }
  }
  
  /**
   * 标记奖励已领取 (在用户成功调用合约后调用)
   */
  async markRewardsClaimed(userAddress: string, amount: number) {
    try {
      // 更新已领取统计
      db.prepare(`
        INSERT INTO user_swap_stats 
        (user_address, total_eagle_claimed, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_address) DO UPDATE SET
          total_eagle_claimed = total_eagle_claimed + ?,
          updated_at = datetime('now')
      `).run(userAddress.toLowerCase(), amount, amount);
      
      // 增加 nonce
      db.prepare(`
        UPDATE user_claim_nonce 
        SET nonce = nonce + 1 
        WHERE user_address = ?
      `).run(userAddress.toLowerCase());
      
      console.log(`✅ 标记已领取: ${userAddress} → ${amount} EAGLE`);
      
      return { success: true };
    } catch (error) {
      console.error('❌ 标记领取失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取平台统计
   */
  getPlatformStats() {
    try {
      // 总统计
      const totalStats = db.prepare(`
        SELECT 
          COUNT(DISTINCT user_address) as total_users,
          COUNT(*) as total_transactions,
          COALESCE(SUM(trade_value_usdt), 0) as total_volume,
          COALESCE(SUM(fee_usdt), 0) as total_fees,
          COALESCE(SUM(eagle_reward), 0) as total_eagle_distributed
        FROM swap_transactions
      `).get() as any;
      
      // 今日统计
      const today = new Date().toISOString().split('T')[0];
      const todayStats = db.prepare(`
        SELECT * FROM daily_swap_stats WHERE stat_date = ?
      `).get(today) as any;
      
      // 最近7天统计
      const recentStats = db.prepare(`
        SELECT * FROM daily_swap_stats 
        ORDER BY stat_date DESC 
        LIMIT 7
      `).all();
      
      return {
        success: true,
        data: {
          total: totalStats,
          today: todayStats || {
            total_trades: 0,
            total_volume_usdt: 0,
            total_fee_collected: 0,
            total_eagle_distributed: 0,
          },
          recent: recentStats,
        }
      };
    } catch (error) {
      console.error('❌ 获取平台统计失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取排行榜
   */
  getLeaderboard(type: 'volume' | 'eagle' = 'volume', limit: number = 10) {
    try {
      const orderBy = type === 'volume' ? 'total_volume_usdt' : 'total_eagle_earned';
      
      const leaderboard = db.prepare(`
        SELECT 
          s.*,
          t.tier_name,
          t.multiplier
        FROM user_swap_stats s
        LEFT JOIN user_current_tier t ON s.user_address = t.wallet_address
        ORDER BY ${orderBy} DESC
        LIMIT ?
      `).all(limit);
      
      return {
        success: true,
        data: {
          leaderboard,
          type,
        }
      };
    } catch (error) {
      console.error('❌ 获取排行榜失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户完整的挖矿状态（包含 VIP 和 NFT 加成）
   */
  async getUserMiningStatus(userAddress: string) {
    try {
      // 1. 获取用户累计交易量
      const volumeData = db.prepare(`
        SELECT 
          COALESCE(SUM(trade_value_usdt), 0) as cumulative_volume,
          COUNT(*) as total_trades
        FROM swap_transactions 
        WHERE user_address = ?
      `).get(userAddress) as any;

      const cumulativeVolume = volumeData?.cumulative_volume || 0;

      // 2. 根据交易量确定 VIP 等级
      const vipLevel = db.prepare(`
        SELECT vip_level, vip_name, boost_percentage, description, min_volume_usdt, max_volume_usdt
        FROM vip_levels
        WHERE min_volume_usdt <= ?
        ORDER BY min_volume_usdt DESC
        LIMIT 1
      `).get(cumulativeVolume) as any;

      const currentVip = vipLevel || { vip_level: 0, vip_name: 'VIP 0', boost_percentage: 100 };

      // 3. 获取下一个 VIP 等级
      const nextVip = db.prepare(`
        SELECT vip_level, vip_name, min_volume_usdt, boost_percentage
        FROM vip_levels
        WHERE vip_level = ?
      `).get(currentVip.vip_level + 1) as any;

      // 4. 获取用户 NFT 数据 (从 user_nfts 表)
      let nftData = null;
      let nftMultiplier = 1.0; // NFT 固定倍数 (默认 1.0x)
      let nftLevel = 0;
      let tierName = 'None';

      try {
        const normalizedAddr = userAddress.toLowerCase();
        
        // 获取最高等级的 NFT（决定加成倍数）
        const topNft = db.prepare(`
          SELECT 
            n.level,
            i.name as level_name,
            nb.bonus_multiplier
          FROM user_nfts n
          LEFT JOIN nft_inventory i ON n.level = i.level
          LEFT JOIN nft_level_bonus nb ON n.level = nb.nft_level
          WHERE n.owner_address = ?
          ORDER BY n.level DESC
          LIMIT 1
        `).get(normalizedAddr) as any;
        
        if (topNft) {
          nftLevel = topNft.level;
          tierName = topNft.level_name || `Level ${topNft.level}`;
          nftMultiplier = topNft.bonus_multiplier || 1.0;
        }
        
        // NFT 加成转换为百分比 (1.05 = 105%, 1.20 = 120%, 没有NFT = 0%)
        const nftBoostPercentage = topNft ? nftMultiplier * 100 : 0;
        
        nftData = {
          nft_level: nftLevel,
          tier_name: tierName,
          nft_boost: nftBoostPercentage
        };
        
      } catch (error: any) {
        console.log('⚠️ NFT 数据查询失败，使用默认值:', error?.message || error);
      }
      
      // 5. 计算总加成 (VIP百分比 + NFT百分比)
      // 如果没有 NFT (nftLevel = 0)，NFT 加成为 0%
      const nftBoostPercentage = nftLevel > 0 ? nftMultiplier * 100 : 0;
      const totalBoost = currentVip.boost_percentage + nftBoostPercentage;
      const totalMultiplier = totalBoost / 100; // 转换为倍数用于计算奖励

      // 6. 获取基础配置
      const config = db.prepare('SELECT reward_rate FROM swap_mining_config WHERE id = 1').get() as any;
      const baseRate = config?.reward_rate || 0.0003;
      const baseAmount = 100; // 固定基准金额

      // 7. 获取用户总收益
      const rewardData = db.prepare(`
        SELECT 
          COALESCE(SUM(eagle_earned), 0) as total_earned,
          COALESCE(SUM(CASE WHEN claimed = 1 THEN eagle_earned ELSE 0 END), 0) as total_claimed
        FROM swap_mining_rewards
        WHERE user_address = ?
      `).get(userAddress) as any;

      const totalEarned = rewardData?.total_earned || 0;
      const totalClaimed = rewardData?.total_claimed || 0;
      const pendingReward = totalEarned - totalClaimed;

      // 8. 计算示例奖励 (基础奖励 * 总倍数)
      const rewardPer100Usdt = baseRate * totalMultiplier;

      return {
        success: true,
        data: {
          user_address: userAddress,
          cumulative_volume: cumulativeVolume,
          total_trades: volumeData.total_trades,
          vip: {
            level: currentVip.vip_level,
            name: currentVip.vip_name,
            boost: currentVip.boost_percentage,
            description: currentVip.description,
            next_level: nextVip ? {
              level: nextVip.vip_level,
              name: nextVip.vip_name,
              required_volume: nextVip.min_volume_usdt,
              remaining_volume: Math.max(0, nextVip.min_volume_usdt - cumulativeVolume),
              boost: nextVip.boost_percentage
            } : null
          },
          nft: {
            level: nftLevel,
            tier_name: nftData?.tier_name || 'None',
            boost: nftMultiplier
          },
          rewards: {
            total_boost: totalBoost,
            base_rate: baseRate,
            base_amount: baseAmount,
            reward_per_100_usdt: rewardPer100Usdt,
            total_earned: totalEarned,
            total_claimed: totalClaimed,
            pending: pendingReward
          },
          examples: {
            '100_usdt': rewardPer100Usdt,
            '1000_usdt': rewardPer100Usdt * 10,
            '10000_usdt': rewardPer100Usdt * 100
          }
        }
      };
    } catch (error) {
      console.error('❌ 获取用户挖矿状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有 VIP 等级
   */
  getVipLevels() {
    try {
      const levels = db.prepare('SELECT * FROM vip_levels ORDER BY vip_level').all();
      return {
        success: true,
        data: levels
      };
    } catch (error) {
      console.error('❌ 获取 VIP 等级失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有 NFT 等级加成
   */
  getNftBoosts() {
    try {
      const boosts = db.prepare('SELECT * FROM nft_level_bonus ORDER BY nft_level').all();
      return {
        success: true,
        data: boosts
      };
    } catch (error) {
      console.error('❌ 获取 NFT 加成失败:', error);
      throw error;
    }
  }

  /**
   * 获取奖励计算矩阵
   */
  getRewardMatrix() {
    try {
      const matrix = db.prepare(`
        SELECT 
          v.vip_level,
          v.vip_name,
          v.boost_percentage as vip_boost,
          n.nft_level,
          n.nft_tier_name,
          n.bonus_percentage as nft_boost,
          (v.boost_percentage * n.bonus_percentage / 100) as total_boost,
          ROUND(0.003 * v.boost_percentage * n.bonus_percentage / 10000, 6) as eagle_per_100_usdt
        FROM vip_levels v
        CROSS JOIN nft_level_bonus n
        ORDER BY v.vip_level, n.nft_level
      `).all();
      
      return {
        success: true,
        data: matrix
      };
    } catch (error) {
      console.error('❌ 获取奖励矩阵失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
export const swapMiningService = new SwapMiningService();
