import express from 'express';
import newsFeedService from '../services/newsFeedService';

const router = express.Router();

/**
 * GET /api/news/latest
 * 获取最新新闻
 */
router.get('/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string;
    
    const news = newsFeedService.getLatestNews(limit, category);
    
    res.json({
      success: true,
      data: news,
      total: news.length
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch news'
    });
  }
});

/**
 * GET /api/news/article/:id
 * 获取单篇文章详情（自动爬取完整内容）
 */
router.get('/article/:id', async (req, res) => {
  try {
    const articleId = parseInt(req.params.id);
    
    let article: any = newsFeedService.getArticleById(articleId);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }
    
    // 如果内容较短，尝试爬取完整内容
    if (!article.content || article.content.length < 500) {
      await newsFeedService.updateArticleContent(articleId);
      // 重新获取更新后的文章
      article = newsFeedService.getArticleById(articleId);
    }
    
    res.json({
      success: true,
      data: article
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch article'
    });
  }
});

/**
 * GET /api/news/tweets
 * 获取Twitter推文
 */
router.get('/tweets', async (req, res) => {
  try {
    const username = req.query.username as string || 'cz_binance';
    const limit = parseInt(req.query.limit as string) || 10;
    
    const tweets = newsFeedService.getLatestTweets(username, limit);
    
    res.json({
      success: true,
      data: tweets,
      total: tweets.length
    });
  } catch (error) {
    console.error('Error fetching tweets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tweets'
    });
  }
});

/**
 * POST /api/news/fetch
 * 手动触发新闻采集（管理员功能）
 */
router.post('/fetch', async (req, res) => {
  try {
    const count = await newsFeedService.fetchAllRSS();
    
    res.json({
      success: true,
      message: `Fetched ${count} articles`,
      count
    });
  } catch (error) {
    console.error('Error fetching RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RSS feeds'
    });
  }
});

/**
 * GET /api/news/categories
 * 获取新闻分类统计
 */
router.get('/categories', async (req, res) => {
  try {
    // 这里可以添加分类统计逻辑
    res.json({
      success: true,
      data: [
        { name: 'market', label: '市场动态', count: 0 },
        { name: 'regulation', label: '监管政策', count: 0 },
        { name: 'technology', label: '技术创新', count: 0 },
        { name: 'defi', label: 'DeFi', count: 0 },
        { name: 'nft', label: 'NFT', count: 0 }
      ]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

export default router;
