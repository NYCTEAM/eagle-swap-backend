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
    const fs = require('fs');
    const schemaPath = path.join(__dirname, '../database/schema-news-feed.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
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
          author: item.creator || item.author || source.name,
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
      db.prepare('UPDATE news_sources SET last_fetch_at = datetime("now") WHERE id = ?').run(source.id);
      
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
    const sources = db.prepare('SELECT * FROM news_sources WHERE enabled = 1 AND type = "rss"').all();
    
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
