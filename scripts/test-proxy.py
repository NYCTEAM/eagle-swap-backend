#!/usr/bin/env python3
"""
测试代理是否可用
"""

import asyncio
import httpx
import sys

# 一些公开的免费代理（可能不稳定）
FREE_PROXIES = [
    "http://47.88.3.19:8080",
    "http://8.219.97.248:80",
    "http://47.74.152.29:8888",
    "http://20.111.54.16:8123",
    "http://47.91.45.198:8080",
]

async def test_proxy(proxy: str):
    """测试单个代理"""
    try:
        async with httpx.AsyncClient(proxy=proxy, timeout=10.0) as client:
            response = await client.get("https://api.ipify.org?format=json")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ {proxy} - 可用 (IP: {data.get('ip')})")
                return proxy
            else:
                print(f"❌ {proxy} - 状态码: {response.status_code}")
                return None
    except Exception as e:
        print(f"❌ {proxy} - 错误: {str(e)[:50]}")
        return None

async def find_working_proxy():
    """查找可用的代理"""
    print("🔍 正在测试代理...")
    print()
    
    tasks = [test_proxy(proxy) for proxy in FREE_PROXIES]
    results = await asyncio.gather(*tasks)
    
    working_proxies = [p for p in results if p is not None]
    
    print()
    if working_proxies:
        print(f"✅ 找到 {len(working_proxies)} 个可用代理:")
        for proxy in working_proxies:
            print(f"  {proxy}")
        print()
        print("使用方法:")
        print(f"  python3 scripts/twitter-login-twikit.py login adog_official cibihuang38@gmail.com dan12345678 /app/data/twitter_cookies.json {working_proxies[0]}")
    else:
        print("❌ 没有找到可用的代理")
        print()
        print("建议:")
        print("  1. 访问 https://free-proxy-list.net/ 获取最新代理")
        print("  2. 使用付费代理服务")
        print("  3. 在本地登录后上传 cookies")

if __name__ == "__main__":
    asyncio.run(find_working_proxy())
