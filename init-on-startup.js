/**
 * 启动时自动初始化脚本
 * 确保 data 目录存在，不阻止应用启动
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || './data/eagleswap.db';

console.log('🚀 启动前检查...');

try {
  // 确保 data 目录存在
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ 创建 data 目录');
  } else {
    console.log('✅ data 目录已存在');
  }

  // 如果存在预置的 Cookie 文件，复制到 data 目录
  const presetCookiePath = path.join(__dirname, 'data', 'x_state.json');
  if (fs.existsSync(presetCookiePath)) {
    console.log('✅ 发现预置的 Twitter Cookie 文件');
  } else {
    console.log('⚠️ 未发现预置的 Cookie 文件，将使用自动登录');
  }

  console.log('✅ 启动检查完成\n');
  process.exit(0);

} catch (error) {
  console.error('⚠️  启动检查警告:', error.message);
  // 不阻止应用启动
  process.exit(0);
}
