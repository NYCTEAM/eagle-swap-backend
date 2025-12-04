/**
 * NFT 全局 Token ID 管理服务
 * 负责分配和管理跨链唯一的 Token ID (1-13900)
 */

import { db } from '../database/index.js';

export class NFTTokenManager {
  private static readonly MAX_TOKEN_ID = 13900;
  private static readonly RESERVATION_DURATION = 1800; // 30分钟

  /**
   * 获取下一个可用的全局 Token ID
   */
  static getNextAvailableTokenId(): number {
    const stats = db.prepare('SELECT last_token_id FROM nft_global_stats WHERE id = 1').get() as any;
    
    if (!stats) {
      throw new Error('Global stats not initialized');
    }

    let nextId = stats.last_token_id + 1;

    // 检查是否超过最大值
    if (nextId > this.MAX_TOKEN_ID) {
      throw new Error('All NFTs have been minted (13900/13900)');
    }

    // 检查该 ID 是否已被使用或预留
    while (nextId <= this.MAX_TOKEN_ID) {
      const existing = db.prepare(`
        SELECT global_token_id FROM nft_global_token_allocation 
        WHERE global_token_id = ?
      `).get(nextId);

      if (!existing) {
        return nextId;
      }

      nextId++;
    }

    throw new Error('No available Token IDs');
  }

  /**
   * 预留 Token ID
   */
  static reserveTokenId(params: {
    globalTokenId: number;
    userAddress: string;
    level: number;
    chainId: number;
    chainName: string;
    contractAddress: string;
  }): void {
    const { globalTokenId, userAddress, level, chainId, chainName, contractAddress } = params;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + this.RESERVATION_DURATION;

    // 清理过期的预留
    this.cleanExpiredReservations();

    // 检查是否已被预留
    const existing = db.prepare(`
      SELECT * FROM nft_token_reservations 
      WHERE global_token_id = ? AND status = 'active'
    `).get(globalTokenId);

    if (existing) {
      throw new Error(`Token ID ${globalTokenId} is already reserved`);
    }

    // 创建预留记录
    db.prepare(`
      INSERT INTO nft_token_reservations 
      (global_token_id, user_address, level, chain_id, reserved_at, expires_at, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(globalTokenId, userAddress, level, chainId, now, expiresAt);

    // 记录到分配表
    db.prepare(`
      INSERT INTO nft_global_token_allocation 
      (global_token_id, chain_id, chain_name, contract_address, owner_address, level, status, reserved_at)
      VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?)
    `).run(globalTokenId, chainId, chainName, contractAddress, userAddress, level, now);

    // 更新全局统计
    db.prepare(`
      UPDATE nft_global_stats 
      SET total_reserved = total_reserved + 1,
          last_token_id = MAX(last_token_id, ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(globalTokenId);
  }

  /**
   * 标记 Token ID 为已铸造
   */
  static markAsMinted(params: {
    globalTokenId: number;
    txHash: string;
    signature: string;
    deadline: number;
  }): void {
    const { globalTokenId, txHash, signature, deadline } = params;
    const now = Math.floor(Date.now() / 1000);

    // 更新分配表
    db.prepare(`
      UPDATE nft_global_token_allocation 
      SET status = 'minted',
          minted_at = ?,
          tx_hash = ?,
          signature = ?,
          deadline = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE global_token_id = ?
    `).run(now, txHash, signature, deadline, globalTokenId);

    // 更新预留记录
    db.prepare(`
      UPDATE nft_token_reservations 
      SET status = 'used'
      WHERE global_token_id = ?
    `).run(globalTokenId);

    // 更新全局统计
    const allocation = db.prepare(`
      SELECT level, chain_id FROM nft_global_token_allocation 
      WHERE global_token_id = ?
    `).get(globalTokenId) as any;

    if (allocation) {
      // 更新总铸造数
      db.prepare(`
        UPDATE nft_global_stats 
        SET total_minted = total_minted + 1,
            total_reserved = total_reserved - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run();

      // 更新链统计
      const chainField = allocation.chain_id === 196 ? 'xlayer_minted' 
                       : allocation.chain_id === 56 ? 'bsc_minted' 
                       : 'solana_minted';
      
      db.prepare(`
        UPDATE nft_global_stats 
        SET ${chainField} = ${chainField} + 1
        WHERE id = 1
      `).run();

      // 更新等级统计
      db.prepare(`
        UPDATE nft_level_stats 
        SET minted = minted + 1,
            available = total_supply - minted,
            updated_at = CURRENT_TIMESTAMP
        WHERE level = ?
      `).run(allocation.level);

      // 更新当前阶段
      this.updateCurrentStage();
    }
  }

  /**
   * 标记 Token ID 为失败（立即清理）
   * 用于交易失败时立即释放 Token ID
   */
  static markAsFailed(globalTokenId: number, reason: string = 'Transaction failed'): void {
    console.log(`❌ Marking Token ID ${globalTokenId} as failed: ${reason}`);

    // 删除分配记录
    db.prepare(`
      DELETE FROM nft_global_token_allocation 
      WHERE global_token_id = ? AND status = 'reserved'
    `).run(globalTokenId);

    // 标记预留为失败
    db.prepare(`
      UPDATE nft_token_reservations 
      SET status = 'failed'
      WHERE global_token_id = ? AND status = 'active'
    `).run(globalTokenId);

    // 更新统计
    db.prepare(`
      UPDATE nft_global_stats 
      SET total_reserved = total_reserved - 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run();

    console.log(`✅ Token ID ${globalTokenId} released immediately, available for next user`);
  }

  /**
   * 取消预留（用户主动取消）
   */
  static cancelReservation(globalTokenId: number, userAddress: string): boolean {
    // 验证是否是该用户的预留
    const reservation = db.prepare(`
      SELECT * FROM nft_token_reservations 
      WHERE global_token_id = ? AND user_address = ? AND status = 'active'
    `).get(globalTokenId, userAddress.toLowerCase()) as any;

    if (!reservation) {
      return false;
    }

    // 立即清理
    this.markAsFailed(globalTokenId, 'User cancelled');
    return true;
  }

  /**
   * 获取当前总铸造数量
   */
  static getTotalMinted(): number {
    const stats = db.prepare('SELECT total_minted FROM nft_global_stats WHERE id = 1').get() as any;
    return stats?.total_minted || 0;
  }

  /**
   * 获取当前阶段
   */
  static getCurrentStage(totalMinted: number): number {
    if (totalMinted < 2780) return 1;
    if (totalMinted < 5560) return 2;
    if (totalMinted < 8340) return 3;
    if (totalMinted < 11120) return 4;
    return 5;
  }

  /**
   * 获取阶段效率
   */
  static getStageEfficiency(stage: number): number {
    const efficiencies = [100, 95, 90, 85, 80];
    return efficiencies[stage - 1] || 80;
  }

  /**
   * 更新当前阶段
   */
  private static updateCurrentStage(): void {
    const totalMinted = this.getTotalMinted();
    const currentStage = this.getCurrentStage(totalMinted);
    const efficiency = this.getStageEfficiency(currentStage);

    db.prepare(`
      UPDATE nft_global_stats 
      SET current_stage = ?,
          stage_efficiency = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(currentStage, efficiency);
  }

  /**
   * 清理过期的预留
   */
  static cleanExpiredReservations(): void {
    const now = Math.floor(Date.now() / 1000);

    // 获取过期的预留
    const expired = db.prepare(`
      SELECT global_token_id FROM nft_token_reservations 
      WHERE status = 'active' AND expires_at < ?
    `).all(now) as any[];

    if (expired.length > 0) {
      // 标记为过期
      db.prepare(`
        UPDATE nft_token_reservations 
        SET status = 'expired'
        WHERE status = 'active' AND expires_at < ?
      `).run(now);

      // 删除分配表中的预留记录
      const tokenIds = expired.map(r => r.global_token_id);
      const placeholders = tokenIds.map(() => '?').join(',');
      
      db.prepare(`
        DELETE FROM nft_global_token_allocation 
        WHERE global_token_id IN (${placeholders}) AND status = 'reserved'
      `).run(...tokenIds);

      // 更新统计
      db.prepare(`
        UPDATE nft_global_stats 
        SET total_reserved = total_reserved - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(expired.length);

      console.log(`🧹 清理了 ${expired.length} 个过期的 Token ID 预留`);
    }
  }

  /**
   * 获取用户持有的 NFT
   */
  static getUserNFTs(userAddress: string): any[] {
    return db.prepare(`
      SELECT * FROM nft_holders 
      WHERE owner_address = ?
      ORDER BY global_token_id
    `).all(userAddress.toLowerCase());
  }

  /**
   * 获取全局统计
   */
  static getGlobalStats(): any {
    return db.prepare('SELECT * FROM nft_global_stats WHERE id = 1').get();
  }

  /**
   * 获取等级统计
   */
  static getLevelStats(): any[] {
    return db.prepare('SELECT * FROM nft_level_stats ORDER BY level').all();
  }

  /**
   * 检查等级是否还有可用供应
   */
  static checkLevelAvailability(level: number): boolean {
    const stats = db.prepare(`
      SELECT available FROM nft_level_stats WHERE level = ?
    `).get(level) as any;

    return stats && stats.available > 0;
  }
}
