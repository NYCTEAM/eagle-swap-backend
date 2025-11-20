/**
 * NFT 阶段管理系统
 * 
 * 功能：
 * - 管理 7 个等级的 5 个阶段
 * - 自动计算当前阶段
 * - 计算阶段算力衰减
 * - 追踪每个阶段的销售进度
 */

import { db } from '../database';

// NFT 等级配置
export const NFT_LEVELS = {
  1: { name: 'Micro', price: 10, basePower: 0.1 },
  2: { name: 'Mini', price: 25, basePower: 0.3 },
  3: { name: 'Bronze', price: 50, basePower: 0.5 },
  4: { name: 'Silver', price: 100, basePower: 1 },
  5: { name: 'Gold', price: 250, basePower: 3 },
  6: { name: 'Platinum', price: 500, basePower: 7 },
  7: { name: 'Diamond', price: 1000, basePower: 15 },
} as const;

// 阶段配置（5 个阶段）
export const STAGE_CONFIG = {
  1: { multiplier: 1.0, name: 'Stage 1 - Early Bird' },      // 100% 算力
  2: { multiplier: 0.95, name: 'Stage 2' },                  // 95% 算力
  3: { multiplier: 0.90, name: 'Stage 3' },                  // 90% 算力
  4: { multiplier: 0.85, name: 'Stage 4' },                  // 85% 算力
  5: { multiplier: 0.80, name: 'Stage 5 - Final' },          // 80% 算力
} as const;

// 每个等级的总供应量和阶段分配
export const LEVEL_SUPPLY_CONFIG = {
  1: { // Micro - 总共 5000 个
    totalSupply: 5000,
    stageSupply: [1000, 1000, 1000, 1000, 1000], // 每阶段 1000 个
  },
  2: { // Mini - 总共 2500 个
    totalSupply: 2500,
    stageSupply: [500, 500, 500, 500, 500],
  },
  3: { // Bronze - 总共 2000 个
    totalSupply: 2000,
    stageSupply: [400, 400, 400, 400, 400],
  },
  4: { // Silver - 总共 1500 个
    totalSupply: 1500,
    stageSupply: [300, 300, 300, 300, 300],
  },
  5: { // Gold - 总共 800 个
    totalSupply: 800,
    stageSupply: [160, 160, 160, 160, 160],
  },
  6: { // Platinum - 总共 600 个
    totalSupply: 600,
    stageSupply: [120, 120, 120, 120, 120],
  },
  7: { // Diamond - 总共 500 个
    totalSupply: 500,
    stageSupply: [100, 100, 100, 100, 100],
  },
} as const;

/**
 * NFT 阶段管理器
 */
export class NFTStageManager {
  
  /**
   * 获取指定等级的当前阶段
   * @param level NFT 等级 (1-7)
   * @returns 当前阶段 (1-5)
   */
  getCurrentStage(level: number): number {
    // 查询该等级已售数量
    const result = db.prepare(`
      SELECT COUNT(*) as sold_count
      FROM nodes
      WHERE level = ?
    `).get(level) as { sold_count: number };
    
    const soldCount = result?.sold_count || 0;
    const supplyConfig = LEVEL_SUPPLY_CONFIG[level as keyof typeof LEVEL_SUPPLY_CONFIG];
    
    if (!supplyConfig) {
      throw new Error(`Invalid level: ${level}`);
    }
    
    // 计算当前阶段
    let cumulativeSupply = 0;
    for (let stage = 1; stage <= 5; stage++) {
      cumulativeSupply += supplyConfig.stageSupply[stage - 1];
      if (soldCount < cumulativeSupply) {
        return stage;
      }
    }
    
    // 如果全部售罄，返回最后一个阶段
    return 5;
  }
  
  /**
   * 获取指定等级和阶段的详细信息
   */
  getStageInfo(level: number, stage: number) {
    const levelConfig = NFT_LEVELS[level as keyof typeof NFT_LEVELS];
    const stageConfig = STAGE_CONFIG[stage as keyof typeof STAGE_CONFIG];
    const supplyConfig = LEVEL_SUPPLY_CONFIG[level as keyof typeof LEVEL_SUPPLY_CONFIG];
    
    if (!levelConfig || !stageConfig || !supplyConfig) {
      throw new Error(`Invalid level ${level} or stage ${stage}`);
    }
    
    // 计算该阶段的起始和结束数量
    let stageStart = 0;
    for (let i = 0; i < stage - 1; i++) {
      stageStart += supplyConfig.stageSupply[i];
    }
    const stageEnd = stageStart + supplyConfig.stageSupply[stage - 1];
    
    // 查询当前已售数量
    const result = db.prepare(`
      SELECT COUNT(*) as sold_count
      FROM nodes
      WHERE level = ?
    `).get(level) as { sold_count: number };
    
    const totalSold = result?.sold_count || 0;
    
    // 计算该阶段已售数量
    const stageSold = Math.max(0, Math.min(totalSold - stageStart, supplyConfig.stageSupply[stage - 1]));
    const stageRemaining = supplyConfig.stageSupply[stage - 1] - stageSold;
    
    // 计算最终算力
    const finalPower = levelConfig.basePower * stageConfig.multiplier;
    
    return {
      level,
      levelName: levelConfig.name,
      stage,
      stageName: stageConfig.name,
      price: levelConfig.price,
      basePower: levelConfig.basePower,
      stageMultiplier: stageConfig.multiplier,
      finalPower,
      stageSupply: supplyConfig.stageSupply[stage - 1],
      stageSold,
      stageRemaining,
      totalSupply: supplyConfig.totalSupply,
      totalSold,
      isActive: stageRemaining > 0,
      progress: (stageSold / supplyConfig.stageSupply[stage - 1] * 100).toFixed(1),
    };
  }
  
  /**
   * 获取所有等级的当前阶段信息
   */
  getAllStagesInfo() {
    const result: any[] = [];
    
    for (let level = 1; level <= 7; level++) {
      const currentStage = this.getCurrentStage(level);
      const stageInfo = this.getStageInfo(level, currentStage);
      result.push(stageInfo);
    }
    
    return result;
  }
  
  /**
   * 计算购买时的算力
   * @param level NFT 等级
   * @returns { stage, power, multiplier }
   */
  calculatePurchasePower(level: number) {
    const currentStage = this.getCurrentStage(level);
    const stageInfo = this.getStageInfo(level, currentStage);
    
    if (!stageInfo.isActive) {
      throw new Error(`Level ${level} Stage ${currentStage} is sold out`);
    }
    
    return {
      stage: currentStage,
      basePower: stageInfo.basePower,
      multiplier: stageInfo.stageMultiplier,
      finalPower: stageInfo.finalPower,
      price: stageInfo.price,
    };
  }
  
  /**
   * 检查是否可以购买
   */
  canPurchase(level: number): { canPurchase: boolean; reason?: string } {
    try {
      const currentStage = this.getCurrentStage(level);
      const stageInfo = this.getStageInfo(level, currentStage);
      
      if (!stageInfo.isActive) {
        return {
          canPurchase: false,
          reason: `${stageInfo.levelName} is sold out`,
        };
      }
      
      return { canPurchase: true };
    } catch (error) {
      return {
        canPurchase: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * 获取等级的完整阶段历史
   */
  getLevelStageHistory(level: number) {
    const stages = [];
    
    for (let stage = 1; stage <= 5; stage++) {
      const stageInfo = this.getStageInfo(level, stage);
      stages.push(stageInfo);
    }
    
    return stages;
  }
  
  /**
   * 获取全局统计
   */
  getGlobalStats() {
    // 查询总节点数
    const totalNodesResult = db.prepare(`
      SELECT COUNT(*) as total_nodes, SUM(power) as total_power
      FROM nodes
    `).get() as { total_nodes: number; total_power: number };
    
    // 计算总供应量
    let totalSupply = 0;
    for (const config of Object.values(LEVEL_SUPPLY_CONFIG)) {
      totalSupply += config.totalSupply;
    }
    
    return {
      totalSupply,
      totalSold: totalNodesResult?.total_nodes || 0,
      totalRemaining: totalSupply - (totalNodesResult?.total_nodes || 0),
      totalPower: totalNodesResult?.total_power || 0,
      progress: ((totalNodesResult?.total_nodes || 0) / totalSupply * 100).toFixed(2),
    };
  }
}

// 导出单例
export const nftStageManager = new NFTStageManager();

/**
 * 使用示例：
 * 
 * // 1. 获取当前阶段
 * const currentStage = nftStageManager.getCurrentStage(4); // Silver 的当前阶段
 * 
 * // 2. 获取阶段详细信息
 * const stageInfo = nftStageManager.getStageInfo(4, 1);
 * console.log(stageInfo);
 * // {
 * //   level: 4,
 * //   levelName: 'Silver',
 * //   stage: 1,
 * //   stageName: 'Stage 1 - Early Bird',
 * //   price: 100,
 * //   basePower: 1,
 * //   stageMultiplier: 1.0,
 * //   finalPower: 1.0,
 * //   stageSupply: 300,
 * //   stageSold: 50,
 * //   stageRemaining: 250,
 * //   totalSupply: 1500,
 * //   totalSold: 50,
 * //   isActive: true,
 * //   progress: '16.7'
 * // }
 * 
 * // 3. 用户购买时计算算力
 * const purchaseInfo = nftStageManager.calculatePurchasePower(4);
 * console.log(purchaseInfo);
 * // {
 * //   stage: 1,
 * //   basePower: 1,
 * //   multiplier: 1.0,
 * //   finalPower: 1.0,
 * //   price: 100
 * // }
 * 
 * // 4. 检查是否可以购买
 * const { canPurchase, reason } = nftStageManager.canPurchase(4);
 * 
 * // 5. 获取所有等级的当前状态
 * const allStages = nftStageManager.getAllStagesInfo();
 * 
 * // 6. 获取全局统计
 * const stats = nftStageManager.getGlobalStats();
 */
