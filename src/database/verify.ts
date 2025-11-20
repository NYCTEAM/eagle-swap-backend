import Database from 'better-sqlite3';
import * as path from 'path';

const dbPath = path.join(__dirname, '../../data/eagle-swap.db');

console.log('🔍 验证数据库结构...\n');

try {
    const db = new Database(dbPath);
    
    // 1. 检查 nodes 表
    console.log('=' .repeat(80));
    console.log('📋 1. nodes 表结构');
    console.log('=' .repeat(80));
    
    const nodesColumns = db.prepare("PRAGMA table_info(nodes)").all();
    console.table(nodesColumns.map((col: any) => ({
        字段名: col.name,
        类型: col.type,
        必填: col.notnull ? '是' : '否',
        主键: col.pk ? '是' : '否'
    })));
    
    const nodesCount = db.prepare("SELECT COUNT(*) as count FROM nodes").get() as any;
    console.log(`\n📊 当前记录数: ${nodesCount.count}\n`);
    
    // 2. 检查 mining_claim_history 表
    console.log('=' .repeat(80));
    console.log('📋 2. mining_claim_history 表结构');
    console.log('=' .repeat(80));
    
    try {
        const miningColumns = db.prepare("PRAGMA table_info(mining_claim_history)").all();
        console.table(miningColumns.map((col: any) => ({
            字段名: col.name,
            类型: col.type,
            必填: col.notnull ? '是' : '否',
            主键: col.pk ? '是' : '否'
        })));
        
        const miningCount = db.prepare("SELECT COUNT(*) as count FROM mining_claim_history").get() as any;
        console.log(`\n📊 当前记录数: ${miningCount.count}\n`);
    } catch (e) {
        console.log('❌ 表不存在\n');
    }
    
    // 3. 检查 user_power_cache 表
    console.log('=' .repeat(80));
    console.log('📋 3. user_power_cache 表结构');
    console.log('=' .repeat(80));
    
    try {
        const cacheColumns = db.prepare("PRAGMA table_info(user_power_cache)").all();
        console.table(cacheColumns.map((col: any) => ({
            字段名: col.name,
            类型: col.type,
            必填: col.notnull ? '是' : '否',
            主键: col.pk ? '是' : '否'
        })));
        
        const cacheCount = db.prepare("SELECT COUNT(*) as count FROM user_power_cache").get() as any;
        console.log(`\n📊 当前记录数: ${cacheCount.count}\n`);
    } catch (e) {
        console.log('❌ 表不存在\n');
    }
    
    // 4. 检查 nft_listings 表
    console.log('=' .repeat(80));
    console.log('📋 4. nft_listings 表结构');
    console.log('=' .repeat(80));
    
    try {
        const listingsColumns = db.prepare("PRAGMA table_info(nft_listings)").all();
        console.table(listingsColumns.map((col: any) => ({
            字段名: col.name,
            类型: col.type,
            必填: col.notnull ? '是' : '否',
            主键: col.pk ? '是' : '否'
        })));
        
        const listingsCount = db.prepare("SELECT COUNT(*) as count FROM nft_listings").get() as any;
        console.log(`\n📊 当前记录数: ${listingsCount.count}\n`);
    } catch (e) {
        console.log('❌ 表不存在\n');
    }
    
    // 5. 检查 nft_sales 表
    console.log('=' .repeat(80));
    console.log('📋 5. nft_sales 表结构');
    console.log('=' .repeat(80));
    
    try {
        const salesColumns = db.prepare("PRAGMA table_info(nft_sales)").all();
        console.table(salesColumns.map((col: any) => ({
            字段名: col.name,
            类型: col.type,
            必填: col.notnull ? '是' : '否',
            主键: col.pk ? '是' : '否'
        })));
        
        const salesCount = db.prepare("SELECT COUNT(*) as count FROM nft_sales").get() as any;
        console.log(`\n📊 当前记录数: ${salesCount.count}\n`);
    } catch (e) {
        console.log('❌ 表不存在\n');
    }
    
    // 6. 检查系统配置
    console.log('=' .repeat(80));
    console.log('⚙️  6. system_config 系统配置');
    console.log('=' .repeat(80));
    
    const configs = db.prepare("SELECT * FROM system_config").all();
    console.table(configs.map((cfg: any) => ({
        配置项: cfg.key,
        值: cfg.value,
        说明: cfg.description
    })));
    
    // 7. 检查所有表
    console.log('\n' + '=' .repeat(80));
    console.log('📊 7. 数据库所有表');
    console.log('=' .repeat(80));
    
    const tables = db.prepare(`
        SELECT name, type 
        FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
    `).all();
    
    console.table(tables.map((t: any) => ({
        表名: t.name,
        类型: t.type
    })));
    
    // 8. 检查所有索引
    console.log('\n' + '=' .repeat(80));
    console.log('🔍 8. 数据库索引');
    console.log('=' .repeat(80));
    
    const indexes = db.prepare(`
        SELECT name, tbl_name 
        FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
        ORDER BY tbl_name, name
    `).all();
    
    console.table(indexes.map((idx: any) => ({
        索引名: idx.name,
        所属表: idx.tbl_name
    })));
    
    db.close();
    
    console.log('\n' + '=' .repeat(80));
    console.log('✅ 数据库验证完成！');
    console.log('=' .repeat(80));
    
} catch (error: any) {
    console.error('\n❌ 验证失败:', error.message);
    console.error(error.stack);
    process.exit(1);
}
