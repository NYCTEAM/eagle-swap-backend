import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';

const router = Router();
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/eagle-swap.db');

// 获取数据库连接
function getDb() {
  return new Database(dbPath);
}

// ============================================
// 1. 创建社区申请
// ============================================
router.post('/create-request', async (req: Request, res: Response) => {
  const { creatorAddress, communityName, communityCode, description, logoUrl, creationType } = req.body;

  if (!creatorAddress || !communityName || !communityCode || !creationType) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }

  const db = getDb();

  try {
    // 检查用户是否已经在社区中
    const existingMember = db.prepare(`
      SELECT 1 FROM community_members WHERE member_address = ?
    `).get(creatorAddress);

    if (existingMember) {
      db.close();
      return res.status(400).json({
        success: false,
        error: 'You are already in a community'
      });
    }

    // 检查社区代码是否已存在
    const existingCode = db.prepare(`
      SELECT 1 FROM communities WHERE community_code = ?
      UNION
      SELECT 1 FROM community_creation_requests WHERE community_code = ? AND status != 'rejected'
    `).get(communityCode, communityCode);

    if (existingCode) {
      db.close();
      return res.status(400).json({
        success: false,
        error: 'Community code already exists'
      });
    }

    // 如果是 NFT 持有者创建，检查是否持有顶级 NFT
    if (creationType === 'nft_holder') {
      const hasPremiumNFT = db.prepare(`
        SELECT 1 FROM nodes n
        JOIN nft_tier_privileges ntp ON n.level = ntp.tier_id
        WHERE n.owner_address = ? AND ntp.can_create_community = 1
      `).get(creatorAddress);

      if (!hasPremiumNFT) {
        db.close();
        return res.status(400).json({
          success: false,
          error: 'You need to hold a Platinum or Diamond Node to create a community directly'
        });
      }
    }

    // 如果是投票创建，检查是否持有 NFT
    if (creationType === 'voting') {
      const hasNFT = db.prepare(`
        SELECT 1 FROM nodes WHERE owner_address = ?
      `).get(creatorAddress);

      if (!hasNFT) {
        db.close();
        return res.status(400).json({
          success: false,
          error: 'You need to hold at least one NFT to create a voting request'
        });
      }
    }

    // 创建申请
    const result = db.prepare(`
      INSERT INTO community_creation_requests (
        creator_address, community_name, community_code, description, logo_url, creation_type
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(creatorAddress, communityName, communityCode, description, logoUrl, creationType);

    // 获取创建的申请详情
    const request = db.prepare(`
      SELECT * FROM community_creation_requests_view WHERE id = ?
    `).get(result.lastInsertRowid);

    db.close();

    res.json({
      success: true,
      data: request
    });
  } catch (error: any) {
    db.close();
    console.error('Create request error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 2. 为申请投票
// ============================================
router.post('/vote', async (req: Request, res: Response) => {
  const { requestId, voterAddress } = req.body;

  if (!requestId || !voterAddress) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }

  const db = getDb();

  try {
    // 检查申请是否存在且状态为 pending
    const request = db.prepare(`
      SELECT * FROM community_creation_requests WHERE id = ? AND status = 'pending'
    `).get(requestId);

    if (!request) {
      db.close();
      return res.status(404).json({
        success: false,
        error: 'Request not found or already processed'
      });
    }

    // 检查用户是否持有 NFT
    const userNFT = db.prepare(`
      SELECT n.level, ntp.vote_weight
      FROM nodes n
      JOIN nft_tier_privileges ntp ON n.level = ntp.tier_id
      WHERE n.owner_address = ?
      ORDER BY ntp.vote_weight DESC
      LIMIT 1
    `).get(voterAddress) as { level: number; vote_weight: number } | undefined;

    if (!userNFT) {
      db.close();
      return res.status(400).json({
        success: false,
        error: 'You need to hold at least one NFT to vote'
      });
    }

    // 检查用户是否已加入社区
    const inCommunity = db.prepare(`
      SELECT 1 FROM community_members WHERE member_address = ?
    `).get(voterAddress);

    if (inCommunity) {
      db.close();
      return res.status(400).json({
        success: false,
        error: 'You are already in a community and cannot vote'
      });
    }

    // 检查是否已投票
    const existingVote = db.prepare(`
      SELECT 1 FROM community_creation_votes WHERE request_id = ? AND voter_address = ?
    `).get(requestId, voterAddress);

    if (existingVote) {
      db.close();
      return res.status(400).json({
        success: false,
        error: 'You have already voted for this request'
      });
    }

    // 投票
    db.prepare(`
      INSERT INTO community_creation_votes (request_id, voter_address, vote_weight)
      VALUES (?, ?, ?)
    `).run(requestId, voterAddress, userNFT.vote_weight);

    // 获取更新后的申请详情
    const updatedRequest = db.prepare(`
      SELECT * FROM community_creation_requests_view WHERE id = ?
    `).get(requestId);

    db.close();

    res.json({
      success: true,
      data: updatedRequest
    });
  } catch (error: any) {
    db.close();
    console.error('Vote error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 3. 获取所有待投票的申请
// ============================================
router.get('/pending-requests', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const requests = db.prepare(`
      SELECT * FROM community_creation_requests_view
      WHERE status = 'pending' AND creation_type = 'voting'
      ORDER BY created_at DESC
    `).all();

    db.close();

    res.json({
      success: true,
      data: requests
    });
  } catch (error: any) {
    db.close();
    console.error('Get pending requests error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 4. 获取用户的申请
// ============================================
router.get('/user-requests/:address', async (req: Request, res: Response) => {
  const { address } = req.params;

  const db = getDb();

  try {
    const requests = db.prepare(`
      SELECT * FROM community_creation_requests_view
      WHERE creator_address = ?
      ORDER BY created_at DESC
    `).all(address);

    db.close();

    res.json({
      success: true,
      data: requests
    });
  } catch (error: any) {
    db.close();
    console.error('Get user requests error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 5. 获取申请详情（包括投票者列表）
// ============================================
router.get('/request/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const db = getDb();

  try {
    const request = db.prepare(`
      SELECT * FROM community_creation_requests_view WHERE id = ?
    `).get(id);

    if (!request) {
      db.close();
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    // 获取投票者列表
    const voters = db.prepare(`
      SELECT 
        ccv.voter_address,
        ccv.vote_weight,
        ccv.voted_at,
        nl.name as nft_name
      FROM community_creation_votes ccv
      LEFT JOIN nodes n ON ccv.voter_address = n.owner_address
      LEFT JOIN node_levels nl ON n.level = nl.id
      WHERE ccv.request_id = ?
      ORDER BY ccv.voted_at DESC
    `).all(id);

    db.close();

    res.json({
      success: true,
      data: {
        ...request,
        voters
      }
    });
  } catch (error: any) {
    db.close();
    console.error('Get request details error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 6. 检查用户是否可以创建社区
// ============================================
router.get('/can-create/:address', async (req: Request, res: Response) => {
  const { address } = req.params;

  const db = getDb();

  try {
    // 检查是否已在社区中
    const inCommunity = db.prepare(`
      SELECT 1 FROM community_members WHERE member_address = ?
    `).get(address);

    if (inCommunity) {
      db.close();
      return res.json({
        success: true,
        data: {
          canCreate: false,
          reason: 'already_in_community',
          canCreateDirect: false,
          canCreateVoting: false
        }
      });
    }

    // 检查是否持有顶级 NFT
    const hasPremiumNFT = db.prepare(`
      SELECT 1 FROM nodes n
      JOIN nft_tier_privileges ntp ON n.level = ntp.tier_id
      WHERE n.owner_address = ? AND ntp.can_create_community = 1
    `).get(address);

    // 检查是否持有任何 NFT
    const hasAnyNFT = db.prepare(`
      SELECT 1 FROM nodes WHERE owner_address = ?
    `).get(address);

    db.close();

    res.json({
      success: true,
      data: {
        canCreate: !!hasPremiumNFT || !!hasAnyNFT,
        canCreateDirect: !!hasPremiumNFT,
        canCreateVoting: !!hasAnyNFT,
        reason: hasPremiumNFT ? 'has_premium_nft' : hasAnyNFT ? 'has_nft' : 'no_nft'
      }
    });
  } catch (error: any) {
    db.close();
    console.error('Check can create error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
