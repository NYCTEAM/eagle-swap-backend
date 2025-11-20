import { Router } from 'express';
import { communityService } from '../services/communityService';

const router = Router();

/**
 * POST /api/community/create
 * 创建社区
 */
router.post('/create', async (req, res) => {
  try {
    const { creatorAddress, communityName, description, logoUrl } = req.body;
    
    if (!creatorAddress || !communityName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }
    
    const result = await communityService.createCommunity({
      creatorAddress,
      communityName,
      description,
      logoUrl
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error creating community:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create community',
    });
  }
});

/**
 * POST /api/community/join
 * 加入社区
 */
router.post('/join', async (req, res) => {
  try {
    const { memberAddress, communityId } = req.body;
    
    if (!memberAddress || !communityId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }
    
    const result = await communityService.joinCommunity({
      memberAddress,
      communityId: parseInt(communityId)
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error joining community:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to join community',
    });
  }
});

/**
 * GET /api/community/list
 * 获取社区列表
 */
router.get('/list', async (req, res) => {
  try {
    const { limit, offset, sortBy } = req.query;
    
    const result = communityService.getCommunityList({
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      sortBy: sortBy as any
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching community list:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch community list',
    });
  }
});

/**
 * GET /api/community/leaderboard
 * 获取社区排行榜
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit } = req.query;
    
    // Return empty leaderboard for now (community system not fully implemented)
    res.json({
      success: true,
      data: {
        communities: [],
        total: 0,
        limit: limit ? parseInt(limit as string) : 10,
        offset: 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching community leaderboard:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch community leaderboard',
    });
  }
});

/**
 * GET /api/community/:id
 * 获取社区详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = communityService.getCommunityDetail(parseInt(id));
    
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching community detail:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch community detail',
    });
  }
});

/**
 * GET /api/community/user/:address
 * 获取用户的社区
 */
router.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const result = communityService.getUserCommunity(address);
    
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching user community:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user community',
    });
  }
});

/**
 * POST /api/community/impeachment/initiate
 * 发起弹劾投票
 */
router.post('/impeachment/initiate', async (req, res) => {
  try {
    const { communityId, initiatorAddress, reason } = req.body;
    
    if (!communityId || !initiatorAddress || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }
    
    const result = await communityService.initiateImpeachment({
      communityId: parseInt(communityId),
      initiatorAddress,
      reason
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error initiating impeachment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate impeachment',
    });
  }
});

/**
 * POST /api/community/impeachment/vote
 * 投票
 */
router.post('/impeachment/vote', async (req, res) => {
  try {
    const { impeachmentId, voterAddress, voteFor } = req.body;
    
    if (!impeachmentId || !voterAddress || voteFor === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }
    
    const result = await communityService.vote({
      impeachmentId: parseInt(impeachmentId),
      voterAddress,
      voteFor: Boolean(voteFor)
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error voting:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to vote',
    });
  }
});

/**
 * GET /api/community/impeachment/:id
 * 获取投票详情
 */
router.get('/impeachment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = communityService.getImpeachmentDetail(parseInt(id));
    
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching impeachment detail:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch impeachment detail',
    });
  }
});

export default router;
