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
 * 获取所有在售 NFT
 */
router.get('/listings', async (req, res) => {
    try {
        // Return empty listings for now (marketplace not fully implemented)
        res.json({
            success: true,
            data: [],
            count: 0
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
        
        const result = await db.query(`
            SELECT 
                l.*,
                CASE 
                    WHEN l.nft_level = 0 THEN 'Micro'
                    WHEN l.nft_level = 1 THEN 'Mini'
                    WHEN l.nft_level = 2 THEN 'Bronze'
                    WHEN l.nft_level = 3 THEN 'Silver'
                    WHEN l.nft_level = 4 THEN 'Gold'
                    WHEN l.nft_level = 5 THEN 'Platinum'
                    WHEN l.nft_level = 6 THEN 'Diamond'
                END as level_name
            FROM nft_listings l
            WHERE l.token_id = $1 AND l.is_active = true
        `, [tokenId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'NFT not found or not listed'
            });
        }
        
        const row = result.rows[0];
        
        res.json({
            success: true,
            data: {
                tokenId: row.token_id,
                seller: row.seller_address,
                price: parseFloat(row.price),
                level: row.nft_level,
                levelName: row.level_name,
                stage: row.nft_stage,
                basePower: parseFloat(row.base_power),
                stageMultiplier: parseFloat(row.stage_multiplier),
                finalPower: parseFloat(row.final_power),
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
        
        const result = await db.query(`
            SELECT 
                l.*,
                CASE 
                    WHEN l.nft_level = 0 THEN 'Micro'
                    WHEN l.nft_level = 1 THEN 'Mini'
                    WHEN l.nft_level = 2 THEN 'Bronze'
                    WHEN l.nft_level = 3 THEN 'Silver'
                    WHEN l.nft_level = 4 THEN 'Gold'
                    WHEN l.nft_level = 5 THEN 'Platinum'
                    WHEN l.nft_level = 6 THEN 'Diamond'
                END as level_name
            FROM nft_listings l
            WHERE l.seller_address = $1 AND l.is_active = true
            ORDER BY l.listed_at DESC
        `, [address.toLowerCase()]);
        
        const listings = result.rows.map((row: any) => ({
            tokenId: row.token_id,
            price: parseFloat(row.price),
            level: row.nft_level,
            levelName: row.level_name,
            stage: row.nft_stage,
            finalPower: parseFloat(row.final_power),
            listedAt: row.listed_at,
        }));
        
        res.json({
            success: true,
            data: listings,
            count: listings.length
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
        const { limit = 20 } = req.query;
        
        const result = await db.query(`
            SELECT 
                s.*,
                CASE 
                    WHEN s.nft_level = 0 THEN 'Micro'
                    WHEN s.nft_level = 1 THEN 'Mini'
                    WHEN s.nft_level = 2 THEN 'Bronze'
                    WHEN s.nft_level = 3 THEN 'Silver'
                    WHEN s.nft_level = 4 THEN 'Gold'
                    WHEN s.nft_level = 5 THEN 'Platinum'
                    WHEN s.nft_level = 6 THEN 'Diamond'
                END as level_name
            FROM nft_sales s
            ORDER BY s.sold_at DESC
            LIMIT $1
        `, [parseInt(limit as string)]);
        
        const sales = result.rows.map((row: any) => ({
            tokenId: row.token_id,
            seller: row.seller_address,
            buyer: row.buyer_address,
            price: parseFloat(row.price),
            level: row.nft_level,
            levelName: row.level_name,
            stage: row.nft_stage,
            finalPower: parseFloat(row.final_power),
            soldAt: row.sold_at,
            txHash: row.tx_hash,
        }));
        
        res.json({
            success: true,
            data: sales
        });
        
    } catch (error) {
        console.error('Error fetching recent sales:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent sales'
        });
    }
});

/**
 * GET /api/marketplace/stats/overview
 * 获取市场概览统计
 */
router.get('/stats/overview', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM v_marketplace_overview ORDER BY nft_level
        `);
        
        const overview = result.rows.map((row: any) => ({
            level: row.nft_level,
            levelName: LEVEL_NAMES[row.nft_level],
            listingsCount: parseInt(row.listings_count),
            minPrice: parseFloat(row.min_price),
            maxPrice: parseFloat(row.max_price),
            avgPrice: parseFloat(row.avg_price),
            stageDistribution: {
                stage1: parseInt(row.stage1_count || 0),
                stage2: parseInt(row.stage2_count || 0),
                stage3: parseInt(row.stage3_count || 0),
                stage4: parseInt(row.stage4_count || 0),
                stage5: parseInt(row.stage5_count || 0),
            }
        }));
        
        res.json({
            success: true,
            data: overview
        });
        
    } catch (error) {
        console.error('Error fetching overview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch overview'
        });
    }
});

/**
 * GET /api/marketplace/stats/trending
 * 获取热门 NFT
 */
router.get('/stats/trending', async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM v_trending_nfts`);
        
        const trending = result.rows.map((row: any) => ({
            level: row.nft_level,
            levelName: LEVEL_NAMES[row.nft_level],
            stage: row.nft_stage,
            salesCount: parseInt(row.sales_count),
            avgPrice: parseFloat(row.avg_price),
            totalVolume: parseFloat(row.total_volume),
        }));
        
        res.json({
            success: true,
            data: trending
        });
        
    } catch (error) {
        console.error('Error fetching trending:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch trending'
        });
    }
});

/**
 * GET /api/marketplace/stats/daily
 * 获取每日统计
 */
router.get('/stats/daily', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        
        const result = await db.query(`
            SELECT * FROM marketplace_stats
            WHERE date >= CURRENT_DATE - INTERVAL '${parseInt(days as string)} days'
            ORDER BY date DESC
        `);
        
        const stats = result.rows.map((row: any) => ({
            date: row.date,
            totalVolume: parseFloat(row.total_volume),
            totalSales: parseInt(row.total_sales),
            totalFees: parseFloat(row.total_fees),
            activeListings: parseInt(row.active_listings),
            uniqueSellers: parseInt(row.unique_sellers),
            uniqueBuyers: parseInt(row.unique_buyers),
        }));
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('Error fetching daily stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch daily stats'
        });
    }
});

/**
 * GET /api/marketplace/user/:address/activity
 * 获取用户市场活动
 */
router.get('/user/:address/activity', async (req, res) => {
    try {
        const { address } = req.params;
        const { limit = 50 } = req.query;
        
        const result = await db.query(`
            SELECT * FROM user_marketplace_activity
            WHERE user_address = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [address.toLowerCase(), parseInt(limit as string)]);
        
        const activities = result.rows.map((row: any) => ({
            type: row.activity_type,
            tokenId: row.token_id,
            price: row.price ? parseFloat(row.price) : null,
            txHash: row.tx_hash,
            timestamp: row.created_at,
        }));
        
        res.json({
            success: true,
            data: activities
        });
        
    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user activity'
        });
    }
});

export default router;
