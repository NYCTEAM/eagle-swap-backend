-- 新闻源配置表
CREATE TABLE IF NOT EXISTS news_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'rss', 'twitter', 'api'
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
  category TEXT, -- 'market', 'regulation', 'technology', 'defi', 'nft'
  tags TEXT, -- JSON array
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
  media_urls TEXT, -- JSON array
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
INSERT OR IGNORE INTO news_sources (name, type, url, icon) VALUES
  ('CoinDesk', 'rss', 'https://www.coindesk.com/arc/outboundfeeds/rss/', '📰'),
  ('Cointelegraph', 'rss', 'https://cointelegraph.com/rss', '📡'),
  ('CryptoSlate', 'rss', 'https://cryptoslate.com/feed/', '💎'),
  ('The Block', 'rss', 'https://www.theblock.co/rss.xml', '🔷'),
  ('Decrypt', 'rss', 'https://decrypt.co/feed', '🔓'),
  ('CZ Binance', 'twitter', 'https://x.com/cz_binance', '🐦');
