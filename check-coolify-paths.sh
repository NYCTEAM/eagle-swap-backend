#!/bin/bash

# Coolify容器路径检查脚本
# 用于检查容器内的文件路径和环境变量

CONTAINER_ID="hocg04o8swccwggwc8kosc8g-071228411218"

echo "🔍 检查Coolify容器路径和环境"
echo "容器ID: $CONTAINER_ID"
echo "========================================"

# 1. 检查容器是否运行
echo ""
echo "1️⃣ 检查容器状态..."
docker ps | grep $CONTAINER_ID

if [ $? -ne 0 ]; then
    echo "❌ 容器未运行！"
    exit 1
fi

echo "✅ 容器正在运行"

# 2. 检查当前工作目录
echo ""
echo "2️⃣ 检查工作目录..."
docker exec $CONTAINER_ID pwd

# 3. 列出根目录
echo ""
echo "3️⃣ 列出根目录..."
docker exec $CONTAINER_ID ls -la /

# 4. 检查 /app 目录
echo ""
echo "4️⃣ 检查 /app 目录..."
docker exec $CONTAINER_ID ls -la /app | head -20

# 5. 查找NFT相关文件
echo ""
echo "5️⃣ 查找NFT签名工具..."
docker exec $CONTAINER_ID find /app -name "*nft*signature*.js" -o -name "*nft*signer*.js" 2>/dev/null

# 6. 检查环境变量
echo ""
echo "6️⃣ 检查关键环境变量..."
echo "SIGNER_PRIVATE_KEY: $(docker exec $CONTAINER_ID printenv SIGNER_PRIVATE_KEY | cut -c1-10)..."
echo "OWNER_PRIVATE_KEY: $(docker exec $CONTAINER_ID printenv OWNER_PRIVATE_KEY | cut -c1-10)..."
echo "XLAYER_RPC_URL: $(docker exec $CONTAINER_ID printenv XLAYER_RPC_URL)"
echo "BSC_RPC_URL: $(docker exec $CONTAINER_ID printenv BSC_RPC_URL)"
echo "XLAYER_NFT_ADDRESS: $(docker exec $CONTAINER_ID printenv XLAYER_NFT_ADDRESS)"
echo "BSC_NFT_ADDRESS: $(docker exec $CONTAINER_ID printenv BSC_NFT_ADDRESS)"

# 7. 检查Node.js版本
echo ""
echo "7️⃣ 检查Node.js版本..."
docker exec $CONTAINER_ID node --version

# 8. 检查package.json
echo ""
echo "8️⃣ 检查package.json位置..."
docker exec $CONTAINER_ID find /app -name "package.json" -type f 2>/dev/null | head -5

# 9. 检查dist目录
echo ""
echo "9️⃣ 检查编译后的文件..."
docker exec $CONTAINER_ID ls -la /app/dist 2>/dev/null || echo "❌ /app/dist 不存在"

# 10. 尝试运行诊断脚本
echo ""
echo "🔟 尝试运行NFT签名诊断..."
echo "========================================"
docker exec $CONTAINER_ID node /app/test-all-nft-signatures.js 2>&1 | head -50

echo ""
echo "========================================"
echo "✅ 检查完成！"
echo ""
echo "📝 快速命令："
echo "进入容器: docker exec -it $CONTAINER_ID bash"
echo "运行诊断: docker exec $CONTAINER_ID node /app/test-all-nft-signatures.js"
echo "更新签名: docker exec $CONTAINER_ID node /app/update-all-nft-signers.js"
