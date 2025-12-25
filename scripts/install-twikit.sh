#!/bin/bash
# 安装 Twikit 和依赖

echo "🔧 安装 Twikit..."

# 检查 Python3 是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，正在安装..."
    apt-get update
    apt-get install -y python3 python3-pip
fi

# 检查 pip3 是否安装
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 未安装，正在安装..."
    apt-get install -y python3-pip
fi

# 安装 twikit
echo "📦 安装 twikit..."
pip3 install twikit

# 验证安装
if python3 -c "import twikit" 2>/dev/null; then
    echo "✅ Twikit 安装成功!"
    python3 -c "import twikit; print(f'版本: {twikit.__version__}')"
else
    echo "❌ Twikit 安装失败!"
    exit 1
fi

echo ""
echo "🎉 安装完成!"
echo ""
echo "使用方法:"
echo "  node scripts/twitter-twikit-wrapper.js login <username> <email> <password>"
echo "  node scripts/twitter-twikit-wrapper.js verify"
