import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { body, param, query } from 'express-validator';
import { checkValidation } from '../middleware/validation';
import { logger } from '../utils/logger';
import { db } from '../database';

const router = Router();

// Validate both EVM and Solana addresses
const isValidWalletAddress = (value: string) => {
  const isEvm = /^0x[a-fA-F0-9]{40}$/.test(value);
  const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  return isEvm || isSolana;
};

// Chain ID mapping
const CHAIN_IDS = {
  XLAYER: 196,
  BSC: 56,
  SOLANA: 900
};

/**
 * GET /api/multichain-nft/contracts
 * 获取所有链的 NFT 合约配置
 */
router.get('/contracts',
  asyncHandler(async (req, res) => {
    const contracts = db.prepare(`
      SELECT * FROM nft_chain_contracts
      ORDER BY chain_id
    `).all();

    res.json({
      success: true,
      data: contracts,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * GET /api/multichain-nft/inventory
 * 获取所有链的 NFT 库存
 */
router.get('/inventory',
  query('chainId').optional().isInt().withMessage('Invalid chain ID'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : null;

    let inventory;
    if (chainId) {
      inventory = db.prepare(`
        SELECT * FROM nft_multichain_inventory
        WHERE chain_id = ?
        ORDER BY level
      `).all(chainId);
    } else {
      inventory = db.prepare(`
        SELECT * FROM nft_multichain_inventory
        ORDER BY chain_id, level
      `).all();
    }

    res.json({
      success: true,
      data: inventory,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * GET /api/multichain-nft/global-stats
 * 获取全局 NFT 统计
 */
router.get('/global-stats',
  asyncHandler(async (req, res) => {
    // 每个等级的全局统计
    const levelStats = db.prepare(`
      SELECT 
        level,
        MIN(level_name) as level_name,
        MIN(price_usdt) as price_usdt,
        MIN(mining_power) as mining_power,
        MIN(boost_multiplier) as boost_multiplier,
        SUM(total_supply) as global_total_supply,
        SUM(minted) as global_minted,
        SUM(total_supply - minted) as global_available
      FROM nft_multichain_inventory
      GROUP BY level
      ORDER BY level
    `).all();

    // 每条链的统计
    const chainStats = db.prepare(`
      SELECT 
        i.chain_id,
        c.chain_name,
        c.is_active,
        SUM(i.total_supply) as total_supply,
        SUM(i.minted) as total_minted,
        SUM(i.total_supply - i.minted) as total_available
      FROM nft_multichain_inventory i
      LEFT JOIN nft_chain_contracts c ON i.chain_id = c.chain_id
      GROUP BY i.chain_id
    `).all();

    // 总计
    const totals = db.prepare(`
      SELECT 
        SUM(total_supply) as total_supply,
        SUM(minted) as total_minted,
        SUM(total_supply - minted) as total_available
      FROM nft_multichain_inventory
    `).get() as any;

    res.json({
      success: true,
      data: {
        levels: levelStats,
        chains: chainStats,
        totals: {
          total_supply: totals?.total_supply || 0,
          total_minted: totals?.total_minted || 0,
          total_available: totals?.total_available || 0
        }
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * GET /api/multichain-nft/user/:address
 * 获取用户在所有链上的 NFT
 */
router.get('/user/:address',
  param('address').custom(isValidWalletAddress).withMessage('Invalid wallet address'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { address } = req.params;

    // 获取用户所有 NFT
    const nfts = db.prepare(`
      SELECT 
        g.*,
        i.level_name,
        i.mining_power,
        i.boost_multiplier,
        c.chain_name
      FROM nft_global_registry g
      LEFT JOIN nft_multichain_inventory i ON g.chain_id = i.chain_id AND g.level = i.level
      LEFT JOIN nft_chain_contracts c ON g.chain_id = c.chain_id
      WHERE g.owner_address = ? AND g.is_burned = 0
      ORDER BY g.level DESC, g.minted_at DESC
    `).all(address);

    // 汇总统计
    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_nfts,
        SUM(CASE WHEN chain_id = 196 THEN 1 ELSE 0 END) as xlayer_nfts,
        SUM(CASE WHEN chain_id = 56 THEN 1 ELSE 0 END) as bsc_nfts,
        SUM(CASE WHEN chain_id = 900 THEN 1 ELSE 0 END) as solana_nfts,
        MAX(level) as highest_level
      FROM nft_global_registry
      WHERE owner_address = ? AND is_burned = 0
    `).get(address) as any;

    // 计算总挖矿权重
    const totalPower = db.prepare(`
      SELECT COALESCE(SUM(i.mining_power), 0) as total_power
      FROM nft_global_registry g
      LEFT JOIN nft_multichain_inventory i ON g.chain_id = i.chain_id AND g.level = i.level
      WHERE g.owner_address = ? AND g.is_burned = 0
    `).get(address) as any;

    // 获取最高等级 NFT 的加成
    const highestBoost = db.prepare(`
      SELECT i.boost_multiplier
      FROM nft_global_registry g
      LEFT JOIN nft_multichain_inventory i ON g.chain_id = i.chain_id AND g.level = i.level
      WHERE g.owner_address = ? AND g.is_burned = 0
      ORDER BY g.level DESC
      LIMIT 1
    `).get(address) as any;

    res.json({
      success: true,
      data: {
        nfts,
        summary: {
          total_nfts: summary?.total_nfts || 0,
          xlayer_nfts: summary?.xlayer_nfts || 0,
          bsc_nfts: summary?.bsc_nfts || 0,
          solana_nfts: summary?.solana_nfts || 0,
          highest_level: summary?.highest_level || 0,
          total_power: totalPower?.total_power || 0,
          boost_multiplier: highestBoost?.boost_multiplier || 1.0,
          boost_percentage: highestBoost ? (highestBoost.boost_multiplier - 1) * 100 : 0
        }
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * POST /api/multichain-nft/record-mint
 * 记录 NFT 铸造 (由各链的同步服务调用)
 */
router.post('/record-mint',
  body('chainId').isInt().withMessage('Chain ID required'),
  body('chainTokenId').isInt().withMessage('Chain Token ID required'),
  body('level').isInt({ min: 1, max: 7 }).withMessage('Level must be 1-7'),
  body('ownerAddress').custom(isValidWalletAddress).withMessage('Invalid owner address'),
  body('mintTx').notEmpty().withMessage('Mint TX required'),
  body('priceUsdt').isFloat({ min: 0 }).withMessage('Price required'),
  body('paymentToken').notEmpty().withMessage('Payment token required'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const { chainId, chainTokenId, level, ownerAddress, mintTx, priceUsdt, paymentToken } = req.body;

    try {
      // 插入全局记录
      const result = db.prepare(`
        INSERT INTO nft_global_registry 
        (chain_id, chain_token_id, level, owner_address, mint_tx, mint_price_usdt, payment_token)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(chainId, chainTokenId, level, ownerAddress, mintTx, priceUsdt, paymentToken);

      // 更新库存 (触发器会自动处理，但这里手动确保)
      db.prepare(`
        UPDATE nft_multichain_inventory 
        SET minted = minted + 1, updated_at = CURRENT_TIMESTAMP
        WHERE chain_id = ? AND level = ?
      `).run(chainId, level);

      logger.info('NFT mint recorded', { 
        globalId: result.lastInsertRowid, 
        chainId, 
        chainTokenId, 
        level, 
        ownerAddress 
      });

      res.json({
        success: true,
        data: {
          globalId: result.lastInsertRowid,
          chainId,
          chainTokenId,
          level,
          ownerAddress
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          success: false,
          error: 'NFT already recorded',
          timestamp: new Date().toISOString()
        });
      }
      throw error;
    }
  })
);

/**
 * GET /api/multichain-nft/next-id/:chainId
 * 获取下一个可用的 Token ID (用于合约铸造)
 */
router.get('/next-id/:chainId',
  param('chainId').isInt().withMessage('Invalid chain ID'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const chainId = parseInt(req.params.chainId);

    const lastToken = db.prepare(`
      SELECT MAX(chain_token_id) as last_id
      FROM nft_global_registry
      WHERE chain_id = ?
    `).get(chainId) as any;

    const nextId = (lastToken?.last_id || 0) + 1;

    res.json({
      success: true,
      data: { 
        chainId,
        nextTokenId: nextId 
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * GET /api/multichain-nft/check-availability/:chainId/:level
 * 检查某链某等级是否还有库存
 */
router.get('/check-availability/:chainId/:level',
  param('chainId').isInt().withMessage('Invalid chain ID'),
  param('level').isInt({ min: 1, max: 7 }).withMessage('Level must be 1-7'),
  checkValidation,
  asyncHandler(async (req, res) => {
    const chainId = parseInt(req.params.chainId);
    const level = parseInt(req.params.level);

    const inventory = db.prepare(`
      SELECT * FROM nft_multichain_inventory
      WHERE chain_id = ? AND level = ?
    `).get(chainId, level) as any;

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: 'Level not found for this chain',
        timestamp: new Date().toISOString()
      });
    }

    const available = inventory.total_supply - inventory.minted;

    res.json({
      success: true,
      data: {
        chainId,
        level,
        levelName: inventory.level_name,
        priceUsdt: inventory.price_usdt,
        totalSupply: inventory.total_supply,
        minted: inventory.minted,
        available,
        isAvailable: available > 0
      },
      timestamp: new Date().toISOString()
    });
  })
);

export default router;
