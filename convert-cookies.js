/**
 * 将浏览器扩展导出的 Cookie 转换为 Playwright 格式
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, 'preset', 'x_state.json');
const outputPath = path.join(__dirname, 'preset', 'x_state_converted.json');

try {
  const rawCookies = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  
  const playwrightCookies = rawCookies.map(cookie => {
    const converted = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly
    };
    
    // 转换过期时间
    if (cookie.expirationDate && !cookie.session) {
      converted.expires = Math.floor(cookie.expirationDate);
    }
    
    // 转换 sameSite
    if (cookie.sameSite) {
      const sameSiteMap = {
        'unspecified': 'None',
        'no_restriction': 'None',
        'lax': 'Lax',
        'strict': 'Strict'
      };
      converted.sameSite = sameSiteMap[cookie.sameSite.toLowerCase()] || 'Lax';
    }
    
    return converted;
  });
  
  fs.writeFileSync(outputPath, JSON.stringify(playwrightCookies, null, 2));
  console.log(`✅ 已转换 ${playwrightCookies.length} 个 Cookie`);
  console.log(`📁 输出文件: ${outputPath}`);
  
  // 替换原文件
  fs.copyFileSync(outputPath, inputPath);
  console.log('✅ 已更新原文件');
  
} catch (error) {
  console.error('❌ 转换失败:', error.message);
  process.exit(1);
}
