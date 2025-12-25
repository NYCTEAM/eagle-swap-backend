#!/usr/bin/env node
/**
 * Twitter 交互式登录 CLI 工具
 * 通过命令行输入账号密码，自动登录并保存 Cookie
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_PATH = path.join(__dirname, '../data/x_state.json');

// 创建命令行输入接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 封装 question 为 Promise
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// 隐藏密码输入
function questionPassword(query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    
    let password = '';
    process.stdout.write(query);
    
    stdin.on('data', function onData(char) {
      char = char.toString('utf8');
      
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.exit();
          break;
        case '\u007f': // Backspace
          password = password.slice(0, -1);
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(query + '*'.repeat(password.length));
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

// 人类化输入
async function humanType(page, selector, text) {
  await page.waitForSelector(selector, { timeout: 10000 });
  for (const char of text) {
    await page.type(selector, char);
    await page.waitForTimeout(Math.random() * 100 + 50);
  }
}

// 主登录流程
async function login(username, password, email) {
  console.log('\n🚀 启动浏览器...');
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  // 反检测脚本
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  const page = await context.newPage();
  
  try {
    console.log('📱 打开 Twitter 登录页面...');
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 处理 Cookie 同意弹窗
    try {
      const cookieButton = page.locator('div[role="button"]:has-text("Accept all cookies")');
      if (await cookieButton.isVisible({ timeout: 3000 })) {
        await cookieButton.click();
        console.log('✅ 已接受 Cookie');
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      // 没有 Cookie 弹窗，继续
    }

    // 步骤 1: 输入账号标识符（优先使用邮箱）
    console.log('📝 输入账号标识符...');
    const accountIdentifier = email || username;
    await humanType(page, 'input[autocomplete="username"]', accountIdentifier);
    await page.waitForTimeout(1000);

    // 点击 Next
    console.log('👉 点击 Next...');
    await page.click('div[role="button"]:has-text("Next")');
    await page.waitForTimeout(3000);

    // 检查是否需要额外验证（用户名/邮箱/手机）
    const currentUrl = page.url();
    if (currentUrl.includes('LoginEnterAlternateIdentifierSubtask')) {
      console.log('🔐 检测到额外验证步骤...');
      
      // 尝试输入用户名
      try {
        await humanType(page, 'input[data-testid="ocfEnterTextTextInput"]', username);
        await page.waitForTimeout(1000);
        await page.click('div[role="button"]:has-text("Next")');
        await page.waitForTimeout(3000);
        console.log('✅ 已输入用户名验证');
      } catch (e) {
        console.log('⚠️ 无需额外验证');
      }
    }

    // 步骤 2: 输入密码
    console.log('🔑 输入密码...');
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await humanType(page, 'input[name="password"]', password);
    await page.waitForTimeout(1000);

    // 点击登录
    console.log('✅ 点击登录...');
    await page.click('div[role="button"][data-testid="LoginForm_Login_Button"]');
    await page.waitForTimeout(5000);

    // 等待登录完成
    console.log('⏳ 等待登录完成...');
    await page.waitForURL('https://x.com/home', { timeout: 30000 });
    
    console.log('✅ 登录成功！');

    // 保存 Cookie
    console.log('💾 保存 Cookie...');
    const cookies = await context.cookies();
    fs.writeFileSync(STATE_PATH, JSON.stringify(cookies, null, 2));
    console.log(`✅ 已保存 ${cookies.length} 个 Cookie 到: ${STATE_PATH}`);

    await browser.close();
    return true;

  } catch (error) {
    console.error('❌ 登录失败:', error.message);
    
    // 保存错误截图
    try {
      const screenshotPath = path.join(__dirname, '../data/login_error.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 错误截图已保存: ${screenshotPath}`);
    } catch (e) {
      // 忽略截图错误
    }
    
    await browser.close();
    return false;
  }
}

// 主程序
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          Twitter 交互式登录工具 - Eagle Swap                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // 获取用户输入
    const username = await question('Twitter 用户名 (@username): ');
    const email = await question('Twitter 邮箱 (可选，按回车跳过): ');
    const password = await questionPassword('Twitter 密码: ');

    if (!username || !password) {
      console.log('❌ 用户名和密码不能为空！');
      rl.close();
      process.exit(1);
    }

    console.log('\n开始登录流程...\n');

    // 执行登录
    const success = await login(username.trim(), password.trim(), email.trim());

    if (success) {
      console.log('\n╔══════════════════════════════════════════════════════════════╗');
      console.log('║  ✅ 登录成功！Cookie 已保存                                  ║');
      console.log('║  🔄 请重启后端服务以应用新的 Cookie                          ║');
      console.log('╚══════════════════════════════════════════════════════════════╝\n');
      rl.close();
      process.exit(0);
    } else {
      console.log('\n❌ 登录失败，请检查账号密码是否正确\n');
      rl.close();
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();
