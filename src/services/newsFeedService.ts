import Database from 'better-sqlite3';
import path from 'path';
import Parser from 'rss-parser';
import axios from 'axios';

const db = new Database(path.join(__dirname, '../../data/eagleswap.db'));
const rssParser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['media:thumbnail', 'thumbnail'],
      ['description', 'description'],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

interface NewsArticle {
  source_id: number;
  title: string;
  content: string;
  summary: string;
  url: string;
  image_url?: string;
  author?: string;
  published_at: string;
  category?: string;
}

interface TwitterPost {
  tweet_id: string;
  username: string;
  user_display_name: string;
  user_avatar?: string;
  content: string;
  media_urls?: string;
  retweet_count: number;
  like_count: number;
  reply_count: number;
  is_reply: number;
  reply_to_tweet_id?: string;
  published_at: string;
}

class NewsFeedService {
  /**
   * 初始化数据库表
   */
  initDatabase() {
    const schema = `
-- 新闻源配置表
CREATE TABLE IF NOT EXISTS news_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  enabled INTEGER DEFAULT 1,
  last_fetch_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 新闻文章表
CREATE TABLE IF NOT EXISTS news_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  author TEXT,
  published_at TEXT NOT NULL,
  category TEXT,
  tags TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES news_sources(id)
);

-- Twitter推文表
CREATE TABLE IF NOT EXISTS twitter_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tweet_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  user_display_name TEXT,
  user_avatar TEXT,
  content TEXT NOT NULL,
  media_urls TEXT,
  retweet_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  is_reply INTEGER DEFAULT 0,
  reply_to_tweet_id TEXT,
  published_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source_id);
CREATE INDEX IF NOT EXISTS idx_twitter_published ON twitter_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_twitter_username ON twitter_posts(username);

-- 插入默认新闻源
INSERT OR IGNORE INTO news_sources (id, name, type, url, icon) VALUES
  (1, 'CoinDesk', 'rss', 'https://www.coindesk.com/arc/outboundfeeds/rss/', '📰'),
  (2, 'Cointelegraph', 'rss', 'https://cointelegraph.com/rss', '📡'),
  (3, 'CryptoSlate', 'rss', 'https://cryptoslate.com/feed/', '💎'),
  (4, 'The Block', 'rss', 'https://www.theblock.co/rss.xml', '🔷'),
  (5, 'Decrypt', 'rss', 'https://decrypt.co/feed', '🔓'),
  (6, 'CZ Binance', 'twitter', 'https://x.com/cz_binance', '🐦');
    `;
    
    db.exec(schema);
    console.log('✅ News feed database initialized');
  }

  /**
   * 获取所有启用的新闻源
   */
  getEnabledSources() {
    return db.prepare('SELECT * FROM news_sources WHERE enabled = 1').all();
  }

  /**
   * 采集RSS新闻
   */
  async fetchRSSFeed(source: any) {
    try {
      console.log(`📰 Fetching RSS from ${source.name}...`);
      const feed = await rssParser.parseURL(source.url);
      
      const articles: NewsArticle[] = [];
      
      for (const item of feed.items.slice(0, 20)) { // 只取最新20条
        if (!item.link) continue;
        
        // 检查是否已存在
        const exists = db.prepare('SELECT id FROM news_articles WHERE url = ?').get(item.link);
        if (exists) continue;
        
        // 提取图片
        let imageUrl = null;
        if (item.enclosure?.url) {
          imageUrl = item.enclosure.url;
        } else if ((item as any).media?.$ && (item as any).media.$.url) {
          imageUrl = (item as any).media.$.url;
        } else if ((item as any).thumbnail?.$ && (item as any).thumbnail.$.url) {
          imageUrl = (item as any).thumbnail.$.url;
        }
        
        // 提取内容
        const content = (item as any).contentEncoded || item.content || item.contentSnippet || '';
        const summary = item.contentSnippet?.substring(0, 200) || '';
        
        articles.push({
          source_id: source.id,
          title: item.title || 'Untitled',
          content: content,
          summary: summary,
          url: item.link,
          image_url: imageUrl,
          author: item.creator || (item as any).author || source.name,
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          category: this.categorizeArticle(item.title || '')
        });
      }
      
      // 批量插入
      if (articles.length > 0) {
        const stmt = db.prepare(`
          INSERT INTO news_articles (
            source_id, title, content, summary, url, 
            image_url, author, published_at, category
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const article of articles) {
          try {
            stmt.run(
              article.source_id,
              article.title,
              article.content,
              article.summary,
              article.url,
              article.image_url,
              article.author,
              article.published_at,
              article.category
            );
          } catch (err) {
            // 忽略重复错误
          }
        }
        
        console.log(`✅ Saved ${articles.length} articles from ${source.name}`);
      }
      
      // 更新最后采集时间
      db.prepare("UPDATE news_sources SET last_fetch_at = datetime('now') WHERE id = ?").run(source.id);
      
      return articles.length;
    } catch (error) {
      console.error(`❌ Error fetching RSS from ${source.name}:`, error);
      return 0;
    }
  }

  /**
   * 文章分类
   */
  categorizeArticle(title: string): string {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.match(/bitcoin|btc|price|market|trading|bull|bear/)) return 'market';
    if (lowerTitle.match(/sec|regulation|law|government|ban|legal/)) return 'regulation';
    if (lowerTitle.match(/blockchain|technology|protocol|upgrade|fork/)) return 'technology';
    if (lowerTitle.match(/defi|lending|yield|liquidity|dex/)) return 'defi';
    if (lowerTitle.match(/nft|metaverse|gaming|collectible/)) return 'nft';
    
    return 'general';
  }

  /**
   * 采集所有RSS源
   */
  async fetchAllRSS() {
    const sources = db.prepare("SELECT * FROM news_sources WHERE enabled = 1 AND type = 'rss'").all();
    
    let totalArticles = 0;
    for (const source of sources) {
      const count = await this.fetchRSSFeed(source);
      totalArticles += count;
    }
    
    console.log(`✅ Total articles fetched: ${totalArticles}`);
    return totalArticles;
  }

  /**
   * 获取最新新闻
   */
  getLatestNews(limit: number = 20, category?: string) {
    let query = `
      SELECT 
        na.*,
        ns.name as source_name,
        ns.icon as source_icon
      FROM news_articles na
      JOIN news_sources ns ON na.source_id = ns.id
    `;
    
    if (category) {
      query += ` WHERE na.category = ?`;
    }
    
    query += ` ORDER BY na.published_at DESC LIMIT ?`;
    
    return category 
      ? db.prepare(query).all(category, limit)
      : db.prepare(query).all(limit);
  }

  /**
   * 根据ID获取文章详情
   */
  getArticleById(id: number) {
    return db.prepare(`
      SELECT 
        na.*,
        ns.name as source_name,
        ns.icon as source_icon
      FROM news_articles na
      JOIN news_sources ns ON na.source_id = ns.id
      WHERE na.id = ?
    `).get(id);
  }

  /**
   * 获取Twitter推文（模拟数据，实际需要Twitter API）
   */
  getLatestTweets(username: string = 'cz_binance', limit: number = 10) {
    return db.prepare(`
      SELECT * FROM twitter_posts 
      WHERE username = ? 
      ORDER BY published_at DESC 
      LIMIT ?
    `).all(username, limit);
  }

  /**
   * 清理旧新闻（保留30天）
   */
  cleanupOldNews() {
    const result = db.prepare(`
      DELETE FROM news_articles 
      WHERE published_at < datetime('now', '-30 days')
    `).run();
    
    console.log(`🗑️ Cleaned up ${result.changes} old articles`);
    return result.changes;
  }
}

export default new NewsFeedService();
