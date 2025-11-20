/**
 * OTC 数据库初始化脚本
 * 
 * 运行方式：
 * npm run init-otc-db
 * 或
 * ts-node src/scripts/init-otc-db.ts
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const dbPath = path.join(__dirname, '../database/eagle-swap.db');
const sqlPath = path.join(__dirname, '../database/init_otc.sql');

console.log('🚀 开始初始化 OTC 数据库...');
console.log(`📁 数据库路径: ${dbPath}`);
console.log(`📄 SQL 文件路径: ${sqlPath}`);

try {
  // 读取 SQL 文件
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  // 连接数据库
  const db = new Database(dbPath);
  
  console.log(`📊 执行 SQL 脚本...`);
  
  let successCount = 0;
  let skipCount = 0;
  
  // 直接执行整个 SQL 文件（better-sqlite3 支持多条语句）
  try {
    db.exec(sql);
    console.log(`✅ SQL 脚本执行成功`);
    successCount = 1;
  } catch (error: any) {
    // 如果有错误，尝试逐条执行
    console.log(`⚠️  批量执行失败，尝试逐条执行...`);
    
    // 更智能的 SQL 分割：保留完整的 CREATE 语句
    const statements: string[] = [];
    let currentStatement = '';
    let inCreateStatement = false;
    
    const lines = sql.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 跳过注释和空行
      if (trimmedLine.startsWith('--') || trimmedLine.length === 0) {
        continue;
      }
      
      // 检测 CREATE 语句开始
      if (trimmedLine.toUpperCase().startsWith('CREATE')) {
        inCreateStatement = true;
      }
      
      currentStatement += line + '\n';
      
      // 如果遇到分号且不在 CREATE 语句中，或者 CREATE 语句结束
      if (trimmedLine.endsWith(';')) {
        if (inCreateStatement && !trimmedLine.includes(')')) {
          // CREATE 语句还没结束
          continue;
        }
        
        statements.push(currentStatement.trim());
        currentStatement = '';
        inCreateStatement = false;
      }
    }
    
    // 执行每条语句
    let successCount = 0;
    let skipCount = 0;
    
    for (const statement of statements) {
      if (statement.length === 0) continue;
      
      try {
        db.exec(statement);
        successCount++;
      } catch (err: any) {
        if (err.message.includes('already exists')) {
          skipCount++;
        } else {
          console.error(`❌ 执行失败:`, err.message);
          console.error(`SQL: ${statement.substring(0, 100)}...`);
        }
      }
    }
    
    console.log(`✅ 逐条执行完成: 成功 ${successCount} 条, 跳过 ${skipCount} 条`);
  }
  
  console.log(`\n✅ 数据库初始化完成！`);
  console.log(`   成功执行: ${successCount} 条`);
  console.log(`   跳过: ${skipCount} 条`);
  
  // 验证表是否创建成功
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name LIKE 'otc_%'
    ORDER BY name
  `).all();
  
  console.log(`\n📋 OTC 相关表:`);
  tables.forEach((table: any) => {
    console.log(`   ✓ ${table.name}`);
  });
  
  // 验证视图是否创建成功
  const views = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='view' AND name LIKE 'v_%otc%'
    ORDER BY name
  `).all();
  
  if (views.length > 0) {
    console.log(`\n👁️  OTC 相关视图:`);
    views.forEach((view: any) => {
      console.log(`   ✓ ${view.name}`);
    });
  }
  
  // 检查初始数据
  const statsCount = db.prepare('SELECT COUNT(*) as count FROM otc_stats').get() as { count: number };
  console.log(`\n📊 统计数据表记录数: ${statsCount.count}`);
  
  db.close();
  console.log(`\n🎉 OTC 数据库初始化成功！`);
  
} catch (error) {
  console.error('❌ 初始化失败:', error);
  process.exit(1);
}
