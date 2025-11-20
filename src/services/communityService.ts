import { db } from '../database';
import crypto from 'crypto';

/**
 * 社区服务
 * 自动选举社区长 + 弹劾投票机制
 */
export class CommunityService {
  
  /**
   * 生成社区代码
   */
  private generateCommunityCode(communityName: string): string {
    const hash = crypto.createHash('sha256').update(communityName + Date.now()).digest('hex');
    return 'COM' + hash.substring(0, 8).toUpperCase();
  }
  
  /**
   * 创建社区
   */
  async createCommunity(params: {
    creatorAddress: string;
    communityName: string;
    description?: string;
    logoUrl?: string;
  }) {
    try {
      console.log(`🏘️ 创建社区: ${params.communityName}`);
      
      // 生成社区代码
      const communityCode = this.generateCommunityCode(params.communityName);
      
      // 创建社区
      const result = db.prepare(`
        INSERT INTO communities (community_name, leader_address, community_code, description, logo_url)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        params.communityName,
        params.creatorAddress,
        communityCode,
        params.description || '',
        params.logoUrl || ''
      );
      
      const communityId = result.lastInsertRowid as number;
      
      // 创建者自动加入社区
      await this.joinCommunity({
        memberAddress: params.creatorAddress,
        communityId
      });
      
      console.log(`✅ 社区创建成功: ${communityCode}`);
      
      return {
        success: true,
        data: {
          communityId,
          communityName: params.communityName,
          communityCode,
        }
      };
    } catch (error) {
      console.error('❌ 创建社区失败:', error);
      throw error;
    }
  }
  
  /**
   * 加入社区
   */
  async joinCommunity(params: {
    memberAddress: string;
    communityId: number;
  }) {
    try {
      console.log(`👤 加入社区: ${params.communityId}`);
      
      // 检查是否已在其他社区
      const existing = db.prepare(`
        SELECT community_id, joined_at 
        FROM community_members 
        WHERE member_address = ?
      `).get(params.memberAddress) as any;
      
      if (existing) {
        // 检查冷却期（7天）
        const joinedDate = new Date(existing.joined_at);
        const daysSince = Math.floor((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSince < 7) {
          throw new Error(`需要等待 ${7 - daysSince} 天才能更换社区`);
        }
        
        // 离开旧社区
        await this.leaveCommunity(params.memberAddress, existing.community_id);
      }
      
      // 计算用户节点价值
      const nodeValue = await this.calculateUserNodeValue(params.memberAddress);
      
      // 加入新社区
      db.prepare(`
        INSERT INTO community_members (community_id, member_address, node_value)
        VALUES (?, ?, ?)
      `).run(params.communityId, params.memberAddress, nodeValue);
      
      // 记录更换
      if (existing) {
        db.prepare(`
          INSERT INTO community_changes (member_address, old_community_id, new_community_id)
          VALUES (?, ?, ?)
        `).run(params.memberAddress, existing.community_id, params.communityId);
      }
      
      // 更新社区统计
      await this.updateCommunityStats(params.communityId);
      
      // 重新选举社区长
      await this.electCommunityLeader(params.communityId);
      
      console.log(`✅ 加入社区成功`);
      
      return {
        success: true,
        data: {
          communityId: params.communityId,
        }
      };
    } catch (error) {
      console.error('❌ 加入社区失败:', error);
      throw error;
    }
  }
  
  /**
   * 离开社区
   */
  private async leaveCommunity(memberAddress: string, communityId: number) {
    db.prepare(`
      DELETE FROM community_members 
      WHERE member_address = ? AND community_id = ?
    `).run(memberAddress, communityId);
    
    // 更新社区统计
    await this.updateCommunityStats(communityId);
    
    // 重新选举社区长
    await this.electCommunityLeader(communityId);
  }
  
  /**
   * 计算用户节点价值
   */
  private async calculateUserNodeValue(userAddress: string): Promise<number> {
    // 从 nodes 表查询用户的节点总价值
    const result = db.prepare(`
      SELECT COALESCE(SUM(price), 0) as total_value
      FROM nodes
      WHERE owner_address = ? AND status = 'active'
    `).get(userAddress) as any;
    
    return result?.total_value || 0;
  }
  
  /**
   * 自动选举社区长
   */
  private async electCommunityLeader(communityId: number) {
    // 查找节点价值最高的成员（排除被弹劾禁止的用户）
    const topMember = db.prepare(`
      SELECT member_address, node_value
      FROM community_members
      WHERE community_id = ?
      AND member_address NOT IN (
        SELECT leader_address 
        FROM impeachment_history 
        WHERE community_id = ? 
        AND ban_until > datetime('now')
      )
      ORDER BY node_value DESC
      LIMIT 1
    `).get(communityId, communityId) as any;
    
    if (!topMember) return;
    
    // 取消所有人的社区长身份
    db.prepare(`
      UPDATE community_members 
      SET is_leader = 0 
      WHERE community_id = ?
    `).run(communityId);
    
    // 设置新社区长
    db.prepare(`
      UPDATE community_members 
      SET is_leader = 1 
      WHERE community_id = ? AND member_address = ?
    `).run(communityId, topMember.member_address);
    
    // 更新社区表
    db.prepare(`
      UPDATE communities 
      SET leader_address = ? 
      WHERE id = ?
    `).run(topMember.member_address, communityId);
    
    console.log(`👑 新社区长: ${topMember.member_address} (节点价值: $${topMember.node_value})`);
  }
  
  /**
   * 更新社区统计
   */
  private async updateCommunityStats(communityId: number) {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_members,
        COALESCE(SUM(node_value), 0) as total_value
      FROM community_members
      WHERE community_id = ?
    `).get(communityId) as any;
    
    // 计算社区等级
    let level = 1;
    let bonusRate = 0;
    
    if (stats.total_value >= 50001) {
      level = 5;
      bonusRate = 0.20;
    } else if (stats.total_value >= 20001) {
      level = 4;
      bonusRate = 0.15;
    } else if (stats.total_value >= 5001) {
      level = 3;
      bonusRate = 0.10;
    } else if (stats.total_value >= 1001) {
      level = 2;
      bonusRate = 0.05;
    }
    
    // 更新社区
    db.prepare(`
      UPDATE communities 
      SET 
        total_members = ?,
        total_value = ?,
        community_level = ?,
        bonus_rate = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(stats.total_members, stats.total_value, level, bonusRate, communityId);
  }
  
  /**
   * 获取社区列表
   */
  getCommunityList(params: {
    limit?: number;
    offset?: number;
    sortBy?: 'value' | 'members' | 'level';
  }) {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    
    try {
      // Try to query communities table directly instead of leaderboard view
      const communities = db.prepare(`
        SELECT * FROM communities
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);
      
      const total = db.prepare(`
        SELECT COUNT(*) as count FROM communities
      `).get() as any;
      
      return {
        success: true,
        data: {
          communities,
          total: total.count,
          limit,
          offset
        }
      };
    } catch (error) {
      // If communities table doesn't exist, return empty list
      console.warn('Communities table not found, returning empty list');
      return {
        success: true,
        data: {
          communities: [],
          total: 0,
          limit,
          offset
        }
      };
    }
  }
  
  /**
   * 获取社区详情
   */
  getCommunityDetail(communityId: number) {
    let community;
    try {
      community = db.prepare(`
        SELECT * FROM communities WHERE id = ?
      `).get(communityId);
      
      if (!community) {
        throw new Error('社区不存在');
      }
    } catch (error) {
      throw new Error('社区不存在');
    }
    
    // 获取成员列表
    let members = [];
    try {
      members = db.prepare(`
        SELECT 
          member_address,
          node_value,
          is_leader,
          joined_at
        FROM community_members
        WHERE community_id = ?
        ORDER BY node_value DESC
      `).all(communityId);
    } catch (error) {
      // If table doesn't exist, return empty members list
      members = [];
    }
    
    return {
      success: true,
      data: {
        community,
        members
      }
    };
  }
  
  /**
   * 获取用户的社区
   */
  getUserCommunity(userAddress: string) {
    const member = db.prepare(`
      SELECT 
        cm.*,
        c.*
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.member_address = ?
    `).get(userAddress);
    
    return {
      success: true,
      data: member || null
    };
  }
  
  /**
   * 发起弹劾投票
   */
  async initiateImpeachment(params: {
    communityId: number;
    initiatorAddress: string;
    reason: string;
  }) {
    try {
      // 检查发起人是否是社区成员
      const member = db.prepare(`
        SELECT joined_at 
        FROM community_members 
        WHERE community_id = ? AND member_address = ?
      `).get(params.communityId, params.initiatorAddress) as any;
      
      if (!member) {
        throw new Error('必须是社区成员才能发起弹劾');
      }
      
      // 检查加入时间（必须超过7天）
      const joinedDate = new Date(member.joined_at);
      const daysSince = Math.floor((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSince < 7) {
        throw new Error('加入社区未满7天，无法发起弹劾');
      }
      
      // 检查是否有进行中的投票
      const activeVote = db.prepare(`
        SELECT id FROM impeachment_votes 
        WHERE community_id = ? AND status = 'active'
      `).get(params.communityId);
      
      if (activeVote) {
        throw new Error('已有进行中的弹劾投票');
      }
      
      // 获取当前社区长
      const community = db.prepare(`
        SELECT leader_address FROM communities WHERE id = ?
      `).get(params.communityId) as any;
      
      // 创建弹劾投票
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // 7天投票期
      
      const result = db.prepare(`
        INSERT INTO impeachment_votes 
        (community_id, target_leader_address, initiator_address, reason, end_date)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        params.communityId,
        community.leader_address,
        params.initiatorAddress,
        params.reason,
        endDate.toISOString()
      );
      
      console.log(`🗳️ 弹劾投票已发起，投票期至: ${endDate}`);
      
      return {
        success: true,
        data: {
          impeachmentId: result.lastInsertRowid,
          endDate
        }
      };
    } catch (error) {
      console.error('❌ 发起弹劾失败:', error);
      throw error;
    }
  }
  
  /**
   * 投票
   */
  async vote(params: {
    impeachmentId: number;
    voterAddress: string;
    voteFor: boolean;
  }) {
    try {
      // 获取投票信息
      const impeachment = db.prepare(`
        SELECT * FROM impeachment_votes WHERE id = ?
      `).get(params.impeachmentId) as any;
      
      if (!impeachment || impeachment.status !== 'active') {
        throw new Error('投票已结束');
      }
      
      // 检查投票期是否结束
      if (new Date() > new Date(impeachment.end_date)) {
        throw new Error('投票期已结束');
      }
      
      // 检查是否已投票
      const existing = db.prepare(`
        SELECT id FROM vote_records 
        WHERE impeachment_id = ? AND voter_address = ?
      `).get(params.impeachmentId, params.voterAddress);
      
      if (existing) {
        throw new Error('已经投过票了');
      }
      
      // 获取投票权重（节点价值）
      const member = db.prepare(`
        SELECT node_value 
        FROM community_members 
        WHERE community_id = ? AND member_address = ?
      `).get(impeachment.community_id, params.voterAddress) as any;
      
      if (!member) {
        throw new Error('不是社区成员，无法投票');
      }
      
      // 记录投票
      db.prepare(`
        INSERT INTO vote_records 
        (impeachment_id, voter_address, vote_weight, vote_for)
        VALUES (?, ?, ?, ?)
      `).run(params.impeachmentId, params.voterAddress, member.node_value, params.voteFor ? 1 : 0);
      
      // 更新投票统计
      if (params.voteFor) {
        db.prepare(`
          UPDATE impeachment_votes 
          SET total_votes_for = total_votes_for + ? 
          WHERE id = ?
        `).run(member.node_value, params.impeachmentId);
      } else {
        db.prepare(`
          UPDATE impeachment_votes 
          SET total_votes_against = total_votes_against + ? 
          WHERE id = ?
        `).run(member.node_value, params.impeachmentId);
      }
      
      console.log(`✅ 投票成功: ${params.voteFor ? '赞成' : '反对'}, 权重: ${member.node_value}`);
      
      return {
        success: true,
        data: {
          voteWeight: member.node_value
        }
      };
    } catch (error) {
      console.error('❌ 投票失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取投票详情
   */
  getImpeachmentDetail(impeachmentId: number) {
    const impeachment = db.prepare(`
      SELECT * FROM impeachment_votes WHERE id = ?
    `).get(impeachmentId);
    
    if (!impeachment) {
      throw new Error('投票不存在');
    }
    
    // 获取投票记录
    const votes = db.prepare(`
      SELECT * FROM vote_records 
      WHERE impeachment_id = ?
      ORDER BY voted_at DESC
    `).all(impeachmentId);
    
    return {
      success: true,
      data: {
        impeachment,
        votes
      }
    };
  }
  
  /**
   * 结算投票（定时任务调用）
   */
  async finalizeImpeachment(impeachmentId: number) {
    const impeachment = db.prepare(`
      SELECT * FROM impeachment_votes WHERE id = ?
    `).get(impeachmentId) as any;
    
    if (!impeachment || impeachment.status !== 'active') {
      return;
    }
    
    // 检查投票期是否结束
    if (new Date() < new Date(impeachment.end_date)) {
      return; // 投票期未结束
    }
    
    // 计算总票数
    const totalVotes = impeachment.total_votes_for + impeachment.total_votes_against;
    
    // 判断是否通过（赞成票 > 50%）
    const passed = impeachment.total_votes_for > (totalVotes * 0.5);
    
    if (passed) {
      // 弹劾成功
      db.prepare(`
        UPDATE impeachment_votes 
        SET status = 'passed' 
        WHERE id = ?
      `).run(impeachmentId);
      
      // 记录弹劾历史
      const banUntil = new Date();
      banUntil.setDate(banUntil.getDate() + 30); // 30天禁止期
      
      db.prepare(`
        INSERT INTO impeachment_history 
        (community_id, leader_address, impeachment_id, ban_until)
        VALUES (?, ?, ?, ?)
      `).run(
        impeachment.community_id,
        impeachment.target_leader_address,
        impeachmentId,
        banUntil.toISOString()
      );
      
      // 重新选举社区长
      await this.electCommunityLeader(impeachment.community_id);
      
      console.log(`✅ 弹劾成功！新社区长已选举`);
    } else {
      // 弹劾失败
      db.prepare(`
        UPDATE impeachment_votes 
        SET status = 'failed' 
        WHERE id = ?
      `).run(impeachmentId);
      
      console.log(`❌ 弹劾失败`);
    }
  }
}

export const communityService = new CommunityService();
