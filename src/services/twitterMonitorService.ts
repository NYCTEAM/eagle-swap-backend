import Database from 'better-sqlite3';
import path from 'path';
import { getTwitterApiService } from './twitterApiService';
import translationService from './translationService';

const db = new Database(path.join(__dirname, '../../data/eagleswap.db'));

interface TwitterAccount {
  id: number;
  user_address: string;
  twitter_username: string;
  enabled: number;
  last_fetch_at?: string;
  created_at: string;
}

interface Tweet {
  tweet_id: string;
  username: string;
  user_display_name: string;
  content: string;
  content_zh?: string;
  published_at: string;
  tweet_url: string;
  is_reply: number;
  reply_to?: string;
  quoted_tweet_id?: string;
  quoted_tweet_content?: string;
  quoted_tweet_content_zh?: string;
  quoted_tweet_author?: string;
}

class TwitterMonitorService {
  /**
   * 初始化数据库表
   */
  initDatabase() {
    const schema = `
-- 用户关注的Twitter账号
CREATE TABLE IF NOT EXISTS user_twitter_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,
  twitter_username TEXT NOT NULL,
  display_name TEXT,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 2,
  last_fetch_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_address, twitter_username)
);

-- Twitter推文表（扩展）
CREATE TABLE IF NOT EXISTS twitter_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tweet_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  user_display_name TEXT,
  user_avatar TEXT,
  content TEXT NOT NULL,
  content_zh TEXT,
  media_urls TEXT,
  tweet_url TEXT,
  retweet_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  is_reply INTEGER DEFAULT 0,
  reply_to_tweet_id TEXT,
  reply_to_username TEXT,
  quoted_tweet_id TEXT,
  quoted_tweet_content TEXT,
  quoted_tweet_content_zh TEXT,
  quoted_tweet_author TEXT,
  published_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_follows ON user_twitter_follows(user_address, enabled);
CREATE INDEX IF NOT EXISTS idx_twitter_username ON twitter_posts(username);
CREATE INDEX IF NOT EXISTS idx_twitter_published ON twitter_posts(published_at DESC);
    `;
    
    db.exec(schema);
    
    // 安全地添加 priority 列（如果旧表不存在此列）
    try {
      db.exec('ALTER TABLE user_twitter_follows ADD COLUMN priority INTEGER DEFAULT 2');
      console.log('✅ Added priority column to existing table');
    } catch (error: any) {
      // 列已存在，忽略错误
      if (!error.message?.includes('duplicate column')) {
        console.error('Error adding priority column:', error);
      }
    }
    
    // 添加新的翻译和引用字段
    const newColumns = [
      'ALTER TABLE twitter_posts ADD COLUMN content_zh TEXT',
      'ALTER TABLE twitter_posts ADD COLUMN quoted_tweet_id TEXT',
      'ALTER TABLE twitter_posts ADD COLUMN quoted_tweet_content TEXT',
      'ALTER TABLE twitter_posts ADD COLUMN quoted_tweet_content_zh TEXT',
      'ALTER TABLE twitter_posts ADD COLUMN quoted_tweet_author TEXT'
    ];
    
    for (const sql of newColumns) {
      try {
        db.exec(sql);
      } catch (error: any) {
        // 列已存在，忽略
        if (!error.message?.includes('duplicate column')) {
          console.error('Error adding column:', error);
        }
      }
    }
    
    console.log('✅ Twitter monitor database initialized');
  }

  /**
   * 用户添加关注的Twitter账号
   */
  addTwitterFollow(userAddress: string, twitterUsername: string, displayName?: string) {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO user_twitter_follows 
        (user_address, twitter_username, display_name, enabled)
        VALUES (?, ?, ?, 1)
      `);
      
      stmt.run(userAddress, twitterUsername.replace('@', ''), displayName || twitterUsername);
      
      console.log(`✅ User ${userAddress} added follow @${twitterUsername}`);
      return { success: true, message: 'Twitter account added' };
    } catch (error) {
      console.error('Failed to add Twitter follow:', error);
      return { success: false, error: 'Failed to add Twitter account' };
    }
  }

  /**
   * 获取用户关注的Twitter账号列表
   */
  getUserFollows(userAddress: string) {
    return db.prepare(`
      SELECT * FROM user_twitter_follows 
      WHERE user_address = ? AND enabled = 1
      ORDER BY created_at DESC
    `).all(userAddress);
  }

  /**
   * 移除关注
   */
  removeTwitterFollow(userAddress: string, twitterUsername: string) {
    const result = db.prepare(`
      DELETE FROM user_twitter_follows 
      WHERE user_address = ? AND twitter_username = ?
    `).run(userAddress, twitterUsername.replace('@', ''));
    
    return { success: result.changes > 0 };
  }

  /**
   * 使用 TwitterAPI.io 获取推文
   */
  async fetchTweetsFromApi(username: string): Promise<Tweet[]> {
    try {
      console.log(`🐦 Fetching tweets for @${username} using TwitterAPI.io...`);
      
      let twitterApi;
      try {
        twitterApi = getTwitterApiService();
      } catch (error) {
        console.error(`❌ Failed to initialize TwitterAPI service: ${error}`);
        return [];
      }
      
      const apiTweets = await twitterApi.fetchUserTweets(username, 20);
      
      const tweets: Tweet[] = [];
      
      for (const item of apiTweets) {
        // 检查是否已存在
        const exists = db.prepare('SELECT id FROM twitter_posts WHERE tweet_id = ?').get(item.id);
        if (exists) continue;
        
        // 翻译推文内容（如果是英文）
        const contentZh = await translationService.translateToZh(item.text);
        
        // 处理引用推文（Quote Tweet）
        let quotedTweetId, quotedTweetContent, quotedTweetContentZh, quotedTweetAuthor;
        if (item.quotedTweet) {
          quotedTweetId = item.quotedTweet.id;
          quotedTweetContent = item.quotedTweet.text;
          quotedTweetContentZh = await translationService.translateToZh(item.quotedTweet.text);
          quotedTweetAuthor = item.quotedTweet.author?.userName;
        }
        
        tweets.push({
          tweet_id: item.id,
          username: item.author.userName,
          user_display_name: item.author.name,
          content: item.text,
          content_zh: contentZh,
          published_at: new Date(item.createdAt).toISOString(),
          tweet_url: `https://twitter.com/${item.author.userName}/status/${item.id}`,
          is_reply: item.isReply ? 1 : 0,
          reply_to: item.inReplyToUsername,
          quoted_tweet_id: quotedTweetId,
          quoted_tweet_content: quotedTweetContent,
          quoted_tweet_content_zh: quotedTweetContentZh,
          quoted_tweet_author: quotedTweetAuthor
        });
      }
      
      console.log(`✅ Fetched ${tweets.length} new tweets from @${username} (with translations)`);
      return tweets;
      
    } catch (error) {
      console.error(`❌ TwitterAPI.io error for @${username}:`, error);
      return [];
    }
  }

  /**
   * 保存推文到数据库
   */
  saveTweets(tweets: Tweet[]) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO twitter_posts 
      (tweet_id, username, user_display_name, content, content_zh, tweet_url, 
       is_reply, reply_to_username, quoted_tweet_id, quoted_tweet_content, 
       quoted_tweet_content_zh, quoted_tweet_author, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let saved = 0;
    for (const tweet of tweets) {
      try {
        const result = stmt.run(
          tweet.tweet_id,
          tweet.username,
          tweet.user_display_name,
          tweet.content,
          tweet.content_zh || null,
          tweet.tweet_url,
          tweet.is_reply,
          tweet.reply_to || null,
          tweet.quoted_tweet_id || null,
          tweet.quoted_tweet_content || null,
          tweet.quoted_tweet_content_zh || null,
          tweet.quoted_tweet_author || null,
          tweet.published_at
        );
        if (result.changes > 0) saved++;
      } catch (error) {
        // 忽略重复错误
      }
    }
    
    console.log(`💾 Saved ${saved} tweets to database`);
    return saved;
  }

  /**
   * 监控所有用户关注的Twitter账号
   */
  async monitorAllFollows() {
    try {
      // 获取所有启用的关注账号（去重）
      const follows = db.prepare(`
        SELECT DISTINCT twitter_username, display_name 
        FROM user_twitter_follows 
        WHERE enabled = 1
      `).all() as TwitterAccount[];
      
      console.log(`🔍 Monitoring ${follows.length} Twitter accounts...`);
      
      let totalNewTweets = 0;
      
      for (const follow of follows) {
        const tweets = await this.fetchTweetsFromApi(follow.twitter_username);
        const saved = this.saveTweets(tweets);
        totalNewTweets += saved;
        
        // 更新最后获取时间
        db.prepare(`
          UPDATE user_twitter_follows 
          SET last_fetch_at = datetime('now') 
          WHERE twitter_username = ?
        `).run(follow.twitter_username);
        
        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log(`✅ Total new tweets: ${totalNewTweets}`);
      return totalNewTweets;
      
    } catch (error) {
      console.error('Error monitoring Twitter follows:', error);
      return 0;
    }
  }

  /**
   * 分级监控：根据优先级和时间间隔更新
   * Priority 1 (热门): 每 5 分钟
   * Priority 2 (普通): 每 15 分钟
   * Priority 3 (冷门): 每 30 分钟
   */
  async monitorByPriority(priority: number, intervalMinutes: number) {
    try {
      // 获取指定优先级且超过更新间隔的账号
      const follows = db.prepare(`
        SELECT DISTINCT twitter_username, display_name, priority, last_fetch_at
        FROM user_twitter_follows 
        WHERE enabled = 1 
          AND priority = ?
          AND (
            last_fetch_at IS NULL 
            OR datetime(last_fetch_at, '+${intervalMinutes} minutes') <= datetime('now')
          )
      `).all(priority) as TwitterAccount[];
      
      if (follows.length === 0) {
        return 0;
      }
      
      const priorityLabel = priority === 1 ? '🔥 热门' : priority === 2 ? '📊 普通' : '❄️ 冷门';
      console.log(`${priorityLabel} Monitoring ${follows.length} accounts (${intervalMinutes}min interval)...`);
      
      let totalNewTweets = 0;
      
      for (const follow of follows) {
        const tweets = await this.fetchTweetsFromApi(follow.twitter_username);
        const saved = this.saveTweets(tweets);
        totalNewTweets += saved;
        
        // 更新最后获取时间
        db.prepare(`
          UPDATE user_twitter_follows 
          SET last_fetch_at = datetime('now') 
          WHERE twitter_username = ?
        `).run(follow.twitter_username);
        
        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      if (totalNewTweets > 0) {
        console.log(`✅ ${priorityLabel} ${totalNewTweets} new tweets`);
      }
      return totalNewTweets;
      
    } catch (error) {
      console.error(`Error monitoring priority ${priority}:`, error);
      return 0;
    }
  }

  /**
   * 自动调整账号优先级（根据关注人数）
   * >= 10 人关注 -> 热门 (Priority 1)
   * >= 3 人关注 -> 普通 (Priority 2)
   * < 3 人关注 -> 冷门 (Priority 3)
   */
  autoAdjustPriorities() {
    try {
      // 统计每个账号的关注人数
      const stats = db.prepare(`
        SELECT twitter_username, COUNT(DISTINCT user_address) as follower_count
        FROM user_twitter_follows
        WHERE enabled = 1
        GROUP BY twitter_username
      `).all() as Array<{ twitter_username: string; follower_count: number }>;
      
      let updated = 0;
      for (const stat of stats) {
        let newPriority = 3; // 默认冷门
        
        if (stat.follower_count >= 10) {
          newPriority = 1; // 热门
        } else if (stat.follower_count >= 3) {
          newPriority = 2; // 普通
        }
        
        const result = db.prepare(`
          UPDATE user_twitter_follows 
          SET priority = ? 
          WHERE twitter_username = ? AND priority != ?
        `).run(newPriority, stat.twitter_username, newPriority);
        
        if (result.changes > 0) {
          const label = newPriority === 1 ? '🔥 Hot' : newPriority === 2 ? '📊 Normal' : '❄️ Cold';
          console.log(`📊 @${stat.twitter_username} -> ${label} (${stat.follower_count} followers)`);
          updated++;
        }
      }
      
      if (updated > 0) {
        console.log(`✅ Auto-adjusted ${updated} account priorities`);
      }
      
      return updated;
    } catch (error) {
      console.error('Error auto-adjusting priorities:', error);
      return 0;
    }
  }

  /**
   * 获取用户关注账号的最新推文
   */
  getUserTimelineTweets(userAddress: string, limit: number = 20) {
    return db.prepare(`
      SELECT tp.* 
      FROM twitter_posts tp
      INNER JOIN user_twitter_follows utf 
        ON tp.username = utf.twitter_username
      WHERE utf.user_address = ? AND utf.enabled = 1
      ORDER BY tp.published_at DESC
      LIMIT ?
    `).all(userAddress, limit);
  }

  /**
   * 获取特定账号的推文
   */
  getAccountTweets(username: string, limit: number = 20) {
    return db.prepare(`
      SELECT * FROM twitter_posts 
      WHERE username = ?
      ORDER BY published_at DESC
      LIMIT ?
    `).all(username.replace('@', ''), limit);
  }

  /**
   * 获取所有推文（用于公共时间线）
   */
  getAllTweets(limit: number = 50) {
    return db.prepare(`
      SELECT * FROM twitter_posts 
      ORDER BY published_at DESC
      LIMIT ?
    `).all(limit);
  }
}

export default new TwitterMonitorService();
