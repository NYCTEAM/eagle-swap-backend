#!/bin/bash

# 一键更新NFT签名地址 (在Coolify容器内)

CONTAINER_ID="hocg04o8swccwggwc8kosc8g-071228411218"

echo "🔧 更新NFT签名地址..."
echo "容器ID: $CONTAINER_ID"
echo ""

# 直接在容器内运行
docker exec $CONTAINER_ID node /app/update-all-nft-signers.js
