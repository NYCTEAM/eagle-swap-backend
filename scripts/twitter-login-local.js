#!/usr/bin/env node
/**
 * Twitter 本地登录工具（带图形界面）
 * 在本地电脑运行，打开浏览器让您手动登录，然后上传 Cookie 到服务器
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function manualLogin() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Twitter 手动登录工具 - Eagle Swap (本地版)              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('📌 说明：');
  console.log('   1. 工具会打开一个浏览器窗口');
  console.log('   2. 请在浏览器中手动登录 Twitter');
  console.log('   3. 登录成功后，回到终端按回车');
  console.log('   4. Cookie 会自动保存并上传到服务器\n');

  await question('按回车键开始...');

  console.log('\n🚀 启动浏览器...');
  
  const browser = await chromium.launch({
    headless: false,  // 显示浏览器窗口
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  
  try {
    console.log('📱 打开 Twitter 登录页面...');
    await page.goto('https://x.com/i/flow/login');
    
    console.log('\n✋ 请在浏览器窗口中手动登录 Twitter');
    console.log('   登录成功后，回到这里按回车键继续...\n');
    
    await question('登录完成后按回车键 > ');

    // 检查是否登录成功
    const currentUrl = page.url();
    if (!currentUrl.includes('x.com/home') && !currentUrl.includes('twitter.com/home')) {
      console.log('\n⚠️ 警告：当前页面不是 Twitter 主页');
      console.log(`   当前 URL: ${currentUrl}`);
      const confirm = await question('   是否继续保存 Cookie？(y/n) > ');
      if (confirm.toLowerCase() !== 'y') {
        console.log('❌ 已取消');
        await browser.close();
        rl.close();
        return;
      }
    }

    console.log('\n💾 正在保存 Cookie...');
    const cookies = await context.cookies();
    
    // 保存到本地文件
    const localPath = path.join(__dirname, '../data/x_state.json');
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify(cookies, null, 2));
    console.log(`✅ 已保存到本地: ${localPath}`);

    // 询问是否上传到服务器
    const upload = await question('\n是否上传 Cookie 到服务器？(y/n) > ');
    
    if (upload.toLowerCase() === 'y') {
      const serverUrl = await question('服务器地址 (默认: https://api.eagleswap.llc): ');
      const apiUrl = (serverUrl.trim() || 'https://api.eagleswap.llc') + '/api/admin/update-twitter-cookies';
      
      console.log(`\n📤 上传到: ${apiUrl}`);
      
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cookies)
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log(`✅ 上传成功！保存了 ${result.cookieCount} 个 Cookie`);
          console.log('\n🔄 请在 Coolify 中重启后端以应用新的 Cookie');
        } else {
          console.log(`❌ 上传失败: ${result.error || '未知错误'}`);
        }
      } catch (error) {
        console.error(`❌ 上传失败: ${error.message}`);
        console.log('\n💡 提示：您可以手动将 Cookie 文件上传到服务器');
        console.log(`   文件位置: ${localPath}`);
      }
    }

    await browser.close();
    
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ 完成！                                                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    await browser.close();
  }
  
  rl.close();
}

manualLogin();
