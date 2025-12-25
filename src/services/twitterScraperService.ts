/**
 * Twitter Scraper Service
 * 使用Playwright模拟浏览器登录Twitter并抓取推文
 * 完全免费，不需要API密钥
 */

import { chromium, Browser, Page } from 'playwright';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const db = new Database(path.join(__dirname, '../../data/eagleswap.db'));
const STATE_PATH = path.join(__dirname, '../../data/x_state.json');

interface ScraperConfig {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  headless: boolean;
}

interface Tweet {
  tweet_id: string;
  username: string;
  user_display_name: string;
  content: string;
  published_at: string;
  tweet_url: string;
  is_reply: number;
  reply_to?: string;
}

class TwitterScraperService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isLoggedIn: boolean = false;
  private config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  /**
   * 初始化浏览器 - 加入反检测机制
   */
  async initBrowser() {
    if (this.browser) return;

    console.log('🚀 Launching browser with stealth settings...');
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled', // 关键反检测参数
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      javaScriptEnabled: true,
      timezoneId: 'America/New_York'
    });

    // 注入反检测脚本
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      // @ts-ignore
      window.navigator.chrome = {
        runtime: {},
      };
      // @ts-ignore
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    this.page = await context.newPage();
    console.log('✅ Browser launched in stealth mode');
  }

  /**
   * 模拟真人输入
   */
  async humanType(selector: string, text: string) {
    if (!this.page) return;
    const element = this.page.locator(selector).first();
    await element.click();
    await this.page.waitForTimeout(Math.random() * 500 + 200);
    
    // 逐字输入，随机间隔
    for (const char of text) {
      await this.page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
    }
    await this.page.waitForTimeout(Math.random() * 500 + 300);
  }

  /**
   * 截图调试辅助方法
   */
  async saveDebugScreenshot(filename: string) {
    if (!this.page) return;
    try {
      const p = path.join(__dirname, '../../data', filename);
      await this.page.screenshot({ path: p, fullPage: true });
      console.log(`📸 Debug screenshot saved: ${filename}`);
    } catch {}
  }

  /**
   * 登录X (Twitter) - 重构后的清晰逻辑
   */
  async login() {
    if (this.isLoggedIn) return;
    if (!this.page) await this.initBrowser();

    const page = this.page!;
    const ctx = page.context();

    // 1. 尝试加载保存的Session
    if (fs.existsSync(STATE_PATH)) {
      try {
        console.log('🍪 Loading saved session...');
        const cookies = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
        await ctx.addCookies(cookies);
        
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000);
        
        // 检查是否真的登录成功
        if (page.url().includes('/home')) {
          this.isLoggedIn = true;
          console.log('✅ Session loaded, login skipped');
          return;
        } else {
          console.log('⚠️ Session expired, clearing cookies...');
          await ctx.clearCookies();
        }
      } catch (err) {
        console.log('⚠️ Failed to reuse session, continue normal login...');
      }
    }

    try {
      console.log('🔐 Starting fresh login...');
      await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      // 2. 输入账号 (优先Email -> 其次Username)
      console.log('📝 Step 1: Entering account identifier...');
      const loginInput = page.locator('input[autocomplete="username"]').first();
      await loginInput.waitFor({ state: 'visible', timeout: 10000 });
      
      const firstStepValue = this.config.email || this.config.username;
      await this.humanType('input[autocomplete="username"]', firstStepValue);
      
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);

      // 截图调试 Step 2
      await this.saveDebugScreenshot('x_step2_after_id.png');

      // 3. 判断下一步：是密码还是验证？
      // 检查是否要求输入手机号或用户名 (Unusual activity check)
      const challengeInput = page.locator('input[data-testid="ocfEnterTextTextInput"]').first();
      const passwordInput = page.locator('input[name="password"]').first();
      
      if (await challengeInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('⚠️ Step 1.5: Security challenge detected');
        
        // 判断挑战类型
        const pageText = await page.locator('body').textContent() || '';
        let challengeValue = '';
        
        if (pageText.toLowerCase().includes('phone')) {
          console.log('� Challenge asks for phone number');
          challengeValue = this.config.phone || '';
          if (!challengeValue) console.error('❌ Phone number required but not configured!');
        } else if (pageText.toLowerCase().includes('email')) {
          console.log('📧 Challenge asks for email');
          challengeValue = this.config.email || '';
        } else if (pageText.toLowerCase().includes('username')) {
          console.log('👤 Challenge asks for username');
          challengeValue = this.config.username;
        } else {
          // 智能回落：如果第一步用了邮箱，这里填用户名；如果第一步用了用户名，这里填邮箱
          challengeValue = (firstStepValue === this.config.email) ? this.config.username : (this.config.email || '');
          console.log(`🤔 Unknown challenge, trying fallback: ${challengeValue}`);
        }

        await this.humanType('input[data-testid="ocfEnterTextTextInput"]', challengeValue);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(5000);
      }

      // 4. 输入密码
      console.log('🔑 Step 3: Entering password...');
      await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
      await this.humanType('input[name="password"]', this.config.password);
      await page.keyboard.press('Enter');
      
      // 5. 等待登录成功
      await page.waitForTimeout(5000);
      await page.waitForLoadState('domcontentloaded');

      if (page.url().includes('/home')) {
        console.log('✅ Successfully logged in!');
        this.isLoggedIn = true;
        
        // 保存Cookies
        const cookies = await ctx.cookies();
        fs.writeFileSync(STATE_PATH, JSON.stringify(cookies, null, 2));
      } else {
        // 如果仍然失败，再等一会看看是不是加载慢
        await page.waitForTimeout(5000);
        if (page.url().includes('/home')) {
           console.log('✅ Successfully logged in (delayed)!');
           this.isLoggedIn = true;
           const cookies = await ctx.cookies();
           fs.writeFileSync(STATE_PATH, JSON.stringify(cookies, null, 2));
        } else {
           throw new Error(`Login failed. Final URL: ${page.url()}`);
        }
      }

    } catch (error) {
      await this.saveDebugScreenshot('x_login_final_error.png');
      console.error('❌ Login process failed:', error);
      throw error;
    }
  }

  /**
   * 抓取指定用户的推文
   */
  async fetchUserTweets(username: string, limit: number = 20): Promise<Tweet[]> {
    if (!this.isLoggedIn) await this.login();
    if (!this.page) throw new Error('Browser not initialized');

    try {
      console.log(`🐦 Fetching tweets from @${username}...`);

      // 访问用户主页 (使用 x.com)
      await this.page.goto(`https://x.com/${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // 等待推文加载
      await this.page.waitForSelector('article[data-testid="tweet"]', { timeout: 20000 });

      // 模拟真人滚动
      for (let i = 0; i < 3; i++) {
        await this.page.keyboard.press('PageDown');
        await this.page.waitForTimeout(Math.random() * 1000 + 1000);
      }

      // 提取推文数据
      const tweets = await this.page.evaluate(({ targetUsername, maxTweets }) => {
        const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
        const results: any[] = [];

        for (let i = 0; i < Math.min(tweetElements.length, maxTweets); i++) {
          const article = tweetElements[i];
          
          try {
            // 提取用户名
            const usernameEl = article.querySelector('div[data-testid="User-Name"] a[role="link"]');
            const tweetUsername = usernameEl?.getAttribute('href')?.replace('/', '') || '';
            
            // 提取推文内容
            const contentEl = article.querySelector('div[data-testid="tweetText"]');
            const content = contentEl?.textContent || '';

            // 提取推文链接
            const linkEl = article.querySelector('a[href*="/status/"]');
            const tweetUrl = linkEl?.getAttribute('href') || '';
            const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0] || '';

            // 提取时间
            const timeEl = article.querySelector('time');
            const publishedAt = timeEl?.getAttribute('datetime') || new Date().toISOString();

            // 提取显示名称
            const displayNameEl = article.querySelector('div[data-testid="User-Name"] span');
            const displayName = displayNameEl?.textContent || tweetUsername;

            // 检查是否是回复
            const isReply = article.querySelector('div[data-testid="reply"]') !== null;
            
            results.push({
              tweet_id: tweetId,
              username: tweetUsername,
              user_display_name: displayName,
              content: content,
              published_at: publishedAt,
              tweet_url: `https://twitter.com${tweetUrl}`,
              is_reply: isReply ? 1 : 0
            });
          } catch (err) {
            console.error('Error parsing tweet:', err);
          }
        }

        return results;
      }, { targetUsername: username, maxTweets: limit });

      console.log(`✅ Fetched ${tweets.length} tweets from @${username}`);
      return tweets as Tweet[];

    } catch (error) {
      console.error(`❌ Failed to fetch tweets from @${username}:`, error);
      return [];
    }
  }

  /**
   * 保存推文到数据库
   */
  saveTweets(tweets: Tweet[]): number {
    let saved = 0;

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO twitter_posts 
      (tweet_id, username, user_display_name, content, published_at, tweet_url, is_reply, reply_to_username)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const tweet of tweets) {
      try {
        const result = stmt.run(
          tweet.tweet_id,
          tweet.username,
          tweet.user_display_name,
          tweet.content,
          tweet.published_at,
          tweet.tweet_url,
          tweet.is_reply,
          tweet.reply_to || null
        );

        if (result.changes > 0) saved++;
      } catch (error) {
        console.error('Failed to save tweet:', error);
      }
    }

    console.log(`💾 Saved ${saved} tweets to database`);
    return saved;
  }

  /**
   * 监控所有关注的账号
   */
  async monitorAllFollows(): Promise<number> {
    const follows = db.prepare(`
      SELECT DISTINCT twitter_username 
      FROM user_twitter_follows 
      WHERE enabled = 1
    `).all() as { twitter_username: string }[];

    let totalTweets = 0;

    for (const follow of follows) {
      try {
        const tweets = await this.fetchUserTweets(follow.twitter_username, 20);
        const saved = this.saveTweets(tweets);
        totalTweets += saved;
      } catch (error) {
        console.error(`Failed to monitor @${follow.twitter_username}:`, error);
      }
    }

    return totalTweets;
  }

  /**
   * 关闭浏览器
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
      console.log('🔒 Browser closed');
    }
  }
}

export default TwitterScraperService;
