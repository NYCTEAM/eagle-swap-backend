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
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/eagleswap.db');
    const db = new Database(dbPath);
    
    const communities = db.prepare(`
      SELECT 
        c.id,
        c.community_name,
        c.community_code,
        c.leader_address,
        c.total_members,
        c.community_level,
        c.total_node_value as total_value,
        c.status,
        COALESCE(clc.level_name, 'Bronze') as level_name,
        COALESCE(clc.member_bonus_rate, 5) as bonus_rate
      FROM communities c
      LEFT JOIN community_level_config clc ON c.community_level = clc.level
      WHERE c.status = 'active'
      ORDER BY c.total_node_value DESC, c.total_members DESC
      LIMIT ?
    `).all(limit ? parseInt(limit as string) : 10);
    
    db.close();
    
    res.json({
      success: true,
      data: communities
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
 * GET /api/community/:id/members
 * 获取社区成员列表（包含 NFT 信息）
 */
router.get('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/eagleswap.db');
    const db = new Database(dbPath);
    
    // 获取社区成员及其 NFT 信息
    const members = db.prepare(`
      SELECT 
        cm.member_address,
        cm.is_leader,
        cm.joined_at,
        cm.node_value,
        COUNT(nh.token_id) as nft_count,
        MAX(nh.level) as highest_nft_level,
        COALESCE(
          (SELECT nls.level_name FROM nft_level_stats nls WHERE nls.level = MAX(nh.level)),
          'None'
        ) as highest_nft_name,
        COALESCE(SUM(nls.weight), 0) as total_nft_weight
      FROM community_members cm
      LEFT JOIN nft_holders nh ON LOWER(cm.member_address) = LOWER(nh.owner_address)
      LEFT JOIN nft_level_stats nls ON nh.level = nls.level
      WHERE cm.community_id = ?
      GROUP BY cm.member_address
      ORDER BY cm.is_leader DESC, total_nft_weight DESC, cm.joined_at ASC
    `).all(id);
    
    // 获取社区信息
    const community = db.prepare(`
      SELECT 
        c.*,
        COALESCE(clc.level_name, 'Bronze') as level_name,
        COALESCE(clc.member_bonus_rate, 5) as member_bonus_rate,
        COALESCE(clc.leader_bonus_rate, 10) as leader_bonus_rate
      FROM communities c
      LEFT JOIN community_level_config clc ON c.community_level = clc.level
      WHERE c.id = ?
    `).get(id);
    
    db.close();
    
    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        community,
        members,
        total_members: members.length
      }
    });
  } catch (error: any) {
    console.error('Error fetching community members:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch community members',
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
