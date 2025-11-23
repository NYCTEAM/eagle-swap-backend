# ============================================
# Eagle Swap 完整数据库初始化主脚本 (PowerShell)
# 执行所有模块化的 SQL 脚本
# ============================================

param(
    [string]$DbPath = "data/eagleswap.db"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "🚀 Eagle Swap 数据库初始化开始..." -ForegroundColor Green
Write-Host "📁 数据库路径: $DbPath"
Write-Host "📂 脚本目录: $ScriptDir"
Write-Host ""

# 备份现有数据库
if (Test-Path $DbPath) {
    $BackupPath = "$DbPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
    Write-Host "💾 备份现有数据库到: $BackupPath" -ForegroundColor Yellow
    Copy-Item $DbPath $BackupPath
    Write-Host "✅ 备份完成" -ForegroundColor Green
    Write-Host ""
}

# 删除旧数据库
if (Test-Path $DbPath) {
    Write-Host "🗑️  删除旧数据库..." -ForegroundColor Yellow
    Remove-Item $DbPath -Force
    Write-Host "✅ 删除完成" -ForegroundColor Green
    Write-Host ""
}

# 执行初始化脚本的顺序
$Scripts = @(
    "init_complete_database.sql",           # 核心表 (16个): NFT Mining + Swap Mining
    "init_otc.sql",                         # OTC 系统 (4个表)
    "nft_marketplace_schema.sql",           # NFT Marketplace (5个表)
    "add_community_creation_system.sql",    # Community 系统
    "schema-chart-data.sql",                # Chart 数据 (3个表)
    "schema-swap-history.sql"               # Swap History (3个表)
)

Write-Host "📋 将执行以下脚本:" -ForegroundColor Cyan
foreach ($script in $Scripts) {
    Write-Host "   - $script"
}
Write-Host ""

# 执行每个脚本
foreach ($script in $Scripts) {
    $ScriptPath = Join-Path $ScriptDir $script
    
    if (-not (Test-Path $ScriptPath)) {
        Write-Host "⚠️  警告: 脚本不存在: $script" -ForegroundColor Yellow
        Write-Host "   跳过..."
        Write-Host ""
        continue
    }
    
    Write-Host "▶️  执行: $script" -ForegroundColor Cyan
    try {
        Get-Content $ScriptPath -Raw | sqlite3 $DbPath
        Write-Host "✅ 完成: $script" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ 错误: $script 执行失败" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "🎉 数据库初始化完成!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""

# 验证表数量
Write-Host "📊 验证数据库..." -ForegroundColor Cyan
$TableCount = sqlite3 $DbPath "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"
Write-Host "✅ 总计表格数量: $TableCount" -ForegroundColor Green
Write-Host ""

# 显示所有表名
Write-Host "📋 所有表格列表:" -ForegroundColor Cyan
$Tables = sqlite3 $DbPath "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
foreach ($table in $Tables) {
    Write-Host "   - $table"
}
Write-Host ""

# 显示关键配置
Write-Host "⚙️  系统配置:" -ForegroundColor Cyan
$Configs = sqlite3 $DbPath "SELECT key, value FROM system_config WHERE key IN ('total_nft_supply', 'daily_mining_pool', 'nft_mining_allocation', 'swap_mining_allocation');"
foreach ($config in $Configs) {
    $parts = $config -split '\|'
    Write-Host "   $($parts[0]): $($parts[1])"
}
Write-Host ""

Write-Host "✨ 数据库已准备就绪!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 使用方法:" -ForegroundColor Yellow
Write-Host "   sqlite3 $DbPath"
Write-Host ""
