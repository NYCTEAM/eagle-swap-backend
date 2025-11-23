#!/bin/bash
# ============================================
# Eagle Swap 完整数据库初始化主脚本
# 执行所有模块化的 SQL 脚本
# ============================================

set -e  # 遇到错误立即退出

DB_PATH="${1:-/app/data/eagleswap.db}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Eagle Swap 数据库初始化开始..."
echo "📁 数据库路径: $DB_PATH"
echo "📂 脚本目录: $SCRIPT_DIR"
echo ""

# 备份现有数据库
if [ -f "$DB_PATH" ]; then
    BACKUP_PATH="${DB_PATH}.backup.$(date +%s)"
    echo "💾 备份现有数据库到: $BACKUP_PATH"
    cp "$DB_PATH" "$BACKUP_PATH"
    echo "✅ 备份完成"
    echo ""
fi

# 删除旧数据库
if [ -f "$DB_PATH" ]; then
    echo "🗑️  删除旧数据库..."
    rm -f "$DB_PATH"
    echo "✅ 删除完成"
    echo ""
fi

# 执行初始化脚本的顺序
SCRIPTS=(
    "init_complete_database.sql"     # 核心表 (16个): NFT Mining + Swap Mining
    "init_otc.sql"                   # OTC 系统 (4个表)
    "nft_marketplace_schema.sql"     # NFT Marketplace (5个表)
    "add_community_creation_system.sql"  # Community 系统
    "schema-chart-data.sql"          # Chart 数据 (3个表)
    "schema-swap-history.sql"        # Swap History (3个表)
)

echo "📋 将执行以下脚本:"
for script in "${SCRIPTS[@]}"; do
    echo "   - $script"
done
echo ""

# 执行每个脚本
for script in "${SCRIPTS[@]}"; do
    SCRIPT_PATH="$SCRIPT_DIR/$script"
    
    if [ ! -f "$SCRIPT_PATH" ]; then
        echo "⚠️  警告: 脚本不存在: $script"
        echo "   跳过..."
        echo ""
        continue
    fi
    
    echo "▶️  执行: $script"
    if sqlite3 "$DB_PATH" < "$SCRIPT_PATH" 2>&1; then
        echo "✅ 完成: $script"
    else
        echo "❌ 错误: $script 执行失败"
        exit 1
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 数据库初始化完成!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 验证表数量
echo "📊 验证数据库..."
TABLE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
echo "✅ 总计表格数量: $TABLE_COUNT"
echo ""

# 显示所有表名
echo "📋 所有表格列表:"
sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" | while read table; do
    echo "   - $table"
done
echo ""

# 显示关键配置
echo "⚙️  系统配置:"
sqlite3 "$DB_PATH" "SELECT key, value FROM system_config WHERE key IN ('total_nft_supply', 'daily_mining_pool', 'nft_mining_allocation', 'swap_mining_allocation');" | while IFS='|' read key value; do
    echo "   $key: $value"
done
echo ""

echo "✨ 数据库已准备就绪!"
echo ""
echo "💡 使用方法:"
echo "   sqlite3 $DB_PATH"
echo ""
