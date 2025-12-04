/**
 * NFT 市场 API 路由
 */

import express from 'express';
import { db } from '../database';

const router = express.Router();

// NFT 等级名称
const LEVEL_NAMES = ['Micro', 'Mini', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

/**
 * GET /api/marketplace/listings
 * 获取所有在售 NFT（支持多链）
 */
router.get('/listings', async (req, res) => {
    try {
        // 首先尝试从 nft_holders 表获取挂单（新的多链表）
        let listings: any[] = [];
        
        try {
            listings = db.prepare(`
                SELECT 
                    h.global_token_id as token_id,
                    h.owner_address as seller_address,
                    h.listing_price as price,
                    h.level as nft_level,
                    h.weight as final_power,
                    h.minted_at as listed_at,
                    h.chain_id,
                    h.chain_name,
                    COALESCE(l.level_name, 'NFT') as level_name
                FROM nft_holders h
                LEFT JOIN nft_level_stats l ON h.level = l.level
                WHERE h.is_listed = 1 AND h.listing_price > 0
                ORDER BY h.created_at DESC
            `).all();
        } catch (e) {
            console.log('nft_holders query failed, trying user_nfts...');
        }

        // 如果 nft_holders 没有数据，回退到 user_nfts 表
        if (listings.length === 0) {
            listings = db.prepare(`
                SELECT 
                    u.token_id,
                    u.owner_address as seller_address,
                    u.listing_price as price,
                    u.level as nft_level,
                    u.weight as final_power,
                    u.minted_at as listed_at,
                    196 as chain_id,
                    'X Layer' as chain_name,
                    COALESCE(i.name, 'NFT') as level_name
                FROM user_nfts u
                LEFT JOIN nft_inventory i ON u.level = i.level
                WHERE u.is_listed = 1 AND u.listing_price > 0
                ORDER BY u.created_at DESC
            `).all();
        }

        console.log(`🔍 [API] Found ${listings.length} active listings in database`);

        // 映射数据结构
        const mappedListings = listings.map((l: any) => {
            // 根据链的 USDT 小数位转换价格
            // X Layer (196): 6 decimals, BSC (56): 18 decimals
            const chainId = l.chain_id || 196;
            const usdtDecimals = chainId === 56 ? 18 : 6;
            const priceInUSDT = l.price ? Number(l.price) / Math.pow(10, usdtDecimals) : 0;
            
            return {
                tokenId: l.token_id,
                seller: l.seller_address || '',
                price: priceInUSDT,
                level: l.nft_level || 1,
                levelName: l.level_name || LEVEL_NAMES[(l.nft_level || 1) - 1] || `Level ${l.nft_level}`,
                stage: 1,
                finalPower: l.final_power ? l.final_power / 1000 : 0, // 转换 weight
                basePower: l.final_power ? l.final_power / 1000 : 0,
                listedAt: l.listed_at,
                chainId: chainId,
                chainName: l.chain_name || 'X Layer'
            };
        });

        res.json({
            success: true,
            data: mappedListings,
            count: mappedListings.length
        });
    } catch (error) {
        console.error('Error fetching listings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch listings'
        });
    }
});

/**
 * GET /api/marketplace/listings/:tokenId
 * 获取单个 NFT 详情
 */
router.get('/listings/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        
        const row = db.prepare(`
            SELECT 
                u.token_id,
                u.owner_address as seller_address,
                u.listing_price as price,
                u.level as nft_level,
                u.weight as final_power,
                u.minted_at as listed_at,
                COALESCE(i.name, 'NFT') as level_name
            FROM user_nfts u
            LEFT JOIN nft_inventory i ON u.level = i.level
            WHERE u.token_id = ? AND u.is_listed = 1
        `).get(tokenId) as any;
        
        if (!row) {
            return res.status(404).json({
                success: false,
                error: 'NFT not found or not listed'
            });
        }
        
        res.json({
            success: true,
            data: {
                tokenId: row.token_id,
                seller: row.seller_address,
                price: row.price,
                level: row.nft_level,
                levelName: row.level_name,
                stage: 1,
                basePower: row.final_power,
                stageMultiplier: 1,
                finalPower: row.final_power,
                listedAt: row.listed_at,
            }
        });
        
    } catch (error) {
        console.error('Error fetching listing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch listing'
        });
    }
});

/**
 * GET /api/marketplace/user/:address/listings
 * 获取用户的挂单
 */
router.get('/user/:address/listings', async (req, res) => {
    try {
        const { address } = req.params;
        
        const listings = db.prepare(`
            SELECT 
                u.token_id,
                u.listing_price as price,
                u.level as nft_level,
                u.weight as final_power,
                u.minted_at as listed_at,
                COALESCE(i.name, 'NFT') as level_name
            FROM user_nfts u
            LEFT JOIN nft_inventory i ON u.level = i.level
            WHERE u.owner_address = ? AND u.is_listed = 1
            ORDER BY u.created_at DESC
        `).all(address.toLowerCase());
        
        const mappedListings = listings.map((row: any) => ({
            tokenId: row.token_id,
            seller: address, // 添加 seller 字段
            price: row.price,
            level: row.nft_level,
            levelName: row.level_name,
            stage: 1,
            finalPower: row.final_power,
            listedAt: row.listed_at,
        }));
        
        res.json({
            success: true,
            data: mappedListings,
            count: mappedListings.length
        });
        
    } catch (error) {
        console.error('Error fetching user listings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user listings'
        });
    }
});

/**
 * GET /api/marketplace/sales/recent
 * 获取最近交易
 */
router.get('/sales/recent', async (req, res) => {
    try {
        // 暂时返回空数据，因为没有销售记录表
        res.json({
            success: true,
            data: []
        });
    } catch (error) {
        console.error('Error fetching recent sales:', error);
        res.json({ success: true, data: [] });
    }
});

/**
 * GET /api/marketplace/stats/overview
 * 获取市场概览统计
 */
router.get('/stats/overview', async (req, res) => {
    try {
        // 从 user_nfts 聚合统计当前挂单数据
        const stats = db.prepare(`
            SELECT 
                level,
                COUNT(*) as listings_count,
                MIN(listing_price) as min_price,
                MAX(listing_price) as max_price,
                AVG(listing_price) as avg_price
            FROM user_nfts
            WHERE is_listed = 1 AND listing_price > 0
            GROUP BY level
            ORDER BY level
        `).all();
        
        const overview = stats.map((row: any) => ({
            level: row.level,
            levelName: LEVEL_NAMES[row.level] || `Level ${row.level}`,
            listingsCount: row.listings_count,
            minPrice: row.min_price,
            maxPrice: row.max_price,
            avgPrice: row.avg_price,
            stageDistribution: {
                stage1: row.listings_count, // 暂时默认都是 Stage 1
                stage2: 0,
                stage3: 0,
                stage4: 0,
                stage5: 0,
            }
        }));
        
        res.json({
            success: true,
            data: overview
        });
        
    } catch (error) {
        console.error('Error fetching overview:', error);
        res.json({ success: true, data: [] });
    }
});

/**
 * GET /api/marketplace/stats/trending
 * 获取热门 NFT
 */
router.get('/stats/trending', async (req, res) => {
    try {
        // 暂时返回空数据
        res.json({
            success: true,
            data: []
        });
    } catch (error) {
        console.error('Error fetching trending:', error);
        res.json({ success: true, data: [] });
    }
});

/**
 * GET /api/marketplace/stats/daily
 * 获取每日统计
 */
router.get('/stats/daily', async (req, res) => {
    try {
        // 暂时返回空数据
        res.json({
            success: true,
            data: []
        });
    } catch (error) {
        console.error('Error fetching daily stats:', error);
        res.json({ success: true, data: [] });
    }
});

/**
 * GET /api/marketplace/user/:address/activity
 * 获取用户市场活动
 */
router.get('/user/:address/activity', async (req, res) => {
    try {
        // 暂时返回空数据
        res.json({
            success: true,
            data: []
        });
    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.json({ success: true, data: [] });
    }
});

export default router;
