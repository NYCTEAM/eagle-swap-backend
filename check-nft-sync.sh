#!/bin/bash

# NFT 同步检查脚本
# 用法: ./check-nft-sync.sh <container_id> <user_address>

CONTAINER_ID=${1:-"hocg04o8swccwggwc8kosc8g-113559378308"}
USER_ADDRESS=${2:-"0x4af7f86c70a6fba4ed9d49074d0805a3c63b1e5b"}

echo "🔍 检查 NFT 同步状态..."
echo "容器: $CONTAINER_ID"
echo "用户: $USER_ADDRESS"
echo ""

# 1. 检查容器是否运行
echo "1️⃣ 检查容器状态..."
docker ps | grep $CONTAINER_ID
if [ $? -ne 0 ]; then
    echo "❌ 容器未运行！"
    exit 1
fi
echo "✅ 容器正在运行"
echo ""

# 2. 检查 NFT 同步服务日志
echo "2️⃣ 检查 NFT 同步服务日志..."
docker logs $CONTAINER_ID --tail 100 | grep -i "nft sync"
echo ""

# 3. 查询数据库中的 NFT 数量
echo "3️⃣ 查询数据库中的 NFT..."
docker exec $CONTAINER_ID sh -c "sqlite3 data/eagleswap.db \"SELECT COUNT(*) as total FROM nft_ownership WHERE LOWER(owner_address) = LOWER('$USER_ADDRESS');\""
echo ""

# 4. 显示详细的 NFT 列表
echo "4️⃣ 用户的 NFT 详情..."
docker exec $CONTAINER_ID sh -c "sqlite3 -header -column data/eagleswap.db \"SELECT token_id, level, stage, effective_weight, datetime(minted_at) as minted FROM nft_ownership WHERE LOWER(owner_address) = LOWER('$USER_ADDRESS') ORDER BY token_id;\""
echo ""

# 5. 检查最新的 NFT 铸造事件
echo "5️⃣ 最近的 NFT 铸造记录..."
docker exec $CONTAINER_ID sh -c "sqlite3 -header -column data/eagleswap.db \"SELECT token_id, to_address, datetime(timestamp) as time FROM nft_transactions WHERE event_type = 'mint' ORDER BY timestamp DESC LIMIT 10;\""
echo ""

echo "✅ 检查完成！"
