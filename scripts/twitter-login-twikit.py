#!/usr/bin/env python3
"""
Twitter Login using Twikit
更可靠的 Twitter 登录方案
"""

import asyncio
import json
import sys
import os
from pathlib import Path

try:
    from twikit import Client
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "twikit not installed. Run: pip3 install twikit"
    }))
    sys.exit(1)


async def login_twitter(username: str, email: str, password: str, cookies_file: str, proxy: str = None):
    """
    使用 Twikit 登录 Twitter
    
    Args:
        username: Twitter 用户名
        email: Twitter 邮箱
        password: Twitter 密码
        cookies_file: Cookie 保存路径
        proxy: 代理地址 (可选)，格式: http://host:port 或 socks5://host:port
    """
    try:
        # 初始化客户端
        client = Client('en-US', proxy=proxy)
        
        # 尝试登录
        await client.login(
            auth_info_1=username,
            auth_info_2=email,
            password=password
        )
        
        # 保存 cookies
        cookies_dir = Path(cookies_file).parent
        cookies_dir.mkdir(parents=True, exist_ok=True)
        
        # 获取 cookies 并保存
        client.save_cookies(cookies_file)
        
        # 验证登录
        user = await client.user()
        
        return {
            "success": True,
            "user": {
                "id": user.id,
                "name": user.name,
                "screen_name": user.screen_name
            },
            "cookies_file": cookies_file
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def verify_cookies(cookies_file: str):
    """
    验证 cookies 是否有效
    
    Args:
        cookies_file: Cookie 文件路径
    """
    try:
        if not os.path.exists(cookies_file):
            return {
                "success": False,
                "error": "Cookies file not found"
            }
        
        # 初始化客户端
        client = Client('en-US')
        
        # 加载 cookies
        client.load_cookies(cookies_file)
        
        # 验证登录状态
        user = await client.user()
        
        return {
            "success": True,
            "user": {
                "id": user.id,
                "name": user.name,
                "screen_name": user.screen_name
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def main():
    """主函数"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python twitter-login-twikit.py <command> [args...]"
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "login":
        if len(sys.argv) < 6:
            print(json.dumps({
                "success": False,
                "error": "Usage: python twitter-login-twikit.py login <username> <email> <password> <cookies_file> [proxy]"
            }))
            sys.exit(1)
        
        username = sys.argv[2]
        email = sys.argv[3]
        password = sys.argv[4]
        cookies_file = sys.argv[5]
        proxy = sys.argv[6] if len(sys.argv) > 6 else None
        
        result = await login_twitter(username, email, password, cookies_file, proxy)
        print(json.dumps(result, indent=2))
        
    elif command == "verify":
        if len(sys.argv) < 3:
            print(json.dumps({
                "success": False,
                "error": "Usage: python twitter-login-twikit.py verify <cookies_file>"
            }))
            sys.exit(1)
        
        cookies_file = sys.argv[2]
        result = await verify_cookies(cookies_file)
        print(json.dumps(result, indent=2))
        
    else:
        print(json.dumps({
            "success": False,
            "error": f"Unknown command: {command}"
        }))
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
