const Database = require("better-sqlite3");
const db = new Database("/app/data/eagleswap.db");

console.log("🔍 完整数据库表对比分析\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// 当前数据库中的表
const currentTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(t => t.name);

// 所有 SQL 文件中定义的表
const allDefinedTables = [
  "allocation_config",
  "allocation_history",
  "candles",
  "communities",
  "community_creation_requests",
  "community_creation_votes",
  "community_level_config",
  "community_members",
  "compliance_audit_log",
  "daily_swap_stats",
  "level_allocation_caps",
  "limit_orders",
  "liquidity_mining",
  "liquidity_rewards",
  "marketplace_stats",
  "nft_level_bonus",
  "nft_listings",
  "nft_price_history",
  "nft_sales",
  "nft_tier_privileges",
  "node_level_stages",
  "node_levels",
  "node_mining_rewards",
  "nodes",
  "otc_fills",
  "otc_orders",
  "otc_stats",
  "otc_user_stats",
  "participation_statistics",
  "price_snapshots",
  "supported_chains",
  "swap_mining_config",
  "swap_mining_nft_bonus_log",
  "swap_mining_rewards",
  "swap_rewards",
  "swap_transactions",
  "system_config",
  "token_pair_stats",
  "token_pairs",
  "twap_executions",
  "twap_orders",
  "user_marketplace_activity",
  "user_swap_stats",
  "user_tiers",
  "users",
  "vip_levels",
  "yearly_reward_multipliers",
  "yearly_rewards"
];

// 找出缺失的表
const missingTables = allDefinedTables.filter(t => !currentTables.includes(t));
const extraTables = currentTables.filter(t => !allDefinedTables.includes(t) && t !== "sqlite_sequence");

console.log("📊 统计:");
console.log("   当前数据库表数: " + currentTables.length);
console.log("   定义的表总数: " + allDefinedTables.length);
console.log("   缺失表数: " + missingTables.length);
console.log("   额外表数: " + extraTables.length);

if (missingTables.length > 0) {
  console.log("\n❌ 缺失的表 (" + missingTables.length + "个):");
  missingTables.forEach((t, i) => {
    console.log("   " + (i+1) + ". " + t);
  });
}

if (extraTables.length > 0) {
  console.log("\n➕ 额外的表 (未在主要 SQL 文件中定义):");
  extraTables.forEach((t, i) => {
    console.log("   " + (i+1) + ". " + t);
  });
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// 按功能分类缺失的表
if (missingTables.length > 0) {
  console.log("\n📋 缺失表分类:\n");
  
  const categories = {
    "配置相关": ["allocation_config", "allocation_history", "level_allocation_caps"],
    "流动性挖矿": ["liquidity_mining", "liquidity_rewards"],
    "多链支持": ["supported_chains"],
    "合规审计": ["compliance_audit_log"],
    "统计数据": ["participation_statistics"],
    "用户层级": ["user_tiers"]
  };
  
  for (const [category, tables] of Object.entries(categories)) {
    const missing = tables.filter(t => missingTables.includes(t));
    if (missing.length > 0) {
      console.log("   " + category + ":");
      missing.forEach(t => console.log("      - " + t));
    }
  }
}

db.close();
console.log("\n✨ 分析完成!\n");
