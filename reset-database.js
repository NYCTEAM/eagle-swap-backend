/**
 * 数据库重置脚本
 * 用于清理旧的表结构并重新初始化
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = './data/eagle-swap.db';
const BACKUP_PATH = './data/backups';

// 确保备份目录存在
if (!fs.existsSync(BACKUP_PATH)) {
  fs.mkdirSync(BACKUP_PATH, { recursive: true });
}

// 备份当前数据库
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(BACKUP_PATH, `eagle-swap-backup-${timestamp}.db`);

if (fs.existsSync(DB_PATH)) {
  console.log('📦 备份当前数据库...');
  fs.copyFileSync(DB_PATH, backupFile);
  console.log(`✅ 数据库已备份到: ${backupFile}`);
} else {
  console.log('ℹ️  数据库文件不存在，将创建新数据库');
}

// 连接数据库
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 无法连接数据库:', err);
    process.exit(1);
  }
  console.log('✅ 已连接到数据库');
});

// 删除 Swap 历史相关的表
const dropTables = [
  'DROP TABLE IF EXISTS twap_executions',
  'DROP TABLE IF EXISTS twap_orders',
  'DROP TABLE IF EXISTS limit_orders',
  'DROP TABLE IF EXISTS swap_transactions',
  'DROP TABLE IF EXISTS user_swap_stats',
  'DROP TABLE IF EXISTS token_pair_stats',
];

// 删除图表相关的表（如果存在）
const dropChartTables = [
  'DROP TABLE IF EXISTS price_snapshots',
  'DROP TABLE IF EXISTS candles',
  'DROP TABLE IF EXISTS token_pairs',
];

console.log('\n🗑️  删除旧的 Swap 历史表...');

db.serialize(() => {
  // 删除 Swap 历史表
  dropTables.forEach((sql) => {
    db.run(sql, (err) => {
      if (err) {
        console.error(`❌ 执行失败: ${sql}`, err.message);
      } else {
        console.log(`✅ ${sql}`);
      }
    });
  });

  // 删除图表表
  console.log('\n🗑️  删除旧的图表数据表...');
  dropChartTables.forEach((sql) => {
    db.run(sql, (err) => {
      if (err) {
        console.error(`❌ 执行失败: ${sql}`, err.message);
      } else {
        console.log(`✅ ${sql}`);
      }
    });
  });

  // 清理完成
  db.run('VACUUM', (err) => {
    if (err) {
      console.error('❌ VACUUM 失败:', err.message);
    } else {
      console.log('\n✅ 数据库已优化 (VACUUM)');
    }

    db.close((err) => {
      if (err) {
        console.error('❌ 关闭数据库失败:', err);
      } else {
        console.log('✅ 数据库连接已关闭');
        console.log('\n🎉 数据库重置完成！');
        console.log('\n📝 下一步：');
        console.log('   1. 重启后端服务器: npm run dev');
        console.log('   2. 数据库表将自动重新创建');
        console.log('   3. 如果需要恢复数据，请使用备份文件');
        console.log(`\n💾 备份位置: ${backupFile}`);
      }
    });
  });
});
