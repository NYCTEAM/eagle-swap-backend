import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';

const router = Router();
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/eagleswap.db');

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
      SELECT 1 FROM community_creation_requests WHERE community_code = ? AND status = 'pending'
    `).get(communityCode, communityCode);

    if (existingCode) {
      db.close();
      return res.status(400).json({
        success: false,
        error: 'Community code already exists or has a pending request'
      });
    }

    // 检查社区名称是否已存在
    const existingName = db.prepare(`
      SELECT 1 FROM communities WHERE community_name = ?
      UNION
      SELECT 1 FROM community_creation_requests WHERE community_name = ? AND status = 'pending'
    `).get(communityName, communityName);

    if (existingName) {
      db.close();
      return res.status(400).json({
        success: false,
        error: 'Community name already exists or has a pending request'
      });
    }

    // 检查用户是否已有 pending 的申请
    const existingPending = db.prepare(`
      SELECT 1 FROM community_creation_requests 
      WHERE LOWER(creator_address) = LOWER(?) AND status = 'pending'
    `).get(creatorAddress);

    if (existingPending) {
      db.close();
      return res.status(400).json({
        success: false,
        error: 'You already have a pending community creation request'
      });
    }

    // 如果是 NFT 持有者创建，检查是否持有顶级 NFT (Level 6 Platinum 或 Level 7 Diamond)
    if (creationType === 'nft_holder') {
      const hasPremiumNFT = db.prepare(`
        SELECT 1 FROM nft_holders 
        WHERE LOWER(owner_address) = LOWER(?) AND level >= 6
      `).get(creatorAddress);

      if (!hasPremiumNFT) {
        db.close();
        return res.status(400).json({
          success: false,
          error: 'You need to hold a Platinum (Level 6) or Diamond (Level 7) NFT to create a community directly'
        });
      }
    }

    // 如果是投票创建，检查是否持有任何 NFT
    if (creationType === 'voting') {
      const hasNFT = db.prepare(`
        SELECT 1 FROM nft_holders WHERE LOWER(owner_address) = LOWER(?)
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

    const requestId = result.lastInsertRowid;

    // 如果是 NFT 持有者直接创建，立即创建社区
    if (creationType === 'nft_holder') {
      // 生成唯一的 community_id
      const communityId = `COMM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 更新申请状态为 approved
      db.prepare(`
        UPDATE community_creation_requests 
        SET status = 'approved', approved_at = datetime('now'), completed_at = datetime('now')
        WHERE id = ?
      `).run(requestId);

      // 创建社区
      const communityResult = db.prepare(`
        INSERT INTO communities (
          community_id, community_name, community_code, leader_address, total_members, community_level, total_node_value, status
        ) VALUES (?, ?, ?, ?, 1, 1, 0, 'active')
      `).run(communityId, communityName, communityCode, creatorAddress);

      // 将创建者加入社区作为社区长（使用 communityId 而不是 lastInsertRowid）
      db.prepare(`
        INSERT INTO community_members (community_id, member_address, is_leader, joined_at)
        VALUES (?, ?, 1, datetime('now'))
      `).run(communityId, creatorAddress);

      console.log(`✅ 社区 "${communityName}" 由NFT持有者直接创建成功 (ID: ${communityId})`);
    }

    // 获取创建的申请详情
    const request = db.prepare(`
      SELECT * FROM community_creation_requests_view WHERE id = ?
    `).get(requestId);

    db.close();

    res.json({
      success: true,
      data: request,
      message: creationType === 'nft_holder' ? 'Community created successfully!' : 'Request created successfully!'
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

    // 检查用户是否持有 NFT，并获取投票权重
    const userNFT = db.prepare(`
      SELECT nh.level, COALESCE(ntp.vote_weight, nh.level) as vote_weight
      FROM nft_holders nh
      LEFT JOIN nft_tier_privileges ntp ON nh.level = ntp.tier_id
      WHERE LOWER(nh.owner_address) = LOWER(?)
      ORDER BY nh.level DESC
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

    // 更新申请的当前票数
    db.prepare(`
      UPDATE community_creation_requests 
      SET current_votes = (
        SELECT COALESCE(SUM(vote_weight), 0) FROM community_creation_votes WHERE request_id = ?
      )
      WHERE id = ?
    `).run(requestId, requestId);

    // 检查是否达到所需票数，如果达到则自动创建社区
    const updatedReq = db.prepare(`
      SELECT * FROM community_creation_requests WHERE id = ?
    `).get(requestId) as any;

    if (updatedReq && updatedReq.current_votes >= updatedReq.required_votes) {
      // 生成唯一的 community_id
      const communityId = `COMM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 更新申请状态为 approved
      db.prepare(`
        UPDATE community_creation_requests 
        SET status = 'approved', approved_at = datetime('now'), completed_at = datetime('now')
        WHERE id = ?
      `).run(requestId);

      // 创建社区
      const communityResult = db.prepare(`
        INSERT INTO communities (
          community_id, community_name, community_code, leader_address, total_members, community_level, total_node_value, status
        ) VALUES (?, ?, ?, ?, 1, 1, 0, 'active')
      `).run(communityId, updatedReq.community_name, updatedReq.community_code, updatedReq.creator_address);

      // 将创建者加入社区作为社区长（使用 communityId 而不是 lastInsertRowid）
      db.prepare(`
        INSERT INTO community_members (community_id, member_address, is_leader, joined_at)
        VALUES (?, ?, 1, datetime('now'))
      `).run(communityId, updatedReq.creator_address);

      console.log(`✅ 社区 "${updatedReq.community_name}" 投票通过，已自动创建 (ID: ${communityId})`);
    }

    // 获取更新后的申请详情
    const finalRequest = db.prepare(`
      SELECT * FROM community_creation_requests_view WHERE id = ?
    `).get(requestId);

    db.close();

    res.json({
      success: true,
      data: finalRequest,
      message: updatedReq && updatedReq.current_votes >= updatedReq.required_votes 
        ? 'Vote successful! Community has been created!' 
        : 'Vote successful!'
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
        nls.level_name as nft_name
      FROM community_creation_votes ccv
      LEFT JOIN nft_holders nh ON LOWER(ccv.voter_address) = LOWER(nh.owner_address)
      LEFT JOIN nft_level_stats nls ON nh.level = nls.level
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
// 6. 检查社区名称是否已存在
// ============================================
router.get('/check-name', async (req: Request, res: Response) => {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Name is required'
    });
  }

  const db = getDb();

  try {
    const existing = db.prepare(`
      SELECT 1 FROM communities WHERE LOWER(community_name) = LOWER(?)
      UNION
      SELECT 1 FROM community_creation_requests WHERE LOWER(community_name) = LOWER(?) AND status = 'pending'
    `).get(name, name);

    db.close();

    res.json({
      success: true,
      exists: !!existing
    });
  } catch (error: any) {
    db.close();
    console.error('Check name error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 7. 检查社区代码是否已存在
// ============================================
router.get('/check-code', async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Code is required'
    });
  }

  const db = getDb();

  try {
    const existing = db.prepare(`
      SELECT 1 FROM communities WHERE LOWER(community_code) = LOWER(?)
      UNION
      SELECT 1 FROM community_creation_requests WHERE LOWER(community_code) = LOWER(?) AND status = 'pending'
    `).get(code, code);

    db.close();

    res.json({
      success: true,
      exists: !!existing
    });
  } catch (error: any) {
    db.close();
    console.error('Check code error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 8. 检查用户是否可以创建社区
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

    // 检查是否持有顶级 NFT (Level 6 Platinum 或 Level 7 Diamond)
    const hasPremiumNFT = db.prepare(`
      SELECT 1 FROM nft_holders 
      WHERE LOWER(owner_address) = LOWER(?) AND level >= 6
    `).get(address);

    // 检查是否持有任何 NFT
    const hasAnyNFT = db.prepare(`
      SELECT 1 FROM nft_holders WHERE LOWER(owner_address) = LOWER(?)
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
