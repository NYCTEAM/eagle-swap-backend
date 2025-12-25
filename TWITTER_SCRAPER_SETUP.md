# Twitter Scraper Setup (免费方案)

## 📋 概述

使用Puppeteer模拟浏览器登录Twitter并抓取推文，**完全免费**，不需要API密钥。

## 🔧 配置

### 1. 环境变量

在 `.env` 文件中添加你的Twitter账号信息：

```bash
# Twitter账号配置（用于Puppeteer登录）
TWITTER_USERNAME=your_twitter_username
TWITTER_PASSWORD=your_twitter_password
TWITTER_SCRAPER_HEADLESS=true  # true=无头模式，false=显示浏览器
```

### 2. 安装依赖

```bash
npm install puppeteer @types/puppeteer
```

### 3. Docker配置

如果在Docker中运行，需要安装Chrome依赖：

在 `Dockerfile` 中添加：

```dockerfile
# 安装Chrome依赖
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*
```

## 🚀 使用方法

### 在 `server.ts` 中集成

```typescript
import TwitterScraperService from './services/twitterScraperService';

// 创建scraper实例
const twitterScraper = new TwitterScraperService({
  username: process.env.TWITTER_USERNAME || '',
  password: process.env.TWITTER_PASSWORD || '',
  headless: process.env.TWITTER_SCRAPER_HEADLESS === 'true'
});

// 初始化并登录
await twitterScraper.initBrowser();
await twitterScraper.login();

// 监控所有关注的账号（每5分钟）
setInterval(async () => {
  try {
    const count = await twitterScraper.monitorAllFollows();
    console.log(`✅ Twitter scraper completed: ${count} tweets`);
  } catch (error) {
    console.error('❌ Twitter scraper failed:', error);
  }
}, 5 * 60 * 1000);
```

### 手动抓取特定用户

```typescript
// 抓取CZ的最新20条推文
const tweets = await twitterScraper.fetchUserTweets('cz_binance', 20);
const saved = twitterScraper.saveTweets(tweets);
console.log(`Saved ${saved} tweets`);
```

## ⚠️ 注意事项

### 1. 账号安全
- 建议使用专门的Twitter账号
- 不要使用你的主账号
- 定期更换密码

### 2. 速率限制
- 不要频繁抓取（建议5-10分钟一次）
- 避免同时抓取太多账号
- Twitter可能会检测到自动化行为

### 3. 稳定性
- Puppeteer比Nitter更稳定
- 但需要更多系统资源
- 建议在服务器上使用无头模式

### 4. 内存使用
- Chrome浏览器会占用较多内存（约200-300MB）
- 建议定期重启浏览器
- 可以使用 `twitterScraper.close()` 关闭浏览器

## 🔄 切换回Nitter

如果想切换回Nitter（不需要账号密码）：

在 `server.ts` 中使用原来的 `twitterMonitorService` 即可。

## 📊 性能对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Nitter** | 轻量、快速、无需账号 | 实例不稳定、经常失效 |
| **Puppeteer** | 稳定、可靠、功能完整 | 占用资源多、需要账号 |
| **Twitter API** | 官方支持、最稳定 | 需要付费、审核麻烦 |

## 🎯 推荐方案

**生产环境**：使用Puppeteer（本方案）
**开发环境**：使用Nitter（快速测试）
**企业级**：使用Twitter API（付费）

## 🐛 故障排除

### 登录失败
- 检查用户名密码是否正确
- Twitter可能需要验证码（需要手动处理）
- 尝试使用非无头模式查看问题

### Chrome启动失败
- 检查是否安装了所有依赖
- 查看Docker日志
- 尝试使用 `--no-sandbox` 参数

### 抓取失败
- Twitter页面结构可能改变
- 检查选择器是否正确
- 查看浏览器截图调试
