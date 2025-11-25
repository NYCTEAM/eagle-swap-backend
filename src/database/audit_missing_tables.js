const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = process.argv[2] || "/app/data/eagleswap.db";
const db = new Database(dbPath);

console.log("🔍 数据库表审计\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// 获取当前所有表
const currentTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
const tableNames = new Set(currentTables.map(t => t.name));

console.log("✅ 当前数据库表 (" + currentTables.length + "个):\n");
currentTables.forEach((t, i) => {
  console.log("   " + (i+1) + ". " + t.name);
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// 路由文件中常用的表
const routeTables = {
  "dashboard.ts": [
    "nodes", "node_levels", "node_mining_rewards",
    "swap_transactions", "swap_rewards", "user_swap_stats",
    "communities", "community_members", "community_level_config"
  ],
  "nodes.ts": [
    "nodes", "node_levels", "node_level_stages", "nft_level_bonus",
    "node_mining_rewards"
  ],
  "swapMining.ts": [
    "swap_transactions", "swap_mining_config", "swap_mining_rewards",
    "user_swap_stats", "daily_swap_stats", "vip_levels",
    "nft_level_bonus", "nodes"
  ],
  "community.ts": [
    "communities", "community_members", "community_level_config"
  ],
  "community-creation.ts": [
    "community_creation_requests", "community_creation_votes",
    "nft_tier_privileges", "nodes"
  ],
  "otc.ts": [
    "otc_orders", "otc_fills", "otc_stats", "otc_user_stats"
  ],
  "nftMarketplace.ts": [
    "nft_listings", "nft_sales", "nft_price_history",
    "user_marketplace_activity", "marketplace_stats", "nodes"
  ],
  "swapHistory.ts": [
    "swap_transactions", "twap_orders", "twap_executions",
    "limit_orders", "token_pair_stats"
  ],
  "xlayerChart.ts": [
    "price_snapshots", "candles", "token_pairs"
  ],
  "users.ts": [
    "users"
  ],
  "mining.ts": [
    "node_mining_rewards", "nodes", "node_levels"
  ]
};

// 检查缺失的表
const missingTables = new Set();
const existingRoutes = {};

console.log("📋 路由表需求分析:\n");

for (const [route, tables] of Object.entries(routeTables)) {
  const missing = tables.filter(t => !tableNames.has(t));
  const existing = tables.filter(t => tableNames.has(t));
  
  existingRoutes[route] = {
    total: tables.length,
    existing: existing.length,
    missing: missing.length,
    missingTables: missing
  };
  
  missing.forEach(t => missingTables.add(t));
  
  const status = missing.length === 0 ? "✅" : "⚠️";
  console.log(status + " " + route + ": " + existing.length + "/" + tables.length + " 表存在");
  
  if (missing.length > 0) {
    console.log("   缺失: " + missing.join(", "));
  }
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

if (missingTables.size > 0) {
  console.log("❌ 缺失的表 (" + missingTables.size + "个):\n");
  Array.from(missingTables).sort().forEach((t, i) => {
    console.log("   " + (i+1) + ". " + t);
  });
  
  console.log("\n💡 建议:");
  console.log("   1. 检查这些表是否在其他 SQL 文件中定义");
  console.log("   2. 运行相应的初始化脚本");
  console.log("   3. 或者更新路由代码以使用现有表\n");
} else {
  console.log("✅ 所有路由需要的表都已存在!\n");
}

// 统计
const totalRequired = Object.values(routeTables).flat().length;
const uniqueRequired = new Set(Object.values(routeTables).flat()).size;
const coverage = ((uniqueRequired - missingTables.size) / uniqueRequired * 100).toFixed(1);

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log("📊 统计:");
console.log("   总表数: " + currentTables.length);
console.log("   路由需要的唯一表: " + uniqueRequired);
console.log("   缺失表: " + missingTables.size);
console.log("   覆盖率: " + coverage + "%\n");

db.close();
console.log("✨ 审计完成!\n");
