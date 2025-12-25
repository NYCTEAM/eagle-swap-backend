/**
 * Twitter Scraper Service
 * 使用Playwright模拟浏览器登录Twitter并抓取推文
 * 完全免费，不需要API密钥
 */

import { chromium, Browser, Page } from 'playwright';
import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../data/eagleswap.db'));

interface ScraperConfig {
  username: string;
  password: string;
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
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    this.page = await context.newPage();

    console.log('✅ Browser launched');
  }

  /**
   * 登录Twitter
   */
  async login() {
    if (this.isLoggedIn) return;
    if (!this.page) await this.initBrowser();

    try {
      console.log('🔐 Logging in to Twitter...');
      
      await this.page!.goto('https://twitter.com/i/flow/login', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // 等待用户名输入框
      await this.page!.waitForSelector('input[autocomplete="username"]', { timeout: 10000 });
      await this.page!.fill('input[autocomplete="username"]', this.config.username);
      
      // 点击下一步
      await this.page!.click('div[role="button"]:has-text("Next")');
      await this.page!.waitForTimeout(2000);

      // 等待密码输入框
      await this.page!.waitForSelector('input[type="password"]', { timeout: 10000 });
      await this.page!.fill('input[type="password"]', this.config.password);

      // 点击登录
      await this.page!.click('div[role="button"][data-testid="LoginForm_Login_Button"]');
      await this.page!.waitForLoadState('networkidle', { timeout: 30000 });

      this.isLoggedIn = true;
      console.log('✅ Successfully logged in to Twitter');
    } catch (error) {
      console.error('❌ Failed to login to Twitter:', error);
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

      // 访问用户主页
      await this.page.goto(`https://twitter.com/${username}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // 等待推文加载
      await this.page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });

      // 滚动加载更多推文
      for (let i = 0; i < 3; i++) {
        await this.page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        await this.page.waitForTimeout(1000);
      }

      // 提取推文数据
      const tweets = await this.page.evaluate((targetUsername: string, maxTweets: number) => {
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
      }, username, limit);

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
