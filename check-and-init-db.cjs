const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🚀 [OTC DB] Starting database check and initialization...\n');

// 尝试定位数据库文件
const possibleDbPaths = [
  path.join(__dirname, 'src/database/eagle-swap.db'),
  path.join(__dirname, 'database/eagle-swap.db'),
  path.join(__dirname, 'dist/database/eagle-swap.db'),
  path.join(process.cwd(), 'src/database/eagle-swap.db'),
  path.join(process.cwd(), 'database/eagle-swap.db')
];

let dbPath = '';
for (const p of possibleDbPaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

// 如果找不到，使用默认路径（会自动创建）
if (!dbPath) {
  dbPath = path.join(__dirname, 'src/database/eagle-swap.db');
  console.log('⚠️  [OTC DB] Database file not found, will create at:', dbPath);
  
  // 确保目录存在
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('✅ [OTC DB] Created directory:', dbDir);
  }
} else {
  console.log('✅ [OTC DB] Found database at:', dbPath);
}

try {
  const db = new Database(dbPath);
  
  // 1. 检查所有 OTC 相关表
  console.log('\n📋 [OTC DB] Checking existing tables...');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name LIKE 'otc_%'
    ORDER BY name
  `).all();

  if (tables.length > 0) {
    console.log('✅ [OTC DB] Found OTC tables:', tables.map(t => t.name).join(', '));
  } else {
    console.log('⚠️  [OTC DB] No OTC tables found.');
  }

  // 2. 检查 otc_orders 表是否存在
  const otcOrdersExists = tables.some(t => t.name === 'otc_orders');
  
  if (otcOrdersExists) {
    console.log('\n✅ [OTC DB] Table "otc_orders" exists.');
    
    // 检查表结构
    const columns = db.prepare(`PRAGMA table_info(otc_orders)`).all();
    console.log('\n🏗️  [OTC DB] Table structure:');
    console.log('   Column Name          | Type       | Not Null');
    console.log('   ' + '-'.repeat(55));
    columns.forEach(col => {
      console.log(`   ${col.name.padEnd(20)} | ${col.type.padEnd(10)} | ${col.notnull ? 'YES' : 'NO'}`);
    });
    
    // 检查关键字段是否存在
    const hasSide = columns.some(c => c.name === 'side');
    const hasTokenSell = columns.some(c => c.name === 'token_sell');
    
    if (!hasSide || !hasTokenSell) {
      console.log('\n⚠️  [OTC DB] WARNING: Table exists but schema is outdated!');
      console.log('   Missing columns: side, token_sell, token_buy, etc.');
      console.log('   You may need to drop and recreate the table.');
    } else {
      console.log('\n✅ [OTC DB] Table schema is correct!');
    }
    
    // 检查记录数
    const count = db.prepare('SELECT COUNT(*) as count FROM otc_orders').get();
    console.log(`\n📊 [OTC DB] Current records: ${count.count}`);
    
  } else {
    console.log('\n⚠️  [OTC DB] Table "otc_orders" does NOT exist. Initializing...');
    
    // 3. 读取并执行 SQL 初始化脚本
    const sqlPath = path.join(__dirname, 'src/database/init_otc.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ [OTC DB] ERROR: init_otc.sql not found at:', sqlPath);
      console.log('   Please ensure the SQL file exists in src/database/');
      process.exit(1);
    }
    
    console.log('📄 [OTC DB] Reading SQL file:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('⚙️  [OTC DB] Executing SQL script...');
    db.exec(sql);
    
    console.log('✅ [OTC DB] Database initialized successfully!');
    
    // 验证表是否创建成功
    const newTables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'otc_%'
    `).all();
    
    console.log('\n📋 [OTC DB] Created tables:', newTables.map(t => t.name).join(', '));
  }
  
  db.close();
  console.log('\n🎉 [OTC DB] Database check completed successfully!\n');
  
} catch (error) {
  console.error('\n❌ [OTC DB] ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
}
