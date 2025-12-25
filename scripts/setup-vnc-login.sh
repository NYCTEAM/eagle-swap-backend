#!/bin/bash
# 在服务器上设置 VNC 以便手动登录 Twitter
# 使用方法：
# 1. 在服务器容器中运行此脚本
# 2. 使用 VNC 客户端连接到 localhost:5900
# 3. 在 VNC 窗口中手动登录 Twitter
# 4. 按 Ctrl+C 停止脚本，Cookie 会自动保存

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Twitter VNC 登录助手 - Eagle Swap                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 检查是否已安装必要的包
echo "📦 检查依赖..."
if ! command -v Xvfb &> /dev/null; then
    echo "⚠️ Xvfb 未安装，正在安装..."
    apt-get update -qq
    apt-get install -y xvfb x11vnc
fi

# 启动虚拟显示器
echo "🖥️ 启动虚拟显示器..."
export DISPLAY=:99
Xvfb :99 -screen 0 1280x800x24 &
XVFB_PID=$!
sleep 2

# 启动 VNC 服务器
echo "📡 启动 VNC 服务器..."
echo "   VNC 端口: 5900"
echo "   密码: twitter123"
x11vnc -display :99 -passwd twitter123 -forever -shared &
VNC_PID=$!
sleep 2

echo ""
echo "✅ VNC 服务器已启动！"
echo ""
echo "📋 连接步骤："
echo "   1. 在本地电脑安装 VNC 客户端（如 RealVNC Viewer）"
echo "   2. SSH 端口转发："
echo "      ssh -L 5900:localhost:5900 your-server"
echo "   3. 使用 VNC 客户端连接到 localhost:5900"
echo "   4. 密码: twitter123"
echo ""
echo "🚀 启动浏览器..."

# 启动 Chromium 浏览器
cd /app
node -e "
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('');
  console.log('🌐 打开 Twitter 登录页面...');
  console.log('   请在 VNC 窗口中手动登录');
  console.log('');
  console.log('⏸️  登录完成后，按 Ctrl+C 停止脚本');
  console.log('   Cookie 会自动保存到 /app/data/x_state.json');
  console.log('');
  
  await page.goto('https://x.com/i/flow/login');
  
  // 等待用户按 Ctrl+C
  process.on('SIGINT', async () => {
    console.log('');
    console.log('💾 保存 Cookie...');
    const cookies = await context.cookies();
    fs.writeFileSync('/app/data/x_state.json', JSON.stringify(cookies, null, 2));
    console.log(\`✅ 已保存 \${cookies.length} 个 Cookie\`);
    
    await browser.close();
    process.exit(0);
  });
  
  // 保持运行
  await new Promise(() => {});
})();
"

# 清理
kill $XVFB_PID $VNC_PID 2>/dev/null
