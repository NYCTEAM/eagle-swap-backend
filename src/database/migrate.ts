import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const dbPath = path.join(__dirname, '../../data/eagle-swap.db');
const sqlPath = path.join(__dirname, 'fix_database_schema.sql');

console.log('🔧 开始数据库修复...');
console.log('数据库路径:', dbPath);
console.log('SQL 脚本路径:', sqlPath);

try {
    // 打开数据库
    const db = new Database(dbPath);
    
    // 读取 SQL 脚本
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 分割 SQL 语句（按分号分割）
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`\n📝 找到 ${statements.length} 条 SQL 语句`);
    
    // 开始事务
    db.exec('BEGIN TRANSACTION');
    
    let successCount = 0;
    let errorCount = 0;
    
    // 执行每条语句
    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        try {
            // 跳过 SELECT 语句（用于验证）
            if (statement.toUpperCase().startsWith('SELECT')) {
                console.log(`\n📊 验证语句 ${i + 1}:`);
                const result = db.prepare(statement).all();
                console.log(result);
                successCount++;
                continue;
            }
            
            // 跳过 PRAGMA 语句
            if (statement.toUpperCase().startsWith('PRAGMA')) {
                console.log(`\n🔍 表结构查询 ${i + 1}:`);
                const result = db.prepare(statement).all();
                console.table(result);
                successCount++;
                continue;
            }
            
            // 执行其他语句
            db.exec(statement);
            console.log(`✅ 语句 ${i + 1} 执行成功`);
            successCount++;
            
        } catch (error: any) {
            // 忽略"表已存在"错误
            if (error.message.includes('already exists')) {
                console.log(`⚠️  语句 ${i + 1} 跳过（表已存在）`);
                successCount++;
            } else {
                console.error(`❌ 语句 ${i + 1} 执行失败:`, error.message);
                console.error('语句内容:', statement.substring(0, 100) + '...');
                errorCount++;
            }
        }
    }
    
    // 提交事务
    db.exec('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 执行结果统计:');
    console.log(`✅ 成功: ${successCount} 条`);
    console.log(`❌ 失败: ${errorCount} 条`);
    console.log('='.repeat(60));
    
    // 验证表结构
    console.log('\n🔍 验证新表结构...\n');
    
    // 检查 nodes 表
    const nodesInfo = db.prepare("PRAGMA table_info(nodes)").all();
    console.log('📋 nodes 表结构:');
    console.table(nodesInfo);
    
    // 检查 mining_claim_history 表
    try {
        const miningInfo = db.prepare("PRAGMA table_info(mining_claim_history)").all();
        console.log('\n📋 mining_claim_history 表结构:');
        console.table(miningInfo);
    } catch (e) {
        console.log('\n⚠️  mining_claim_history 表不存在');
    }
    
    // 检查 user_power_cache 表
    try {
        const cacheInfo = db.prepare("PRAGMA table_info(user_power_cache)").all();
        console.log('\n📋 user_power_cache 表结构:');
        console.table(cacheInfo);
    } catch (e) {
        console.log('\n⚠️  user_power_cache 表不存在');
    }
    
    // 检查系统配置
    const config = db.prepare("SELECT * FROM system_config").all();
    console.log('\n⚙️  系统配置:');
    console.table(config);
    
    db.close();
    
    console.log('\n✅ 数据库修复完成！');
    
} catch (error: any) {
    console.error('\n❌ 数据库修复失败:', error.message);
    console.error(error.stack);
    process.exit(1);
}
