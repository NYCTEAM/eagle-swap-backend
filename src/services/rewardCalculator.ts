/**
 * 奖励计算服务
 * 统一处理所有奖励计算逻辑
 */

import { db } from '../database';

// NFT 等级倍数配置
export const NFT_MULTIPLIERS = {
  1: { name: 'Micro', multiplier: 1.05 },
  2: { name: 'Mini', multiplier: 1.08 },
  3: { name: 'Bronze', multiplier: 1.10 },
  4: { name: 'Silver', multiplier: 1.12 },
  5: { name: 'Gold', multiplier: 1.50 },
  6: { name: 'Platinum', multiplier: 1.80 },
  7: { name: 'Diamond', multiplier: 2.00 },
};

// 基础配置
export const REWARD_CONFIG = {
  // Swap 挖矿基础奖励：0.003 EAGLE / 100 USDT
  SWAP_BASE_REWARD_PER_100_USDT: 0.003,
  
  // 推荐奖励基础：0.001 EAGLE / 100 USDT
  REFERRAL_BASE_REWARD_PER_100_USDT: 0.001,
  
  // NFT 购买推荐返现比例
  NFT_PURCHASE_REFERRAL_RATE: 0.05, // 5%
  
  // 平台手续费
  PLATFORM_FEE_RATE: 0.001, // 0.1%
  
  // EAGLE 初始价格
  EAGLE_PRICE_USDT: 0.1,
};

/**
 * 获取用户持有的最高等级 NFT
 */
export function getUserHighestNFTLevel(userAddress: string): number {
  try {
    const result = db.prepare(`
      SELECT MAX(level) as highest_level
      FROM nodes
      WHERE owner_address = ?
    `).get(userAddress.toLowerCase()) as { highest_level: number | null };
    
    return result?.highest_level || 0;
  } catch (error) {
    console.error('Error getting user highest NFT level:', error);
    return 0;
  }
}

/**
 * 获取 NFT 等级对应的倍数
 */
export function getNFTMultiplier(nftLevel: number): number {
  if (nftLevel === 0) return 1.0; // 无 NFT
  return NFT_MULTIPLIERS[nftLevel as keyof typeof NFT_MULTIPLIERS]?.multiplier || 1.0;
}

/**
 * 计算 Swap 挖矿奖励
 * @param tradeAmountUSDT 交易金额（USDT）
 * @param userAddress 用户地址
 * @returns 奖励金额（EAGLE）
 */
export function calculateSwapReward(
  tradeAmountUSDT: number,
  userAddress: string
): {
  baseReward: number;
  nftLevel: number;
  nftMultiplier: number;
  finalReward: number;
} {
  // 获取用户最高 NFT 等级
  const nftLevel = getUserHighestNFTLevel(userAddress);
  const nftMultiplier = getNFTMultiplier(nftLevel);
  
  // 计算基础奖励
  const baseReward = (tradeAmountUSDT / 100) * REWARD_CONFIG.SWAP_BASE_REWARD_PER_100_USDT;
  
  // 应用 NFT 倍数
  const finalReward = baseReward * nftMultiplier;
  
  return {
    baseReward,
    nftLevel,
    nftMultiplier,
    finalReward,
  };
}

/**
 * 计算 Swap 推荐奖励
 * @param refereeTradeAmountUSDT 被推荐人交易金额（USDT）
 * @param referrerAddress 推荐人地址
 * @returns 推荐奖励金额（EAGLE）
 */
export function calculateSwapReferralReward(
  refereeTradeAmountUSDT: number,
  referrerAddress: string
): {
  baseReward: number;
  nftLevel: number;
  nftMultiplier: number;
  finalReward: number;
} {
  // 获取推荐人最高 NFT 等级
  const nftLevel = getUserHighestNFTLevel(referrerAddress);
  const nftMultiplier = getNFTMultiplier(nftLevel);
  
  // 计算基础推荐奖励
  const baseReward = (refereeTradeAmountUSDT / 100) * REWARD_CONFIG.REFERRAL_BASE_REWARD_PER_100_USDT;
  
  // 应用 NFT 倍数
  const finalReward = baseReward * nftMultiplier;
  
  return {
    baseReward,
    nftLevel,
    nftMultiplier,
    finalReward,
  };
}

/**
 * 计算 NFT 购买推荐奖励
 * @param nftPriceUSDT NFT 价格（USDT）
 * @returns 推荐奖励金额（USDT）
 */
export function calculateNFTPurchaseReferralReward(nftPriceUSDT: number): number {
  return nftPriceUSDT * REWARD_CONFIG.NFT_PURCHASE_REFERRAL_RATE;
}

/**
 * 获取推荐人地址
 */
export function getReferrerAddress(userAddress: string): string | null {
  try {
    const result = db.prepare(`
      SELECT referrer_address
      FROM referral_relationships
      WHERE referee_address = ?
      LIMIT 1
    `).get(userAddress.toLowerCase()) as { referrer_address: string } | undefined;
    
    return result?.referrer_address || null;
  } catch (error) {
    console.error('Error getting referrer address:', error);
    return null;
  }
}

/**
 * 记录 Swap 交易和奖励
 */
export function recordSwapTransaction(params: {
  txHash: string;
  userAddress: string;
  chainId: number;  // 新增：链 ID
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  tradeValueUSDT: number;
  routeInfo?: string;
}): {
  swapReward: number;
  referralReward: number | null;
  referrerAddress: string | null;
} {
  const { txHash, userAddress, chainId, fromToken, toToken, fromAmount, toAmount, tradeValueUSDT, routeInfo } = params;
  
  // 计算 Swap 奖励
  const swapRewardCalc = calculateSwapReward(tradeValueUSDT, userAddress);
  
  // 计算平台手续费
  const feeUSDT = tradeValueUSDT * REWARD_CONFIG.PLATFORM_FEE_RATE;
  
  // 记录交易
  try {
    db.prepare(`
      INSERT INTO swap_transactions (
        tx_hash, user_address, chain_id, from_token, to_token,
        from_amount, to_amount, trade_value_usdt, fee_usdt,
        eagle_reward, route_info
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      txHash,
      userAddress.toLowerCase(),
      chainId,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      tradeValueUSDT,
      feeUSDT,
      swapRewardCalc.finalReward,
      routeInfo || null
    );
  } catch (error) {
    console.error('Error recording swap transaction:', error);
  }
  
  // 检查是否有推荐人
  const referrerAddress = getReferrerAddress(userAddress);
  let referralReward: number | null = null;
  
  if (referrerAddress) {
    // 计算推荐奖励
    const referralRewardCalc = calculateSwapReferralReward(tradeValueUSDT, referrerAddress);
    referralReward = referralRewardCalc.finalReward;
    
    // 记录推荐奖励
    try {
      db.prepare(`
        INSERT INTO referral_rewards (
          referrer_address, referee_address, reward_type, reward_amount
        ) VALUES (?, ?, 'swap', ?)
      `).run(
        referrerAddress.toLowerCase(),
        userAddress.toLowerCase(),
        referralReward
      );
    } catch (error) {
      console.error('Error recording referral reward:', error);
    }
  }
  
  return {
    swapReward: swapRewardCalc.finalReward,
    referralReward,
    referrerAddress,
  };
}

/**
 * 记录 NFT 购买推荐奖励
 */
export function recordNFTPurchaseReferral(params: {
  buyerAddress: string;
  nftLevel: number;
  nftPriceUSDT: number;
}): {
  referralRewardUSDT: number | null;
  referrerAddress: string | null;
} {
  const { buyerAddress, nftLevel, nftPriceUSDT } = params;
  
  // 检查是否有推荐人
  const referrerAddress = getReferrerAddress(buyerAddress);
  
  if (!referrerAddress) {
    return {
      referralRewardUSDT: null,
      referrerAddress: null,
    };
  }
  
  // 计算推荐奖励（USDT）
  const referralRewardUSDT = calculateNFTPurchaseReferralReward(nftPriceUSDT);
  
  // 记录推荐奖励
  try {
    db.prepare(`
      INSERT INTO referral_rewards (
        referrer_address, referee_address, reward_type, reward_amount
      ) VALUES (?, ?, 'nft_purchase', ?)
    `).run(
      referrerAddress.toLowerCase(),
      buyerAddress.toLowerCase(),
      referralRewardUSDT
    );
  } catch (error) {
    console.error('Error recording NFT purchase referral:', error);
  }
  
  return {
    referralRewardUSDT,
    referrerAddress,
  };
}

/**
 * 获取用户奖励统计
 */
export function getUserRewardStats(userAddress: string): {
  swapRewards: {
    total: number;
    claimed: number;
    pending: number;
  };
  referralRewards: {
    total: number;
    claimed: number;
    pending: number;
  };
  nftLevel: number;
  nftMultiplier: number;
} {
  const nftLevel = getUserHighestNFTLevel(userAddress);
  const nftMultiplier = getNFTMultiplier(nftLevel);
  
  // 查询 Swap 奖励
  const swapStats = db.prepare(`
    SELECT 
      COALESCE(SUM(eagle_reward), 0) as total,
      COALESCE(SUM(CASE WHEN claimed = 1 THEN eagle_reward ELSE 0 END), 0) as claimed,
      COALESCE(SUM(CASE WHEN claimed = 0 THEN eagle_reward ELSE 0 END), 0) as pending
    FROM swap_transactions
    WHERE user_address = ?
  `).get(userAddress.toLowerCase()) as any;
  
  // 查询推荐奖励
  const referralStats = db.prepare(`
    SELECT 
      COALESCE(SUM(reward_amount), 0) as total,
      COALESCE(SUM(CASE WHEN claimed = 1 THEN reward_amount ELSE 0 END), 0) as claimed,
      COALESCE(SUM(CASE WHEN claimed = 0 THEN reward_amount ELSE 0 END), 0) as pending
    FROM referral_rewards
    WHERE referrer_address = ?
  `).get(userAddress.toLowerCase()) as any;
  
  return {
    swapRewards: {
      total: swapStats.total || 0,
      claimed: swapStats.claimed || 0,
      pending: swapStats.pending || 0,
    },
    referralRewards: {
      total: referralStats.total || 0,
      claimed: referralStats.claimed || 0,
      pending: referralStats.pending || 0,
    },
    nftLevel,
    nftMultiplier,
  };
}

export default {
  calculateSwapReward,
  calculateSwapReferralReward,
  calculateNFTPurchaseReferralReward,
  getUserHighestNFTLevel,
  getNFTMultiplier,
  getReferrerAddress,
  recordSwapTransaction,
  recordNFTPurchaseReferral,
  getUserRewardStats,
  REWARD_CONFIG,
  NFT_MULTIPLIERS,
};
