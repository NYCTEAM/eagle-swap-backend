import express from 'express';
import twitterMonitorService from '../services/twitterMonitorService';

const router = express.Router();

/**
 * POST /api/twitter/follow
 * 用户添加关注的Twitter账号
 */
router.post('/follow', async (req, res) => {
  try {
    const { userAddress, twitterUsername, displayName } = req.body;
    
    if (!userAddress || !twitterUsername) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const result = twitterMonitorService.addTwitterFollow(
      userAddress,
      twitterUsername,
      displayName
    );
    
    if (result.success) {
      // 立即抓取该账号的最新推文
      console.log(`🐦 Immediately fetching tweets for @${twitterUsername}...`);
      
      twitterMonitorService.fetchTweetsFromNitter(twitterUsername.replace('@', ''))
        .then(tweets => {
          const saved = twitterMonitorService.saveTweets(tweets);
          console.log(`✅ Fetched and saved ${saved} tweets for @${twitterUsername}`);
        })
        .catch(err => {
          console.error(`❌ Failed to fetch tweets for @${twitterUsername}:`, err);
        });
      
      // 立即返回成功，不等待抓取完成
      res.json({
        success: true,
        message: `Added @${twitterUsername}, fetching latest tweets...`
      });
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Error adding Twitter follow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add Twitter follow'
    });
  }
});

/**
 * GET /api/twitter/follows/:userAddress
 * 获取用户关注的Twitter账号列表
 */
router.get('/follows/:userAddress', async (req, res) => {
  try {
    const { userAddress } = req.params;
    const follows = twitterMonitorService.getUserFollows(userAddress);
    
    res.json({
      success: true,
      data: follows
    });
  } catch (error) {
    console.error('Error fetching follows:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch follows'
    });
  }
});

/**
 * DELETE /api/twitter/follow
 * 移除关注
 */
router.delete('/follow', async (req, res) => {
  try {
    const { userAddress, twitterUsername } = req.body;
    
    if (!userAddress || !twitterUsername) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const result = twitterMonitorService.removeTwitterFollow(userAddress, twitterUsername);
    
    res.json(result);
  } catch (error) {
    console.error('Error removing follow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove follow'
    });
  }
});

/**
 * GET /api/twitter/timeline/:userAddress
 * 获取用户关注账号的推文时间线
 */
router.get('/timeline/:userAddress', async (req, res) => {
  try {
    const { userAddress } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const tweets = twitterMonitorService.getUserTimelineTweets(userAddress, limit);
    
    res.json({
      success: true,
      data: tweets
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timeline'
    });
  }
});

/**
 * GET /api/twitter/account/:username
 * 获取特定账号的推文
 */
router.get('/account/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const tweets = twitterMonitorService.getAccountTweets(username, limit);
    
    res.json({
      success: true,
      data: tweets
    });
  } catch (error) {
    console.error('Error fetching account tweets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tweets'
    });
  }
});

/**
 * GET /api/twitter/all
 * 获取所有推文（公共时间线）
 */
router.get('/all', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const tweets = twitterMonitorService.getAllTweets(limit);
    
    res.json({
      success: true,
      data: tweets
    });
  } catch (error) {
    console.error('Error fetching all tweets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tweets'
    });
  }
});

/**
 * POST /api/twitter/monitor
 * 手动触发监控（管理员功能）
 */
router.post('/monitor', async (req, res) => {
  try {
    const newTweets = await twitterMonitorService.monitorAllFollows();
    
    res.json({
      success: true,
      message: `Monitored and saved ${newTweets} new tweets`
    });
  } catch (error) {
    console.error('Error monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to monitor'
    });
  }
});

export default router;
