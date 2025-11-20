/**
 * 分配计算器 - 解决早期NFT销售不公平问题
 * 
 * 支持三种模式：
 * 1. fixed_per_weight - 固定每权重分配（推荐用于早期）
 * 2. proportional_with_cap - 比例分配+上限
 * 3. hybrid - 混合模式（根据总权重自动切换）
 */

class AllocationCalculator {
  constructor(config) {
    this.method = config.method || 'fixed_per_weight';
    this.fixedPerWeight = parseFloat(config.fixed_per_weight || 0.1);
    this.dailyPool = parseFloat(config.daily_pool || 10000);
    this.maxPerWeight = parseFloat(config.max_per_weight || 0.5);
    this.minThreshold = parseFloat(config.min_threshold || 1000);
    this.levelCaps = config.level_caps || {};
  }

  /**
   * 计算单个用户的每日分配
   * @param {number} userWeight - 用户总权重
   * @param {number} totalWeight - 网络总权重
   * @param {number} userLevel - 用户节点等级
   * @returns {number} 每日分配数量
   */
  calculateDailyAllocation(userWeight, totalWeight, userLevel) {
    let allocation = 0;

    switch (this.method) {
      case 'fixed_per_weight':
        allocation = this.calculateFixed(userWeight);
        break;
      
      case 'proportional_with_cap':
        allocation = this.calculateProportionalWithCap(userWeight, totalWeight);
        break;
      
      case 'hybrid':
        allocation = this.calculateHybrid(userWeight, totalWeight);
        break;
      
      default:
        allocation = this.calculateFixed(userWeight);
    }

    // 应用等级上限
    if (this.levelCaps[userLevel]) {
      allocation = Math.min(allocation, this.levelCaps[userLevel]);
    }

    return allocation;
  }

  /**
   * 方案1：固定每权重分配
   * 优点：公平，不受早期参与者少的影响
   */
  calculateFixed(userWeight) {
    return userWeight * this.fixedPerWeight;
  }

  /**
   * 方案2：比例分配+上限
   * 优点：有总池控制，但设置上限避免早期过多
   */
  calculateProportionalWithCap(userWeight, totalWeight) {
    if (totalWeight === 0) return 0;
    
    // 比例分配
    const proportional = (userWeight / totalWeight) * this.dailyPool;
    
    // 应用每权重上限
    const capped = userWeight * this.maxPerWeight;
    
    return Math.min(proportional, capped);
  }

  /**
   * 方案3：混合模式
   * 早期用固定，后期用比例+上限
   */
  calculateHybrid(userWeight, totalWeight) {
    if (totalWeight < this.minThreshold) {
      // 早期：使用固定分配
      return this.calculateFixed(userWeight);
    } else {
      // 后期：使用比例+上限
      return this.calculateProportionalWithCap(userWeight, totalWeight);
    }
  }

  /**
   * 计算所有用户的分配
   * @param {Array} users - 用户数组 [{weight, level}, ...]
   * @returns {Object} 分配结果和统计
   */
  calculateBatchAllocations(users) {
    const totalWeight = users.reduce((sum, user) => sum + user.weight, 0);
    const allocations = [];
    let totalAllocated = 0;

    users.forEach(user => {
      const allocation = this.calculateDailyAllocation(
        user.weight,
        totalWeight,
        user.level
      );
      
      allocations.push({
        ...user,
        allocation,
        perWeight: user.weight > 0 ? allocation / user.weight : 0
      });
      
      totalAllocated += allocation;
    });

    return {
      allocations,
      stats: {
        totalWeight,
        totalAllocated,
        avgPerWeight: totalWeight > 0 ? totalAllocated / totalWeight : 0,
        method: this.method,
        usersCount: users.length
      }
    };
  }

  /**
   * 获取配置信息（用于前端显示）
   */
  getConfigInfo() {
    return {
      method: this.method,
      methodName: this.getMethodName(),
      parameters: this.getMethodParameters(),
      disclaimer: '当前参数可能根据网络条件调整，不保证未来维持相同参数'
    };
  }

  getMethodName() {
    const names = {
      'fixed_per_weight': '固定每权重分配',
      'proportional_with_cap': '比例分配（带上限）',
      'hybrid': '混合模式（自动切换）'
    };
    return names[this.method] || this.method;
  }

  getMethodParameters() {
    switch (this.method) {
      case 'fixed_per_weight':
        return {
          fixedPerWeight: this.fixedPerWeight,
          description: `每权重每日分配 ${this.fixedPerWeight} EAGLE`
        };
      
      case 'proportional_with_cap':
        return {
          dailyPool: this.dailyPool,
          maxPerWeight: this.maxPerWeight,
          description: `每日池 ${this.dailyPool} EAGLE，每权重上限 ${this.maxPerWeight} EAGLE`
        };
      
      case 'hybrid':
        return {
          minThreshold: this.minThreshold,
          fixedPerWeight: this.fixedPerWeight,
          maxPerWeight: this.maxPerWeight,
          description: `总权重 < ${this.minThreshold} 时使用固定分配，否则使用比例+上限`
        };
      
      default:
        return {};
    }
  }
}

module.exports = AllocationCalculator;

// 使用示例
if (require.main === module) {
  // 示例配置
  const config = {
    method: 'fixed_per_weight',  // 推荐早期使用
    fixed_per_weight: 0.1,
    daily_pool: 10000,
    max_per_weight: 0.5,
    min_threshold: 1000,
    level_caps: {
      1: 0.05,   // Micro
      2: 0.15,   // Mini
      3: 0.25,   // Bronze
      4: 0.5,    // Silver
      5: 1.5,    // Gold
      6: 3.5,    // Platinum
      7: 7.5     // Diamond
    }
  };

  const calculator = new AllocationCalculator(config);

  // 模拟早期场景：只有3个用户
  console.log('\n=== 场景1：早期（3个用户）===\n');
  const earlyUsers = [
    { id: 1, weight: 15, level: 7 },  // Diamond
    { id: 2, weight: 3, level: 5 },   // Gold
    { id: 3, weight: 0.5, level: 3 }  // Bronze
  ];

  const earlyResult = calculator.calculateBatchAllocations(earlyUsers);
  console.log('用户分配:');
  earlyResult.allocations.forEach(a => {
    console.log(`  用户${a.id}: 权重${a.weight} → ${a.allocation.toFixed(4)} EAGLE/天 (每权重: ${a.perWeight.toFixed(4)})`);
  });
  console.log(`\n总计: ${earlyResult.stats.totalAllocated.toFixed(4)} EAGLE/天`);
  console.log(`平均每权重: ${earlyResult.stats.avgPerWeight.toFixed(4)} EAGLE\n`);

  // 模拟后期场景：100个用户
  console.log('=== 场景2：后期（100个用户）===\n');
  const lateUsers = [];
  for (let i = 0; i < 100; i++) {
    lateUsers.push({
      id: i + 1,
      weight: Math.random() * 10 + 0.5,
      level: Math.floor(Math.random() * 7) + 1
    });
  }

  const lateResult = calculator.calculateBatchAllocations(lateUsers);
  console.log(`总权重: ${lateResult.stats.totalWeight.toFixed(2)}`);
  console.log(`总分配: ${lateResult.stats.totalAllocated.toFixed(2)} EAGLE/天`);
  console.log(`平均每权重: ${lateResult.stats.avgPerWeight.toFixed(4)} EAGLE`);
  console.log(`\n前5个用户:`);
  lateResult.allocations.slice(0, 5).forEach(a => {
    console.log(`  用户${a.id}: 权重${a.weight.toFixed(2)} → ${a.allocation.toFixed(4)} EAGLE/天`);
  });

  console.log('\n配置信息:');
  console.log(calculator.getConfigInfo());
}
