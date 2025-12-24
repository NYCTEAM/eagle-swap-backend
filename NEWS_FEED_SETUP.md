# 📰 新闻采集系统设置指南

## 🎯 功能概述

1. **RSS新闻采集** - 自动采集主流币圈媒体新闻
   - CoinDesk
   - Cointelegraph
   - CryptoSlate
   - The Block
   - Decrypt

2. **Twitter推文采集** - 实时采集CZ等KOL推文（需要API）

## 📦 安装依赖

```bash
cd eagle-swap-backend
npm install rss-parser
```

## 🗄️ 初始化数据库

```bash
# 在服务器上执行
docker exec <container_id> node -e '
const newsFeedService = require("./dist/services/newsFeedService").default;
newsFeedService.initDatabase();
console.log("✅ Database initialized");
'
```

## 🔄 手动采集新闻

```bash
# 采集所有RSS源
curl -X POST http://localhost:3005/api/news/fetch

# 或在容器内执行
docker exec <container_id> node -e '
const newsFeedService = require("./dist/services/newsFeedService").default;
newsFeedService.fetchAllRSS().then(count => {
  console.log(`✅ Fetched ${count} articles`);
});
'
```

## ⏰ 设置定时任务

### 方法1：使用cron（推荐）

```bash
# 编辑crontab
crontab -e

# 添加以下行（每小时采集一次）
0 * * * * docker exec <container_id> node -e 'require("./dist/services/newsFeedService").default.fetchAllRSS()'

# 每天清理旧新闻
0 2 * * * docker exec <container_id> node -e 'require("./dist/services/newsFeedService").default.cleanupOldNews()'
```

### 方法2：在代码中添加定时器

在 `src/index.ts` 中添加：

```typescript
import newsFeedService from './services/newsFeedService';

// 初始化数据库
newsFeedService.initDatabase();

// 启动时采集一次
newsFeedService.fetchAllRSS();

// 每小时采集一次
setInterval(() => {
  newsFeedService.fetchAllRSS();
}, 60 * 60 * 1000);

// 每天凌晨2点清理旧新闻
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 2) {
    newsFeedService.cleanupOldNews();
  }
}, 60 * 60 * 1000);
```

## 🐦 Twitter API配置（可选）

Twitter API需要付费订阅：
- **Free** - 不可用
- **Basic** - $100/月
- **Pro** - $5000/月

### 如果有Twitter API：

1. 申请Twitter Developer账号
2. 获取API密钥
3. 安装twitter-api-v2：
```bash
npm install twitter-api-v2
```

4. 在 `.env` 中添加：
```
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret
```

## 🎨 前端集成

在首页添加新闻组件：

```tsx
import NewsFeed from '@/components/NewsFeed';
import TwitterFeed from '@/components/TwitterFeed';

export default function HomePage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <NewsFeed />
      <TwitterFeed />
    </div>
  );
}
```

## 📊 API端点

- `GET /api/news/latest` - 获取最新新闻
  - 参数：`limit` (默认20), `category` (可选)
  
- `GET /api/news/tweets` - 获取Twitter推文
  - 参数：`username` (默认cz_binance), `limit` (默认10)
  
- `POST /api/news/fetch` - 手动触发采集

## 🔧 故障排查

### 新闻不显示
1. 检查数据库是否初始化
2. 手动触发采集
3. 查看后端日志

### RSS采集失败
- 检查网络连接
- 某些RSS源可能需要代理
- 检查RSS URL是否有效

## 📝 注意事项

1. RSS采集是免费的，但要遵守网站的robots.txt
2. Twitter API需要付费，建议先用RSS
3. 定期清理旧新闻避免数据库过大
4. 可以添加更多RSS源

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install rss-parser

# 2. 编译代码
npm run build

# 3. 初始化数据库
node -e 'require("./dist/services/newsFeedService").default.initDatabase()'

# 4. 采集新闻
node -e 'require("./dist/services/newsFeedService").default.fetchAllRSS()'

# 5. 启动服务器
npm start
```
