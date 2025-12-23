# Coolify容器路径检查脚本 (PowerShell版本)
# 用于检查容器内的文件路径和环境变量

$CONTAINER_ID = "hocg04o8swccwggwc8kosc8g-071228411218"

Write-Host "🔍 检查Coolify容器路径和环境" -ForegroundColor Cyan
Write-Host "容器ID: $CONTAINER_ID" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Gray

# 1. 检查容器是否运行
Write-Host ""
Write-Host "1️⃣ 检查容器状态..." -ForegroundColor Green
docker ps | Select-String $CONTAINER_ID

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 容器未运行！" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 容器正在运行" -ForegroundColor Green

# 2. 检查当前工作目录
Write-Host ""
Write-Host "2️⃣ 检查工作目录..." -ForegroundColor Green
docker exec $CONTAINER_ID pwd

# 3. 列出根目录
Write-Host ""
Write-Host "3️⃣ 列出根目录..." -ForegroundColor Green
docker exec $CONTAINER_ID ls -la /

# 4. 检查 /app 目录
Write-Host ""
Write-Host "4️⃣ 检查 /app 目录..." -ForegroundColor Green
docker exec $CONTAINER_ID ls -la /app

# 5. 查找NFT相关文件
Write-Host ""
Write-Host "5️⃣ 查找NFT签名工具..." -ForegroundColor Green
docker exec $CONTAINER_ID sh -c "find /app -name '*nft*signature*.js' -o -name '*nft*signer*.js' 2>/dev/null"

# 6. 检查环境变量
Write-Host ""
Write-Host "6️⃣ 检查关键环境变量..." -ForegroundColor Green

$signerKey = docker exec $CONTAINER_ID printenv SIGNER_PRIVATE_KEY
if ($signerKey) {
    Write-Host "SIGNER_PRIVATE_KEY: $($signerKey.Substring(0, [Math]::Min(10, $signerKey.Length)))..." -ForegroundColor Yellow
} else {
    Write-Host "SIGNER_PRIVATE_KEY: ❌ 未设置" -ForegroundColor Red
}

$ownerKey = docker exec $CONTAINER_ID printenv OWNER_PRIVATE_KEY
if ($ownerKey) {
    Write-Host "OWNER_PRIVATE_KEY: $($ownerKey.Substring(0, [Math]::Min(10, $ownerKey.Length)))..." -ForegroundColor Yellow
} else {
    Write-Host "OWNER_PRIVATE_KEY: ❌ 未设置" -ForegroundColor Red
}

Write-Host "XLAYER_RPC_URL: $(docker exec $CONTAINER_ID printenv XLAYER_RPC_URL)" -ForegroundColor Yellow
Write-Host "BSC_RPC_URL: $(docker exec $CONTAINER_ID printenv BSC_RPC_URL)" -ForegroundColor Yellow
Write-Host "XLAYER_NFT_ADDRESS: $(docker exec $CONTAINER_ID printenv XLAYER_NFT_ADDRESS)" -ForegroundColor Yellow
Write-Host "BSC_NFT_ADDRESS: $(docker exec $CONTAINER_ID printenv BSC_NFT_ADDRESS)" -ForegroundColor Yellow

# 7. 检查Node.js版本
Write-Host ""
Write-Host "7️⃣ 检查Node.js版本..." -ForegroundColor Green
docker exec $CONTAINER_ID node --version

# 8. 检查package.json
Write-Host ""
Write-Host "8️⃣ 检查package.json位置..." -ForegroundColor Green
docker exec $CONTAINER_ID sh -c "find /app -name 'package.json' -type f 2>/dev/null | head -5"

# 9. 检查dist目录
Write-Host ""
Write-Host "9️⃣ 检查编译后的文件..." -ForegroundColor Green
docker exec $CONTAINER_ID ls -la /app/dist 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ /app/dist 不存在" -ForegroundColor Red
}

# 10. 尝试运行诊断脚本
Write-Host ""
Write-Host "🔟 尝试运行NFT签名诊断..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Gray
docker exec $CONTAINER_ID node /app/test-all-nft-signatures.js 2>&1 | Select-Object -First 50

Write-Host ""
Write-Host "========================================" -ForegroundColor Gray
Write-Host "✅ 检查完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📝 快速命令：" -ForegroundColor Cyan
Write-Host "进入容器: docker exec -it $CONTAINER_ID bash" -ForegroundColor Yellow
Write-Host "运行诊断: docker exec $CONTAINER_ID node /app/test-all-nft-signatures.js" -ForegroundColor Yellow
Write-Host "更新签名: docker exec $CONTAINER_ID node /app/update-all-nft-signers.js" -ForegroundColor Yellow
