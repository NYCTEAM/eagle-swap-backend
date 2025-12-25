/**
 * Twitter 手动登录助手
 * 提供一个网页界面，让用户手动登录 Twitter，然后自动保存 Cookie
 */

import { Router, Request, Response } from 'express';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const router = Router();

// 存储浏览器实例
let loginBrowser: any = null;
let loginPage: any = null;

/**
 * 启动浏览器并打开 Twitter 登录页
 */
router.get('/start-manual-login', async (req: Request, res: Response) => {
  try {
    if (loginBrowser) {
      return res.json({ 
        success: false, 
        error: 'Login session already active. Please complete or cancel it first.' 
      });
    }

    console.log('🚀 Starting manual Twitter login session...');
    
    loginBrowser = await chromium.launch({
      headless: false, // 必须是非 headless，让用户看到浏览器
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const context = await loginBrowser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    loginPage = await context.newPage();
    await loginPage.goto('https://x.com/i/flow/login');

    res.json({
      success: true,
      message: 'Browser opened. Please login manually in the browser window.',
      instructions: [
        '1. A browser window should have opened automatically',
        '2. Login to Twitter/X manually in that window',
        '3. After successful login, call /api/twitter-login-helper/save-cookies',
        '4. The browser will close and cookies will be saved'
      ]
    });

  } catch (error: any) {
    console.error('Failed to start manual login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 保存当前浏览器的 Cookie
 */
router.get('/save-cookies', async (req: Request, res: Response) => {
  try {
    if (!loginBrowser || !loginPage) {
      return res.status(400).json({
        success: false,
        error: 'No active login session. Please call /start-manual-login first.'
      });
    }

    console.log('💾 Saving cookies from manual login...');
    
    const context = loginPage.context();
    const cookies = await context.cookies();

    // 保存到文件
    const STATE_PATH = path.join(__dirname, '../../data/x_state.json');
    fs.writeFileSync(STATE_PATH, JSON.stringify(cookies, null, 2));
    
    console.log(`✅ Saved ${cookies.length} cookies to ${STATE_PATH}`);

    // 关闭浏览器
    await loginBrowser.close();
    loginBrowser = null;
    loginPage = null;

    res.json({
      success: true,
      message: `Successfully saved ${cookies.length} cookies. You can now restart the Twitter scraper.`,
      cookieCount: cookies.length
    });

  } catch (error: any) {
    console.error('Failed to save cookies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 取消登录并关闭浏览器
 */
router.get('/cancel-login', async (req: Request, res: Response) => {
  try {
    if (loginBrowser) {
      await loginBrowser.close();
      loginBrowser = null;
      loginPage = null;
      console.log('❌ Manual login cancelled');
    }

    res.json({ success: true, message: 'Login session cancelled' });

  } catch (error: any) {
    console.error('Failed to cancel login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 检查登录状态
 */
router.get('/status', (req: Request, res: Response) => {
  const isActive = loginBrowser !== null;
  res.json({
    success: true,
    loginSessionActive: isActive,
    message: isActive 
      ? 'Login session is active. Please complete login and call /save-cookies' 
      : 'No active login session'
  });
});

export default router;
