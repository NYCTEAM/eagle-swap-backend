# 🐦 Twitter/X 监控功能说明

## ✅ 功能概述

用户可以在我们网站**绑定关注的Twitter账号**（如CZ），系统会自动监控这些账号的推文并显示在网站上。

## 🎯 核心特性

### 1. 用户功能
- ✅ 添加关注的Twitter账号（如 @cz_binance）
- ✅ 查看关注账号的推文时间线
- ✅ 查看推文详情（包括回复）
- ✅ 移除不想关注的账号

### 2. 自动监控
- ✅ 每10分钟自动抓取新推文
- ✅ 保存到数据库
- ✅ 去重处理
- ✅ 区分新推文和回复

### 3. 免费方案
- ✅ 使用 **Nitter RSS**（Twitter开源前端）
- ✅ 无需Twitter API密钥
- ✅ 完全免费
- ✅ 无需用户授权

## 📊 数据库结构

### user_twitter_follows 表
```sql
CREATE TABLE user_twitter_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,           -- 用户钱包地址
  twitter_username TEXT NOT NULL,       -- Twitter用户名（如 cz_binance）
  display_name TEXT,                    -- 显示名称
  enabled INTEGER DEFAULT 1,            -- 是否启用
  last_fetch_at TEXT,                   -- 最后抓取时间
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_address, twitter_username)
);
```

### twitter_posts 表
```sql
CREATE TABLE twitter_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tweet_id TEXT NOT NULL UNIQUE,        -- 推文ID
  username TEXT NOT NULL,               -- 发推用户
  user_display_name TEXT,               -- 显示名称
  content TEXT NOT NULL,                -- 推文内容
  tweet_url TEXT,                       -- 推文链接
  is_reply INTEGER DEFAULT 0,           -- 是否是回复
  reply_to_username TEXT,               -- 回复给谁
  published_at TEXT NOT NULL,           -- 发布时间
  created_at TEXT DEFAULT (datetime('now'))
);
```

## 🔧 API接口

### 1. 添加关注
```http
POST /api/twitter/follow
Content-Type: application/json

{
  "userAddress": "0x123...",
  "twitterUsername": "cz_binance",
  "displayName": "CZ 🔶 BNB"
}
```

### 2. 获取关注列表
```http
GET /api/twitter/follows/:userAddress
```

### 3. 移除关注
```http
DELETE /api/twitter/follow
Content-Type: application/json

{
  "userAddress": "0x123...",
  "twitterUsername": "cz_binance"
}
```

### 4. 获取推文时间线
```http
GET /api/twitter/timeline/:userAddress?limit=20
```

### 5. 获取特定账号推文
```http
GET /api/twitter/account/cz_binance?limit=20
```

### 6. 获取所有推文（公共时间线）
```http
GET /api/twitter/all?limit=50
```

## 🚀 使用流程

### 用户端流程

1. **用户连接钱包**
   ```
   用户地址: 0x123...
   ```

2. **添加关注**
   ```javascript
   // 前端调用
   await axios.post('/api/twitter/follow', {
     userAddress: '0x123...',
     twitterUsername: 'cz_binance',
     displayName: 'CZ 🔶 BNB'
   });
   ```

3. **查看推文**
   ```javascript
   // 获取关注账号的推文
   const response = await axios.get('/api/twitter/timeline/0x123...');
   const tweets = response.data.data;
   ```

### 后端自动监控

```javascript
// 每10分钟自动执行
setInterval(() => {
  twitterMonitorService.monitorAllFollows()
    .then(count => {
      console.log(`监控完成: ${count} 条新推文`);
    });
}, 10 * 60 * 1000);
```

## 📱 前端示例

### 添加关注按钮
```tsx
const addTwitterFollow = async () => {
  const userAddress = await getWalletAddress();
  
  await axios.post(`${API_URL}/api/twitter/follow`, {
    userAddress,
    twitterUsername: 'cz_binance',
    displayName: 'CZ 🔶 BNB'
  });
  
  alert('已添加关注！');
};
```

### 显示推文列表
```tsx
const [tweets, setTweets] = useState([]);

useEffect(() => {
  const fetchTweets = async () => {
    const userAddress = await getWalletAddress();
    const response = await axios.get(
      `${API_URL}/api/twitter/timeline/${userAddress}`
    );
    setTweets(response.data.data);
  };
  
  fetchTweets();
}, []);

return (
  <div>
    {tweets.map(tweet => (
      <div key={tweet.id} className="tweet-card">
        <div className="tweet-header">
          <strong>{tweet.user_display_name}</strong>
          <span>@{tweet.username}</span>
        </div>
        <p>{tweet.content}</p>
        <a href={tweet.tweet_url} target="_blank">
          查看原推文 →
        </a>
      </div>
    ))}
  </div>
);
```

## 🌐 Nitter 实例

系统会自动尝试多个Nitter实例：

1. `nitter.poast.org`
2. `nitter.privacydev.net`
3. `nitter.net`

如果一个失败，会自动尝试下一个。

## ⚡ 工作原理

```
用户添加关注 @cz_binance
    ↓
保存到 user_twitter_follows 表
    ↓
后台定时任务（每10分钟）
    ↓
查询所有用户关注的账号（去重）
    ↓
遍历每个账号
    ↓
访问 Nitter RSS: nitter.net/cz_binance/rss
    ↓
解析RSS获取最新推文
    ↓
检查是否已存在（通过tweet_id）
    ↓
保存新推文到 twitter_posts 表
    ↓
用户刷新页面看到新推文
```

## 📊 数据示例

### 推文数据
```json
{
  "id": 1,
  "tweet_id": "1234567890",
  "username": "cz_binance",
  "user_display_name": "CZ 🔶 BNB",
  "content": "Building in public. Stay SAFU.",
  "tweet_url": "https://twitter.com/cz_binance/status/1234567890",
  "is_reply": 0,
  "reply_to_username": null,
  "published_at": "2025-12-24T10:30:00.000Z",
  "created_at": "2025-12-24T10:35:00.000Z"
}
```

### 回复推文
```json
{
  "id": 2,
  "tweet_id": "1234567891",
  "username": "cz_binance",
  "user_display_name": "CZ 🔶 BNB",
  "content": "Thanks for the support!",
  "tweet_url": "https://twitter.com/cz_binance/status/1234567891",
  "is_reply": 1,
  "reply_to_username": "VitalikButerin",
  "published_at": "2025-12-24T10:35:00.000Z",
  "created_at": "2025-12-24T10:40:00.000Z"
}
```

## 🎨 UI设计建议

### 1. 关注管理页面
```
┌─────────────────────────────────┐
│ 我关注的Twitter账号              │
├─────────────────────────────────┤
│ [+] 添加新关注                   │
├─────────────────────────────────┤
│ 🔶 CZ 🔶 BNB                    │
│    @cz_binance                  │
│    [移除]                        │
├─────────────────────────────────┤
│ 🦄 Vitalik Buterin              │
│    @VitalikButerin              │
│    [移除]                        │
└─────────────────────────────────┘
```

### 2. 推文时间线
```
┌─────────────────────────────────┐
│ 推文时间线                       │
├─────────────────────────────────┤
│ 🔶 CZ 🔶 BNB @cz_binance       │
│ Building in public. Stay SAFU.  │
│ 2小时前 · 查看原推文 →          │
├─────────────────────────────────┤
│ 🦄 Vitalik @VitalikButerin      │
│ Ethereum is scaling!            │
│ 5小时前 · 查看原推文 →          │
└─────────────────────────────────┘
```

## ⚠️ 注意事项

### 1. Nitter限制
- Nitter实例可能不稳定
- 某些实例可能被封禁
- 需要定期更新实例列表

### 2. 数据延迟
- 推文可能延迟10分钟显示
- 不是实时的
- 适合查看历史推文

### 3. 内容限制
- 只能获取公开推文
- 无法获取私密账号
- 无法获取点赞、转发数

## 🚀 未来优化

1. **实时推送** - 使用WebSocket推送新推文
2. **推文搜索** - 全文搜索推文内容
3. **推文分类** - 按主题分类（DeFi、NFT等）
4. **推文翻译** - 自动翻译英文推文
5. **推文分析** - 情感分析、关键词提取

## 📞 使用示例

### 完整流程示例

```javascript
// 1. 用户添加关注CZ
await axios.post('/api/twitter/follow', {
  userAddress: '0xabc...',
  twitterUsername: 'cz_binance'
});

// 2. 后台自动监控（每10分钟）
// 系统自动运行，无需手动触发

// 3. 用户查看推文
const response = await axios.get('/api/twitter/timeline/0xabc...');
console.log(response.data.data);
// [
//   { content: "Building in public...", ... },
//   { content: "Stay SAFU...", ... }
// ]

// 4. 用户移除关注
await axios.delete('/api/twitter/follow', {
  data: {
    userAddress: '0xabc...',
    twitterUsername: 'cz_binance'
  }
});
```

---

## ✅ 总结

这个系统允许用户：
1. **绑定关注** - 添加想关注的Twitter账号
2. **自动监控** - 系统每10分钟自动抓取新推文
3. **查看推文** - 在我们网站直接查看推文
4. **完全免费** - 使用Nitter RSS，无需API密钥

**适用场景：**
- 关注币圈KOL（CZ、Vitalik等）
- 查看项目官方推文
- 监控市场动态
- 获取第一手消息
