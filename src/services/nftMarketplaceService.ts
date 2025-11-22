/**
 * NFT 市场服务
 * 处理 NFT 挂单、购买、查询等功能
 */

import { ethers } from 'ethers';
import { db } from '../database';

// NFT 等级名称映射
const LEVEL_NAMES = ['Micro', 'Mini', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

export class NFTMarketplaceService {
    private provider: ethers.JsonRpcProvider;
    private nftContract: ethers.Contract;
    
    constructor() {
        // 使用 Eagle Swap 自定义 X Layer RPC 节点
        const rpcUrl = process.env.XLAYER_RPC_URL || process.env.RPC_URL || 'https://rpc1.eagleswap.llc/xlayer/';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        
        const nftAddress = process.env.NFT_CONTRACT_ADDRESS || '';
        const nftABI = [
            // 查询函数
            "function getActiveListingsDetailed() view returns (uint256[], address[], uint256[], uint8[], uint8[], uint256[])",
            "function getListingsByLevel(uint8 level) view returns (uint256[], address[], uint256[], uint8[], uint256[])",
            "function getNFTInfo(uint256 tokenId) view returns (uint8, uint256, uint256, address, address, uint8, uint256, uint256, uint256)",
            "function listings(uint256 tokenId) view returns (address, uint256, bool, uint256)",
            
            // 事件
            "event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price)",
            "event NFTUnlisted(uint256 indexed tokenId, address indexed seller)",
            "event NFTSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price)",
        ];
        
        this.nftContract = new ethers.Contract(nftAddress, nftABI, this.provider);
    }
    
    /**
     * 启动市场监听
     */
    async startListening() {
        console.log('🛒 Starting NFT Marketplace listener...');
        
        // 监听挂单事件
        this.nftContract.on('NFTListed', async (tokenId, seller, price, event) => {
            await this.handleNFTListed(tokenId, seller, price, event);
        });
        
        // 监听取消挂单事件
        this.nftContract.on('NFTUnlisted', async (tokenId, seller, event) => {
            await this.handleNFTUnlisted(tokenId, seller, event);
        });
        
        // 监听交易事件
        this.nftContract.on('NFTSold', async (tokenId, seller, buyer, price, event) => {
            await this.handleNFTSold(tokenId, seller, buyer, price, event);
        });
        
        console.log('✅ NFT Marketplace listener started');
    }
    
    /**
     * 处理 NFT 挂单事件
     */
    private async handleNFTListed(
        tokenId: bigint,
        seller: string,
        price: bigint,
        event: any
    ) {
        try {
            console.log(`\n📝 NFT Listed: Token #${tokenId}`);
            console.log(`   Seller: ${seller}`);
            console.log(`   Price: ${ethers.formatUnits(price, 6)} USDT`);
            
            // 查询 NFT 详细信息
            const nftInfo = await this.nftContract.getNFTInfo(tokenId);
            
            const level = Number(nftInfo[0]);
            const stage = Number(nftInfo[5]);
            const basePower = Number(nftInfo[6]) / 100;
            const stageMultiplier = Number(nftInfo[7]) / 100;
            const finalPower = Number(nftInfo[8]) / 100;
            
            // 保存到数据库
            await db.query(`
                INSERT INTO nft_listings (
                    token_id, seller_address, price, is_active, listed_at,
                    nft_level, nft_stage, base_power, stage_multiplier, final_power,
                    tx_hash
                ) VALUES ($1, $2, $3, true, NOW(), $4, $5, $6, $7, $8, $9)
                ON CONFLICT (token_id) 
                DO UPDATE SET
                    seller_address = $2,
                    price = $3,
                    is_active = true,
                    listed_at = NOW(),
                    tx_hash = $9,
                    updated_at = NOW()
            `, [
                tokenId.toString(),
                seller.toLowerCase(),
                ethers.formatUnits(price, 6),
                level,
                stage,
                basePower,
                stageMultiplier,
                finalPower,
                event.log.transactionHash
            ]);
            
            // 记录用户活动
            await this.recordUserActivity(
                seller.toLowerCase(),
                'list',
                tokenId.toString(),
                parseFloat(ethers.formatUnits(price, 6)),
                event.log.transactionHash
            );
            
            console.log('   ✅ Listing saved to database');
            
        } catch (error) {
            console.error('❌ Error handling NFT listed:', error);
        }
    }
    
    /**
     * 处理取消挂单事件
     */
    private async handleNFTUnlisted(
        tokenId: bigint,
        seller: string,
        event: any
    ) {
        try {
            console.log(`\n🚫 NFT Unlisted: Token #${tokenId}`);
            
            // 更新数据库
            await db.query(`
                UPDATE nft_listings
                SET is_active = false,
                    unlisted_at = NOW(),
                    updated_at = NOW()
                WHERE token_id = $1
            `, [tokenId.toString()]);
            
            // 记录用户活动
            await this.recordUserActivity(
                seller.toLowerCase(),
                'unlist',
                tokenId.toString(),
                null,
                event.log.transactionHash
            );
            
            console.log('   ✅ Listing removed from database');
            
        } catch (error) {
            console.error('❌ Error handling NFT unlisted:', error);
        }
    }
    
    /**
     * 处理 NFT 交易事件
     */
    private async handleNFTSold(
        tokenId: bigint,
        seller: string,
        buyer: string,
        price: bigint,
        event: any
    ) {
        try {
            console.log(`\n💰 NFT Sold: Token #${tokenId}`);
            console.log(`   Seller: ${seller}`);
            console.log(`   Buyer: ${buyer}`);
            console.log(`   Price: ${ethers.formatUnits(price, 6)} USDT`);
            
            // 查询 NFT 信息
            const listing = await db.query(`
                SELECT * FROM nft_listings WHERE token_id = $1
            `, [tokenId.toString()]);
            
            if (listing.rows.length === 0) {
                console.error('   ⚠️ Listing not found in database');
                return;
            }
            
            const nftInfo = listing.rows[0];
            const priceUSDT = parseFloat(ethers.formatUnits(price, 6));
            const fee = priceUSDT * 0.02; // 2% 手续费
            const sellerAmount = priceUSDT - fee;
            
            // 保存交易记录
            await db.query(`
                INSERT INTO nft_sales (
                    token_id, seller_address, buyer_address, price,
                    marketplace_fee, seller_amount,
                    nft_level, nft_stage, final_power,
                    tx_hash, block_number, sold_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            `, [
                tokenId.toString(),
                seller.toLowerCase(),
                buyer.toLowerCase(),
                priceUSDT,
                fee,
                sellerAmount,
                nftInfo.nft_level,
                nftInfo.nft_stage,
                nftInfo.final_power,
                event.log.transactionHash,
                event.log.blockNumber
            ]);
            
            // 更新挂单状态
            await db.query(`
                UPDATE nft_listings
                SET is_active = false,
                    unlisted_at = NOW(),
                    updated_at = NOW()
                WHERE token_id = $1
            `, [tokenId.toString()]);
            
            // 记录卖家活动
            await this.recordUserActivity(
                seller.toLowerCase(),
                'sell',
                tokenId.toString(),
                priceUSDT,
                event.log.transactionHash
            );
            
            // 记录买家活动
            await this.recordUserActivity(
                buyer.toLowerCase(),
                'buy',
                tokenId.toString(),
                priceUSDT,
                event.log.transactionHash
            );
            
            // 更新每日统计
            await this.updateDailyStats(priceUSDT, fee);
            
            console.log('   ✅ Sale recorded to database');
            console.log(`   💵 Seller receives: ${sellerAmount.toFixed(2)} USDT`);
            console.log(`   💵 Marketplace fee: ${fee.toFixed(2)} USDT`);
            
        } catch (error) {
            console.error('❌ Error handling NFT sold:', error);
        }
    }
    
    /**
     * 记录用户活动
     */
    private async recordUserActivity(
        userAddress: string,
        activityType: string,
        tokenId: string,
        price: number | null,
        txHash: string
    ) {
        await db.query(`
            INSERT INTO user_marketplace_activity (
                user_address, activity_type, token_id, price, tx_hash
            ) VALUES ($1, $2, $3, $4, $5)
        `, [userAddress, activityType, tokenId, price, txHash]);
    }
    
    /**
     * 更新每日统计
     */
    private async updateDailyStats(volume: number, fee: number) {
        const today = new Date().toISOString().split('T')[0];
        
        await db.query(`
            INSERT INTO marketplace_stats (date, total_volume, total_sales, total_fees)
            VALUES ($1, $2, 1, $3)
            ON CONFLICT (date)
            DO UPDATE SET
                total_volume = marketplace_stats.total_volume + $2,
                total_sales = marketplace_stats.total_sales + 1,
                total_fees = marketplace_stats.total_fees + $3
        `, [today, volume, fee]);
    }
    
    /**
     * 同步链上市场数据
     */
    async syncMarketplaceData() {
        try {
            console.log('🔄 Syncing marketplace data from blockchain...');
            
            // 获取所有在售 NFT
            const result = await this.nftContract.getActiveListingsDetailed();
            
            const tokenIds = result[0];
            const sellers = result[1];
            const prices = result[2];
            const levels = result[3];
            const stages = result[4];
            const powers = result[5];
            
            console.log(`   Found ${tokenIds.length} active listings`);
            
            // 清空现有数据
            await db.query('UPDATE nft_listings SET is_active = false WHERE is_active = true');
            
            // 插入最新数据
            for (let i = 0; i < tokenIds.length; i++) {
                const level = Number(levels[i]);
                const stage = Number(stages[i]);
                const power = Number(powers[i]) / 100;
                
                await db.query(`
                    INSERT INTO nft_listings (
                        token_id, seller_address, price, is_active, listed_at,
                        nft_level, nft_stage, final_power
                    ) VALUES ($1, $2, $3, true, NOW(), $4, $5, $6)
                    ON CONFLICT (token_id)
                    DO UPDATE SET
                        seller_address = $2,
                        price = $3,
                        is_active = true,
                        nft_level = $4,
                        nft_stage = $5,
                        final_power = $6,
                        updated_at = NOW()
                `, [
                    tokenIds[i].toString(),
                    sellers[i].toLowerCase(),
                    ethers.formatUnits(prices[i], 6),
                    level,
                    stage,
                    power
                ]);
            }
            
            console.log('   ✅ Marketplace data synced');
            
        } catch (error) {
            console.error('❌ Error syncing marketplace data:', error);
        }
    }
    
    /**
     * 获取市场概览
     */
    async getMarketplaceOverview() {
        const result = await db.query('SELECT * FROM v_marketplace_overview ORDER BY nft_level');
        return result.rows.map((row: any) => ({
            level: row.nft_level,
            levelName: LEVEL_NAMES[row.nft_level],
            listingsCount: parseInt(row.listings_count),
            minPrice: parseFloat(row.min_price),
            maxPrice: parseFloat(row.max_price),
            avgPrice: parseFloat(row.avg_price),
            stageDistribution: {
                stage1: parseInt(row.stage1_count),
                stage2: parseInt(row.stage2_count),
                stage3: parseInt(row.stage3_count),
                stage4: parseInt(row.stage4_count),
                stage5: parseInt(row.stage5_count),
            }
        }));
    }
    
    /**
     * 获取热门 NFT
     */
    async getTrendingNFTs() {
        const result = await db.query('SELECT * FROM v_trending_nfts');
        return result.rows.map((row: any) => ({
            level: row.nft_level,
            levelName: LEVEL_NAMES[row.nft_level],
            stage: row.nft_stage,
            salesCount: parseInt(row.sales_count),
            avgPrice: parseFloat(row.avg_price),
            totalVolume: parseFloat(row.total_volume),
        }));
    }
}

// 导出单例
export const nftMarketplaceService = new NFTMarketplaceService();
