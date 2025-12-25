#!/usr/bin/env node
/**
 * 连接到服务器上已运行的 Chrome 浏览器
 * 使用场景：在服务器桌面手动登录 Twitter 后，让后端连接这个浏览器会话
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COOKIE_PATH = path.join(__dirname, '../data/x_state.json');

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║     连接到服务器浏览器并提取 Twitter Cookie                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('📋 使用说明：');
console.log('1. 在服务器桌面打开 Chrome 浏览器');
console.log('2. 使用以下命令启动 Chrome（启用远程调试）：');
console.log('');
console.log('   Windows:');
console.log('   "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\\chrome-debug"');
console.log('');
console.log('   Linux:');
console.log('   google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug');
console.log('');
console.log('3. 在浏览器中访问 https://x.com 并登录');
console.log('4. 运行此脚本提取 Cookie\n');

async function connectAndExtractCookies() {
  try {
    console.log('🔌 尝试连接到 Chrome (端口 9222)...\n');
    
    // 连接到已运行的 Chrome
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✅ 已连接到 Chrome\n');
    
    // 获取所有上下文
    const contexts = browser.contexts();
    console.log(`📂 找到 ${contexts.length} 个浏览器上下文\n`);
    
    let cookiesSaved = false;
    
    for (const context of contexts) {
      const pages = context.pages();
      console.log(`   上下文包含 ${pages.length} 个页面`);
      
      for (const page of pages) {
        const url = page.url();
        console.log(`   📄 页面: ${url}`);
        
        // 检查是否是 Twitter/X 页面
        if (url.includes('x.com') || url.includes('twitter.com')) {
          console.log('\n🎯 找到 Twitter 页面！');
          console.log('💾 正在提取 Cookie...\n');
          
          // 获取所有 Cookie
          const cookies = await context.cookies();
          
          // 过滤出 Twitter 相关的 Cookie
          const twitterCookies = cookies.filter(c => 
            c.domain.includes('x.com') || c.domain.includes('twitter.com')
          );
          
          console.log(`📦 提取到 ${twitterCookies.length} 个 Twitter Cookie`);
          
          // 修复 Cookie 格式
          const fixedCookies = twitterCookies.map(cookie => {
            const fixed = {
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain,
              path: cookie.path,
              secure: cookie.secure !== false,
              httpOnly: cookie.httpOnly === true
            };
            
            if (cookie.expires !== undefined && cookie.expires !== -1) {
              fixed.expires = Math.floor(cookie.expires);
            }
            
            // 修复 sameSite
            let sameSite = cookie.sameSite || 'None';
            if (sameSite.toLowerCase() === 'strict') {
              fixed.sameSite = 'Strict';
            } else if (sameSite.toLowerCase() === 'lax') {
              fixed.sameSite = 'Lax';
            } else {
              fixed.sameSite = 'None';
              fixed.secure = true;
            }
            
            return fixed;
          });
          
          // 保存 Cookie
          fs.writeFileSync(COOKIE_PATH, JSON.stringify(fixedCookies, null, 2));
          console.log(`✅ Cookie 已保存到: ${COOKIE_PATH}\n`);
          
          cookiesSaved = true;
          break;
        }
      }
      
      if (cookiesSaved) break;
    }
    
    if (!cookiesSaved) {
      console.log('⚠️  未找到 Twitter 页面');
      console.log('💡 请在浏览器中打开 https://x.com 并登录\n');
    }
    
    await browser.close();
    
    if (cookiesSaved) {
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║  ✅ 完成！                                                    ║');
      console.log('║                                                              ║');
      console.log('║  下一步：                                                     ║');
      console.log('║  1. 将 Cookie 复制到 preset 目录：                            ║');
      console.log('║     copy data\\x_state.json preset\\x_state.json              ║');
      console.log('║                                                              ║');
      console.log('║  2. 提交并推送：                                              ║');
      console.log('║     git add preset/x_state.json                              ║');
      console.log('║     git commit -m "Update Twitter cookies"                   ║');
      console.log('║     git push origin main                                     ║');
      console.log('║                                                              ║');
      console.log('║  3. 在 Coolify 中删除环境变量：                               ║');
      console.log('║     DISABLE_TWITTER_LOGIN=true                               ║');
      console.log('║                                                              ║');
      console.log('║  4. 重启后端                                                  ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
    }
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.log('\n💡 请确保：');
    console.log('1. Chrome 已使用 --remote-debugging-port=9222 启动');
    console.log('2. 端口 9222 未被占用');
    console.log('3. 防火墙允许本地连接到端口 9222\n');
    process.exit(1);
  }
}

connectAndExtractCookies();
