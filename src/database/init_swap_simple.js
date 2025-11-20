const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/eagle-swap.db');

console.log('🔄 初始化 SWAP 挖矿表...\n');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法打开数据库:', err.message);
    process.exit(1);
  }
});

// 设置超时
db.configure('busyTimeout', 5000);

const tables = [
  // 1. 交易记录表
  `CREATE TABLE IF NOT EXISTS swap_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_hash TEXT UNIQUE NOT NULL,
    user_address TEXT NOT NULL,
    from_token TEXT NOT NULL,
    to_token TEXT NOT NULL,
    from_amount REAL NOT NULL,
    to_amount REAL NOT NULL,
    trade_value_usdt REAL NOT NULL,
    fee_usdt REAL NOT NULL,
    eagle_reward REAL NOT NULL,
    route_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // 2. 用户统计表
  `CREATE TABLE IF NOT EXISTS user_swap_stats (
    user_address TEXT PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    total_volume_usdt REAL DEFAULT 0,
    total_fee_paid REAL DEFAULT 0,
    total_eagle_earned REAL DEFAULT 0,
    total_eagle_claimed REAL DEFAULT 0,
    first_trade_at DATETIME,
    last_trade_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // 3. 每日统计表
  `CREATE TABLE IF NOT EXISTS daily_swap_stats (
    stat_date TEXT PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    total_volume_usdt REAL DEFAULT 0,
    total_fee_collected REAL DEFAULT 0,
    total_eagle_distributed REAL DEFAULT 0,
    unique_traders INTEGER DEFAULT 0
  )`,
  
  // 4. 奖励记录表
  `CREATE TABLE IF NOT EXISTS swap_mining_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    tx_id INTEGER NOT NULL,
    reward_date TEXT NOT NULL,
    eagle_earned REAL NOT NULL,
    claimed BOOLEAN DEFAULT 0,
    claimed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // 5. 配置表
  `CREATE TABLE IF NOT EXISTS swap_mining_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    reward_rate REAL NOT NULL DEFAULT 0.0003,
    fee_rate REAL NOT NULL DEFAULT 0.001,
    eagle_price_usdt REAL NOT NULL DEFAULT 0.10,
    enabled BOOLEAN DEFAULT 1,
    nft_bonus_enabled BOOLEAN DEFAULT 1,
    nft_bonus_multiplier REAL DEFAULT 10.0,
    compliance_disclaimer TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // 6. NFT 加成记录表
  `CREATE TABLE IF NOT EXISTS swap_mining_nft_bonus_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    base_reward REAL NOT NULL,
    nft_weight REAL NOT NULL,
    bonus_percent REAL NOT NULL,
    bonus_amount REAL NOT NULL,
    final_reward REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
];

let completed = 0;

tables.forEach((sql, index) => {
  db.run(sql, (err) => {
    if (err) {
      console.error(`❌ 表 ${index + 1} 创建失败:`, err.message);
    } else {
      console.log(`✅ 表 ${index + 1}/${tables.length} 创建成功`);
    }
    
    completed++;
    if (completed === tables.length) {
      // 插入默认配置
      db.run(`
        INSERT OR REPLACE INTO swap_mining_config (
          id, reward_rate, fee_rate, eagle_price_usdt, enabled,
          nft_bonus_enabled, nft_bonus_multiplier, compliance_disclaimer
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        1,
        0.0003,
        0.001,
        0.10,
        1,
        1,
        10.0,
        '当前参数：基础奖励率 0.0003 EAGLE/USDT，NFT 加成 = 权重 × 10%。此参数可能根据网络条件调整。'
      ], (err) => {
        if (err) {
          console.error('❌ 配置插入失败:', err.message);
        } else {
          console.log('✅ 默认配置已设置\n');
          
          // 验证配置
          db.get('SELECT * FROM swap_mining_config WHERE id = 1', [], (err, row) => {
            if (err) {
              console.error('❌ 查询失败:', err.message);
            } else if (row) {
              console.log('📊 当前配置:');
              console.log(`   基础奖励率: ${row.reward_rate} EAGLE/USDT`);
              console.log(`   NFT 加成启用: ${row.nft_bonus_enabled ? '是' : '否'}`);
              console.log(`   加成倍数: 权重 × ${row.nft_bonus_multiplier}`);
              console.log(`   交易 100 USDT = ${100 * row.reward_rate} EAGLE\n`);
              console.log('✅ SWAP 挖矿系统初始化完成！');
            }
            db.close();
          });
        }
      });
    }
  });
});
