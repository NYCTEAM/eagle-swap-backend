# 🎯 节点等级数据库配置指南

## 📊 节点配置（975,000 USDT 方案）

根据白皮书 `NODE_PRICING_REVISED.md`，已创建完整的节点等级配置。

---

## 📁 文件位置

```
eagle-swap-backend/
└── src/
    └── database/
        ├── schema.sql                    # 主数据库结构
        └── init_node_levels.sql          # 节点等级初始化数据 ✅ 新增
```

---

## 🚀 如何将数据写入数据库

### 方法 1: 使用 SQLite 命令行（推荐）

```bash
# 进入后端目录
cd eagle-swap-backend

# 执行 SQL 文件
sqlite3 eagle_swap.db < src/database/init_node_levels.sql
```

### 方法 2: 使用 Node.js 脚本

创建 `scripts/init-node-levels.js`:

```javascript
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('./eagle_swap.db');

const sql = fs.readFileSync(
  path.join(__dirname, '../src/database/init_node_levels.sql'),
  'utf8'
);

db.exec(sql, (err) => {
  if (err) {
    console.error('❌ Error initializing node levels:', err);
  } else {
    console.log('✅ Node levels initialized successfully!');
  }
  db.close();
});
```

运行脚本：
```bash
node scripts/init-node-levels.js
```

### 方法 3: 在后端启动时自动初始化

修改 `src/database/init.js`:

```javascript
const fs = require('fs');
const path = require('path');

async function initDatabase(db) {
  // 初始化主表结构
  const schema = fs.readFileSync(
    path.join(__dirname, 'schema.sql'),
    'utf8'
  );
  await db.exec(schema);

  // 初始化节点等级数据
  const nodeLevels = fs.readFileSync(
    path.join(__dirname, 'init_node_levels.sql'),
    'utf8'
  );
  await db.exec(nodeLevels);

  console.log('✅ Database initialized with node levels');
}
```

---

## 📋 节点等级数据

| ID | 名称 | Emoji | 价格 | 算力 | 供应量 | 筹集资金 |
|----|------|-------|------|------|--------|---------|
| 1 | Micro Node | 🪙 | 10 USDT | 0.1x | 5,000 | 50,000 |
| 2 | Mini Node | ⚪ | 25 USDT | 0.3x | 3,000 | 75,000 |
| 3 | Bronze Node | 🥉 | 50 USDT | 0.5x | 2,000 | 100,000 |
| 4 | Silver Node | 🥈 | 100 USDT | 1x | 1,500 | 150,000 |
| 5 | Gold Node | 🥇 | 250 USDT | 3x | 800 | 200,000 |
| 6 | Platinum Node | 💎 | 500 USDT | 7x | 400 | 200,000 |
| 7 | Diamond Node | 💠 | 1,000 USDT | 15x | 200 | 200,000 |

**总计**: 12,900 个节点，筹集 975,000 USDT

---

## 📋 销售阶段数据

| 阶段 | 节点数量 | 难度系数 | 奖励比例 |
|------|---------|---------|---------|
| 1 | 3,000 | 1.0 | 100% |
| 2 | 3,000 | 0.9 | 90% |
| 3 | 2,400 | 0.8 | 80% |
| 4 | 2,400 | 0.7 | 70% |
| 5 | 2,100 | 0.6 | 60% |

**总计**: 12,900 个节点

---

## ✅ 验证数据

执行 SQL 文件后，运行以下查询验证：

```sql
-- 查看所有节点等级
SELECT * FROM node_levels ORDER BY id;

-- 查看总计
SELECT 
    SUM(max_supply) as total_nodes,
    SUM(price_usdt * max_supply) as total_raised_usdt
FROM node_levels;

-- 查看销售阶段
SELECT * FROM sale_stages ORDER BY stage;
```

预期结果：
- ✅ 7 个节点等级
- ✅ 总节点数: 12,900
- ✅ 总筹集: 975,000 USDT
- ✅ 5 个销售阶段

---

## 🔄 更新后端 API

确保后端 API 路由使用数据库数据：

```javascript
// src/routes/nodes.js
router.get('/levels', async (req, res) => {
  try {
    const levels = await db.all(`
      SELECT 
        id,
        name,
        emoji,
        price_usdt as price,
        power,
        max_supply,
        minted,
        (max_supply - minted) as remaining,
        CAST(minted AS REAL) / max_supply * 100 as percentage
      FROM node_levels
      ORDER BY id
    `);

    res.json({
      success: true,
      data: levels
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## 🎯 下一步

1. ✅ 执行 `init_node_levels.sql` 初始化数据库
2. ✅ 验证数据是否正确写入
3. ✅ 启动后端服务器
4. ✅ 测试 API 端点 `GET /api/nodes/levels`
5. ✅ 前端连接后端获取实时数据

---

## 📝 注意事项

- ✅ 使用 `INSERT OR REPLACE` 确保可以重复执行
- ✅ 包含索引优化查询性能
- ✅ 包含验证查询确保数据正确
- ✅ 与前端配置完全一致

---

**🎨 数据库配置完成！现在可以将节点数据写入数据库了！✨**
