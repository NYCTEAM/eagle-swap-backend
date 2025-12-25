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
   * 初始化浏览器
   */
  async initBrowser() {
    if (this.browser) return;

    console.log('🚀 Launching browser...');
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US', // 固定英文，减少语言问题
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    this.page = await context.newPage();

    console.log('✅ Browser launched');
  }

  /**
   * 登录X (Twitter)
   */
  async login() {
    if (this.isLoggedIn) return;
    if (!this.page) await this.initBrowser();

    const page = this.page!;
    const ctx = page.context();

    // ✅ 如果之前保存过登录态，直接复用（避免每次走登录流程）
    if (fs.existsSync(STATE_PATH)) {
      try {
        console.log('🍪 Loading saved session...');
        const cookies = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
        await ctx.addCookies(cookies);
        
        // 验证是否已登录
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);
        
        this.isLoggedIn = true;
        console.log('✅ Session loaded, login skipped');
        return;
      } catch (err) {
        console.log('⚠️ Failed to reuse session, continue normal login...');
      }
    }

    try {
      console.log('🔐 Logging in to X...');
      await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
      console.log('✅ Login page loaded');
      await page.waitForTimeout(3000);

      // 1) 处理可能的 cookie 弹窗
      try {
        const cookieBtn = page.getByRole('button', { name: /Accept|Agree|接受|同意/i });
        if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log('🍪 Clicking cookie consent...');
          await cookieBtn.click();
          await page.waitForTimeout(800);
        }
      } catch {}

      // 2) 输入用户名或邮箱
      console.log('📝 Waiting for username input...');
      const userInput = page.locator('input[autocomplete="username"]').first();
      await userInput.waitFor({ state: 'visible', timeout: 10000 });
      
      // 优先尝试使用邮箱登录，因为这通常更稳定
      const loginId = this.config.email || this.config.username;
      console.log(`✅ Username input found, filling with ${this.config.email ? 'email' : 'username'}...`);
      
      // 模拟人类输入速度
      await userInput.click();
      await page.waitForTimeout(500);
      await userInput.type(loginId, { delay: 100 });
      await page.waitForTimeout(1000);

      // 3) 点击 Next（中英兼容）
      console.log('👆 Looking for Next button...');
      const nextBtn = page.getByRole('button', { name: /Next|下一步|继续/i }).first();
      await nextBtn.waitFor({ state: 'visible', timeout: 30000 });
      console.log('✅ Next button found, clicking...');
      await nextBtn.click();
      
      // 等待页面导航
      await page.waitForTimeout(5000);
      console.log('⏳ Waiting for page transition...');

      // 保存中间截图
      try {
        await page.screenshot({ path: path.join(__dirname, '../../data/x_after_username.png'), fullPage: true });
        console.log('📸 Saved screenshot after username step');
      } catch {}

      // 4) 检查是否有错误提示
      try {
        const errorText = await page.locator('text=/Sorry|Incorrect|wrong|error|错误/i').first().textContent({ timeout: 2000 }).catch(() => null);
        if (errorText) {
          console.log('❌ Error detected on page:', errorText);
          throw new Error(`Login error: ${errorText}`);
        }
      } catch {}

      // 5) 处理可能的验证挑战（email/phone）
      console.log('🔍 Checking for challenge step...');
      try {
        // 等待一下看是否出现挑战页面
        await page.waitForTimeout(3000);
        
        // 检查是否回到了登录首页（说明验证失败）
        const loginPageIndicator = page.locator('text=/Sign in to X|Log in to X/i');
        if (await loginPageIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('❌ Returned to login page - username or verification failed');
          console.log('💡 Possible issues:');
          console.log('   1. Username does not exist or is incorrect');
          console.log('   2. Account is locked or suspended');
          console.log('   3. Email/phone verification failed');
          throw new Error('Login failed - returned to login page after username/verification');
        }
        
        const challengeInput = page.locator('input[name="text"]').first();
        if (await challengeInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log('⚠️ Challenge step detected - additional verification required.');
          
          // 获取页面提示文本
          try {
            const pageText = await page.locator('body').textContent({ timeout: 2000 });
            const isEmailChallenge = pageText?.toLowerCase().includes('email');
            const isPhoneChallenge = pageText?.toLowerCase().includes('phone');
            console.log(`📋 Challenge type: ${isEmailChallenge ? 'Email' : isPhoneChallenge ? 'Phone' : 'Unknown'}`);
          } catch {}
          
          // 获取页面提示文本，判断是需要邮箱还是手机
          let verificationValue = this.config.email || this.config.phone || this.config.username;
          try {
            const pageText = await page.locator('body').textContent({ timeout: 2000 });
            const lowerText = pageText?.toLowerCase() || '';
            
            // 优先匹配页面要求的类型
            if (lowerText.includes('phone') && this.config.phone) {
              console.log('� Page asks for phone, using phone number');
              verificationValue = this.config.phone;
            } else if (lowerText.includes('email') && this.config.email) {
              console.log('� Page asks for email, using email address');
              verificationValue = this.config.email;
            } else {
              console.log('⚠️ Could not detect specific requirement, using default verification value');
            }
          } catch {}
          
          console.log(`📝 Filling verification with: ${verificationValue}`);
          await challengeInput.fill(verificationValue);
          await page.waitForTimeout(1000);
          
          // 保存验证步骤截图
          try {
            await page.screenshot({ path: path.join(__dirname, '../../data/x_verification_step.png'), fullPage: true });
            console.log('📸 Saved verification step screenshot');
          } catch {}
          
          const nextBtn2 = page.getByRole('button', { name: /Next|下一步|继续/i }).first();
          await nextBtn2.click();
          await page.waitForTimeout(8000); // 增加等待时间
          
          console.log('✅ Challenge step completed, waiting for next page...');
        } else {
          console.log('✅ No challenge step detected');
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('returned to login page')) {
          throw err;
        }
        console.log('⚠️ Challenge check completed');
      }

      // 6) 输入密码 - 使用多种选择器
      console.log('🔑 Waiting for password input...');
      
      // 尝试多种密码输入选择器
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[autocomplete="current-password"]',
        'input[autocomplete*="password"]'
      ];
      
      let passInput = null;
      for (const selector of passwordSelectors) {
        try {
          const input = page.locator(selector).first();
          if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
            passInput = input;
            console.log(`✅ Password input found with selector: ${selector}`);
            break;
          }
        } catch {}
      }
      
      if (!passInput) {
        console.log('❌ No password input found. Page might be showing an error or challenge.');
        
        // 打印当前页面URL和标题
        const currentUrl = page.url();
        const pageTitle = await page.title().catch(() => 'Unknown');
        console.log('📍 Current URL:', currentUrl);
        console.log('📄 Page title:', pageTitle);
        
        // 尝试查找页面上的所有文本内容（前500个字符）
        try {
          const bodyText = await page.locator('body').textContent({ timeout: 3000 });
          const preview = bodyText?.substring(0, 500).replace(/\s+/g, ' ').trim();
          console.log('📝 Page content preview:', preview);
        } catch {}
        
        // 检查是否有错误消息
        try {
          const errorElements = await page.locator('[role="alert"], .error, [data-testid*="error"]').allTextContents();
          if (errorElements.length > 0) {
            console.log('⚠️ Error messages found:', errorElements);
          }
        } catch {}
        
        throw new Error('Password input not found - check screenshots for details');
      }
      
      console.log('✅ Password input found, filling...');
      await passInput.fill(this.config.password);
      await page.waitForTimeout(500);

      // 6) 点击 Log in
      const loginBtn = page.getByRole('button', { name: /Log in|Sign in|登录|登入/i }).first()
        .or(page.locator('[data-testid="LoginForm_Login_Button"]').first());
      await loginBtn.waitFor({ state: 'visible', timeout: 30000 });
      await loginBtn.click();

      // 7) 等待进入已登录页面
      await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
      await page.waitForTimeout(2000);

      this.isLoggedIn = true;
      console.log('✅ Successfully logged in');

      // ✅ 保存 cookie（下次直接复用）
      const cookies = await ctx.cookies();
      fs.writeFileSync(STATE_PATH, JSON.stringify(cookies, null, 2));
      console.log('💾 Saved session cookies');
    } catch (error) {
      // ✅ 出错时保存截图
      try {
        await page.screenshot({ 
          path: path.join(__dirname, '../../data/x_login_error.png'), 
          fullPage: true 
        });
        console.log('🧩 Saved debug screenshot: data/x_login_error.png');
      } catch {}
      console.error('❌ Failed to login:', error);
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

      // 滚动加载更多推文
      for (let i = 0; i < 3; i++) {
        await this.page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        await this.page.waitForTimeout(1000);
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
            
            // 只抓取目标用户的推文
            if (tweetUsername !== targetUsername) continue;

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
