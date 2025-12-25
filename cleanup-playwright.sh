#!/bin/bash

# 清理 Playwright 缓存脚本
# 释放 ~300MB 磁盘空间

echo "🧹 Cleaning up Playwright cache..."

# 清理 Playwright 浏览器缓存
if [ -d "$HOME/.cache/ms-playwright" ]; then
    echo "📦 Found Playwright cache at $HOME/.cache/ms-playwright"
    du -sh "$HOME/.cache/ms-playwright"
    rm -rf "$HOME/.cache/ms-playwright"
    echo "✅ Playwright cache removed"
else
    echo "⚠️ No Playwright cache found at $HOME/.cache/ms-playwright"
fi

# 清理 /root/.cache/ms-playwright (Docker 容器内)
if [ -d "/root/.cache/ms-playwright" ]; then
    echo "📦 Found Playwright cache at /root/.cache/ms-playwright"
    du -sh "/root/.cache/ms-playwright"
    rm -rf "/root/.cache/ms-playwright"
    echo "✅ Playwright cache removed"
fi

# 清理旧的 Docker 镜像
echo ""
echo "🐳 Cleaning up old Docker images..."
docker image prune -a -f --filter "until=24h"

# 清理未使用的 Docker 容器
echo ""
echo "🗑️ Cleaning up stopped containers..."
docker container prune -f

# 清理未使用的 Docker 卷
echo ""
echo "💾 Cleaning up unused volumes..."
docker volume prune -f

# 显示清理后的磁盘空间
echo ""
echo "📊 Disk space after cleanup:"
df -h /

echo ""
echo "✅ Cleanup completed!"
