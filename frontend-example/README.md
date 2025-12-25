# Twitter 推文时间线 UI 组件

这是一个完整的 Twitter 风格推文展示组件，支持中英文显示和引用推文。

## 功能特性

✅ **Twitter 风格 UI** - 完全模仿 Twitter 的设计风格
✅ **中英文双语显示** - 自动显示原文和中文翻译
✅ **引用推文支持** - 完整显示被引用的推文
✅ **响应式设计** - 支持移动端和桌面端
✅ **暗色模式** - 自动适配系统主题
✅ **互动按钮** - 回复、转发、点赞、分享
✅ **认证标志** - 显示认证用户的蓝V标志

## 文件结构

```
frontend-example/
├── TweetCard.tsx          # 单个推文卡片组件
├── TweetCard.css          # 推文卡片样式
├── TweetTimeline.tsx      # 推文时间线组件
├── TweetTimeline.css      # 时间线样式
└── README.md              # 使用文档
```

## 快速开始

### 1. 安装依赖

```bash
npm install react react-dom
# 或
yarn add react react-dom
```

### 2. 复制组件文件

将以下文件复制到你的 React 项目中：
- `TweetCard.tsx`
- `TweetCard.css`
- `TweetTimeline.tsx`
- `TweetTimeline.css`

### 3. 使用组件

```tsx
import React from 'react';
import TweetTimeline from './components/TweetTimeline';

function App() {
  return (
    <div className="App">
      {/* 公共时间线（所有热门推文） */}
      <TweetTimeline limit={50} />

      {/* 或者个性化时间线（用户关注的账号） */}
      <TweetTimeline 
        userAddress="0x1234..." 
        limit={20} 
      />
    </div>
  );
}

export default App;
```

## API 端点

组件会自动调用以下 API：

### 公共时间线
```
GET /api/twitter/all?limit=50
```

### 个性化时间线
```
GET /api/twitter/timeline/:userAddress?limit=20
```

### 响应格式

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tweet_id": "123456",
      "username": "cz_binance",
      "user_display_name": "CZ 🔶 BNB",
      "content": "When bitcoin was ATH...",
      "content_zh": "当比特币处于历史最高点时...",
      "tweet_url": "https://twitter.com/cz_binance/status/123456",
      "is_reply": 0,
      "quoted_tweet_id": "789012",
      "quoted_tweet_content": "KGST First nation backed stablecoin",
      "quoted_tweet_content_zh": "KGST 首个国家支持的稳定币",
      "quoted_tweet_author": "sadyrzhaparovkg",
      "retweet_count": 1200,
      "like_count": 17100,
      "reply_count": 2500,
      "published_at": "2025-12-24T19:38:00.000Z"
    }
  ]
}
```

## 组件属性

### TweetTimeline

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `userAddress` | `string` | `undefined` | 用户钱包地址，提供时显示个性化时间线 |
| `limit` | `number` | `50` | 显示的推文数量 |

### TweetCard

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `tweet` | `Tweet` | 必填 | 推文数据对象 |
| `showTranslation` | `boolean` | `true` | 是否显示中文翻译 |

## 样式定制

### 修改主题颜色

在 `TweetCard.css` 中修改以下变量：

```css
/* 主色调 */
.tweet-action-btn:hover {
  color: #1d9bf0; /* Twitter 蓝色 */
}

/* 认证标志颜色 */
.verified-badge {
  fill: #1d9bf0;
}

/* 点赞按钮颜色 */
.like-btn:hover {
  color: #f91880; /* 粉色 */
}
```

### 修改字体

```css
.tweet-text {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
```

## 功能说明

### 1. 中英文显示

- **原文**：显示推文的原始内容（通常是英文）
- **翻译**：显示 Google Translate 自动翻译的中文
- **切换按钮**：点击"显示/隐藏翻译"可以切换显示

### 2. 引用推文

当推文引用了其他推文时，会在底部显示一个灰色框：
- 显示被引用推文的作者
- 显示被引用推文的内容
- 显示被引用推文的中文翻译

### 3. 回复显示

如果推文是回复，会在顶部显示：
```
回复 @username
```

### 4. 互动按钮

- **回复**：显示回复数量
- **转发**：显示转发数量
- **点赞**：显示点赞数量
- **分享**：分享按钮

### 5. 认证标志

热门账号会显示蓝色认证标志：
- binance
- cz_binance
- elonmusk
- VitalikButerin

## 响应式设计

组件会自动适配不同屏幕尺寸：

- **桌面端** (>768px)：完整显示所有功能
- **移动端** (≤768px)：优化布局，堆叠显示

## 暗色模式

组件会自动检测系统主题：

```css
@media (prefers-color-scheme: dark) {
  /* 暗色模式样式 */
}
```

## 性能优化

1. **虚拟滚动**：对于大量推文，建议使用 `react-window` 或 `react-virtualized`
2. **懒加载**：使用 `IntersectionObserver` 实现无限滚动
3. **图片懒加载**：使用 `loading="lazy"` 属性

## 浏览器支持

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 示例截图

### 桌面端
![Desktop View](https://via.placeholder.com/600x800?text=Desktop+View)

### 移动端
![Mobile View](https://via.placeholder.com/375x667?text=Mobile+View)

### 暗色模式
![Dark Mode](https://via.placeholder.com/600x800?text=Dark+Mode)

## 常见问题

### Q: 如何修改推文卡片的宽度？
A: 在 `TweetTimeline.css` 中修改 `.tweet-timeline` 的 `max-width`

### Q: 如何添加更多互动功能？
A: 在 `TweetCard.tsx` 中为按钮添加 `onClick` 事件处理

### Q: 如何自定义头像？
A: 修改 `getAvatar()` 函数的逻辑

## 许可证

MIT License

## 联系方式

如有问题，请联系：support@eagleswap.llc
