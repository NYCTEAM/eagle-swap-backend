import { Router } from 'express';
import { getDb } from '../database';

const router = Router();
const db = getDb();

// ============================================
// 仪表盘统计
// ============================================
router.get('/dashboard/stats', (req, res) => {
  try {
    // 总用户数
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    
    // 总节点数
    const totalNodes = db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
    
    // 总社区数
    const totalCommunities = db.prepare('SELECT COUNT(*) as count FROM communities').get() as { count: number };
    
    // 总收入
    const totalRevenue = db.prepare('SELECT COALESCE(SUM(total_revenue), 0) as total FROM platform_revenue').get() as { total: number };
    
    // 今日收入
    const todayRevenue = db.prepare(`
      SELECT COALESCE(total_revenue, 0) as total 
      FROM platform_revenue 
      WHERE revenue_date = DATE('now')
    `).get() as { total: number } || { total: 0 };
    
    // 今日新增用户
    const todayNewUsers = db.prepare(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE DATE(created_at) = DATE('now')
    `).get() as { count: number };
    
    // 今日活跃用户（有交易）
    const todayActiveUsers = db.prepare(`
      SELECT COUNT(DISTINCT user_address) as count 
      FROM swap_transactions 
      WHERE DATE(created_at) = DATE('now')
    `).get() as { count: number };
    
    // 今日 SWAP 交易量
    const todaySwapVolume = db.prepare(`
      SELECT COALESCE(SUM(amount_in), 0) as volume 
      FROM swap_transactions 
      WHERE DATE(created_at) = DATE('now')
    `).get() as { volume: number };

    res.json({
      totalUsers: totalUsers.count,
      totalNodes: totalNodes.count,
      totalCommunities: totalCommunities.count,
      totalRevenue: totalRevenue.total,
      todayRevenue: todayRevenue.total,
      todayNewUsers: todayNewUsers.count,
      todayActiveUsers: todayActiveUsers.count,
      todaySwapVolume: todaySwapVolume.volume,
    });
  } catch (error) {
    console.error('获取仪表盘统计失败:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// ============================================
// 用户管理
// ============================================
router.get('/users', (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM admin_users_overview';
    let countQuery = 'SELECT COUNT(*) as count FROM admin_users_overview';
    
    if (search) {
      const searchCondition = ` WHERE wallet_address LIKE '%${search}%'`;
      query += searchCondition;
      countQuery += searchCondition;
    }
    
    query += ` LIMIT ${limit} OFFSET ${offset}`;

    const users = db.prepare(query).all();
    const total = db.prepare(countQuery).get() as { count: number };
    const totalPages = Math.ceil(total.count / limit);

    res.json({
      users,
      currentPage: page,
      totalPages,
      totalUsers: total.count,
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// ============================================
// 社区管理
// ============================================
router.get('/communities', (req, res) => {
  try {
    const communities = db.prepare('SELECT * FROM admin_communities_overview').all();
    res.json({ communities });
  } catch (error) {
    console.error('获取社区列表失败:', error);
    res.status(500).json({ error: '获取社区列表失败' });
  }
});

// 创建社区
router.post('/communities', (req, res) => {
  try {
    const { community_name, leader_address, description } = req.body;
    
    // 生成社区代码
    const community_code = `COM${Date.now()}`;
    
    const result = db.prepare(`
      INSERT INTO communities (community_name, leader_address, community_code, description)
      VALUES (?, ?, ?, ?)
    `).run(community_name, leader_address, community_code, description);

    // 记录操作日志
    db.prepare(`
      INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(1, 'create_community', 'community', result.lastInsertRowid, JSON.stringify({ community_name, leader_address }));

    res.json({ success: true, communityId: result.lastInsertRowid });
  } catch (error) {
    console.error('创建社区失败:', error);
    res.status(500).json({ error: '创建社区失败' });
  }
});

// 更换社区长
router.post('/communities/:id/change-leader', (req, res) => {
  try {
    const { id } = req.params;
    const { new_leader_address, reason } = req.body;
    
    // 获取旧社区长
    const community = db.prepare('SELECT leader_address FROM communities WHERE id = ?').get(id) as { leader_address: string };
    
    // 更新社区长
    db.prepare(`
      UPDATE communities 
      SET leader_address = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(new_leader_address, id);
    
    // 更新成员表
    db.prepare('UPDATE community_members SET is_leader = 0 WHERE community_id = ?').run(id);
    db.prepare(`
      UPDATE community_members 
      SET is_leader = 1 
      WHERE community_id = ? AND member_address = ?
    `).run(id, new_leader_address);
    
    // 记录操作日志
    db.prepare(`
      INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(1, 'change_community_leader', 'community', id, JSON.stringify({
      old_leader: community.leader_address,
      new_leader: new_leader_address,
      reason
    }));

    res.json({ success: true });
  } catch (error) {
    console.error('更换社区长失败:', error);
    res.status(500).json({ error: '更换社区长失败' });
  }
});

// ============================================
// 收入统计
// ============================================
router.get('/revenue', (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    const revenue = db.prepare(`
      SELECT * FROM admin_revenue_overview 
      WHERE revenue_date >= DATE('now', '-${days} days')
      ORDER BY revenue_date DESC
    `).all();

    res.json({ revenue });
  } catch (error) {
    console.error('获取收入统计失败:', error);
    res.status(500).json({ error: '获取收入统计失败' });
  }
});

// ============================================
// 节点统计
// ============================================
router.get('/nodes/stats', (req, res) => {
  try {
    const stats = db.prepare('SELECT * FROM admin_node_sales_stats').all();
    res.json({ stats });
  } catch (error) {
    console.error('获取节点统计失败:', error);
    res.status(500).json({ error: '获取节点统计失败' });
  }
});

// ============================================
// SWAP 统计
// ============================================
router.get('/swap/stats', (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    const stats = db.prepare(`
      SELECT * FROM admin_swap_stats 
      LIMIT ${days}
    `).all();

    res.json({ stats });
  } catch (error) {
    console.error('获取 SWAP 统计失败:', error);
    res.status(500).json({ error: '获取 SWAP 统计失败' });
  }
});

// ============================================
// 操作日志
// ============================================
router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    
    const logs = db.prepare(`
      SELECT 
        al.*,
        a.username
      FROM admin_logs al
      JOIN admins a ON al.admin_id = a.id
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `).all();

    res.json({ logs });
  } catch (error) {
    console.error('获取操作日志失败:', error);
    res.status(500).json({ error: '获取操作日志失败' });
  }
});

export default router;
