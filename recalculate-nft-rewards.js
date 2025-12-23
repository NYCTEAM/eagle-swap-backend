#!/usr/bin/env node

/**
 * 重新计算NFT挖矿奖励
 * 基于权重比例：0.1, 0.3, 0.5, 1, 3, 7, 15
 */

const Database = require("better-sqlite3");
const path = require("path");

// NFT等级权重
const WEIGHTS = {
  1: 0.1,  // Micro Node
  2: 0.3,  // Mini Node
  3: 0.5,  // Bronze Node
  4: 1.0,  // Silver Node
  5: 3.0,  // Gold Node
  6: 7.0,  // Platinum Node
  7: 15.0  // Diamond Node
};

// 阶段衰减系数
const STAGE_MULTIPLIERS = {
  1: 1.00,  // 100%
  2: 0.95,  // 95%
  3: 0.90,  // 90%
  4: 0.85,  // 85%
  5: 0.80   // 80%
};

// 年度衰减系数
const YEAR_MULTIPLIERS = {
  1: 1.00,   // Year 1: 100%
  2: 0.90,   // Year 2: 90%
  3: 0.81,   // Year 3: 81%
  4: 0.73,   // Year 4: 73%
  5: 0.66,   // Year 5: 66%
  6: 0.59,   // Year 6: 59%
  7: 0.53,   // Year 7: 53%
  8: 0.48,   // Year 8: 48%
  9: 0.43,   // Year 9: 43%
  10: 0.39   // Year 10: 39%
};

/**
 * 计算每日奖励
 * 
 * 公式：
 * 每日奖励 = 基础奖励 × 权重 × 阶段系数 × 年度系数
 * 
 * 基础奖励设定为 0.27 EAGLE/天（Level 1, Stage 1, Year 1的基准）
 */
function calculateDailyReward(level, stage, year) {
  const BASE_REWARD = 0.27; // Level 1 的基础奖励
  const weight = WEIGHTS[level];
  const stageMult = STAGE_MULTIPLIERS[stage];
  const yearMult = YEAR_MULTIPLIERS[year];
  
  // 每日奖励 = 基础奖励 × (权重 / 0.1) × 阶段系数 × 年度系数
  // 除以0.1是为了让Level 1 (权重0.1)的奖励等于基础奖励
  const dailyReward = BASE_REWARD * (weight / 0.1) * stageMult * yearMult;
  
  return parseFloat(dailyReward.toFixed(4));
}

function main() {
  console.log("🔄 重新计算NFT挖矿奖励...\n");
  
  const dbPath = path.join(process.cwd(), "data", "eagleswap.db");
  const db = new Database(dbPath);
  
  try {
    // 清空现有数据
    db.prepare("DELETE FROM yearly_rewards").run();
    console.log("✅ 已清空旧数据\n");
    
    // 生成新数据
    console.log("📊 新的奖励表:\n");
    console.log("Level | Stage | Year | Daily Reward | Monthly (~30天)");
    console.log("------|-------|------|--------------|----------------");
    
    let insertCount = 0;
    
    for (let year = 1; year <= 10; year++) {
      const yearMult = YEAR_MULTIPLIERS[year];
      
      for (let level = 1; level <= 7; level++) {
        for (let stage = 1; stage <= 5; stage++) {
          const dailyReward = calculateDailyReward(level, stage, year);
          const monthlyReward = dailyReward * 30;
          const stageMult = STAGE_MULTIPLIERS[stage];
          
          // 插入数据库
          db.prepare(`
            INSERT INTO yearly_rewards (year, level_id, stage, daily_reward, year_multiplier, stage_multiplier)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(year, level, stage, dailyReward, yearMult, stageMult);
          
          insertCount++;
          
          // 只打印Year 1的数据作为示例
          if (year === 1) {
            console.log(
              `  ${level}   |   ${stage}   |  ${year}   | ${dailyReward.toFixed(4).padStart(12)} | ~${monthlyReward.toFixed(2).padStart(14)} EAGLE`
            );
          }
        }
      }
    }
    
    console.log("\n✅ 成功插入", insertCount, "条记录");
    
    // 显示各等级对比（Year 1, Stage 1）
    console.log("\n📊 各等级对比 (Year 1, Stage 1):\n");
    console.log("Level | Name          | Weight | Daily    | Monthly");
    console.log("------|---------------|--------|----------|----------");
    
    const levelNames = {
      1: "Micro Node",
      2: "Mini Node",
      3: "Bronze Node",
      4: "Silver Node",
      5: "Gold Node",
      6: "Platinum Node",
      7: "Diamond Node"
    };
    
    for (let level = 1; level <= 7; level++) {
      const daily = calculateDailyReward(level, 1, 1);
      const monthly = daily * 30;
      const weight = WEIGHTS[level];
      
      console.log(
        `  ${level}   | ${levelNames[level].padEnd(13)} | ${weight.toFixed(1).padStart(6)} | ${daily.toFixed(4).padStart(8)} | ~${monthly.toFixed(2).padStart(7)} EAGLE`
      );
    }
    
    console.log("\n📊 阶段衰减示例 (Level 3 - Bronze Node, Year 1):\n");
    console.log("Stage | Coefficient | Daily Reward");
    console.log("------|-------------|-------------");
    
    for (let stage = 1; stage <= 5; stage++) {
      const daily = calculateDailyReward(3, stage, 1);
      const coeff = STAGE_MULTIPLIERS[stage];
      
      console.log(
        `  ${stage}   | ${(coeff * 100).toFixed(0).padStart(11)}% | ${daily.toFixed(4).padStart(12)} EAGLE`
      );
    }
    
  } finally {
    db.close();
  }
  
  console.log("\n✅ 奖励重新计算完成！");
}

main();
