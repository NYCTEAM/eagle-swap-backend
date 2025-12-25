#!/usr/bin/env python3
"""
使用 Twikit 获取 Twitter 用户的推文
"""

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime

try:
    from twikit import Client
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "twikit not installed. Run: pip3 install twikit"
    }))
    sys.exit(1)


async def fetch_user_tweets(username: str, cookies_file: str, limit: int = 50):
    """
    获取指定用户的推文
    
    Args:
        username: Twitter 用户名（不带 @）
        cookies_file: Cookie 文件路径
        limit: 获取推文数量
    """
    try:
        # 初始化客户端
        client = Client('en-US')
        
        # 检查 cookies 文件是否存在
        if not Path(cookies_file).exists():
            return {
                "success": False,
                "error": f"Cookies file not found: {cookies_file}"
            }
        
        # 加载 cookies
        client.load_cookies(cookies_file)
        
        # 获取用户信息
        user = await client.get_user_by_screen_name(username)
        
        # 获取用户推文
        tweets = await client.get_user_tweets(user.id, 'Tweets', count=limit)
        
        # 格式化推文数据
        tweet_list = []
        for tweet in tweets:
            tweet_data = {
                "id": tweet.id,
                "text": tweet.text,
                "created_at": tweet.created_at,
                "user": {
                    "id": tweet.user.id,
                    "name": tweet.user.name,
                    "screen_name": tweet.user.screen_name,
                },
                "retweet_count": getattr(tweet, 'retweet_count', 0),
                "favorite_count": getattr(tweet, 'favorite_count', 0),
                "reply_count": getattr(tweet, 'reply_count', 0),
                "view_count": getattr(tweet, 'view_count', 0),
            }
            
            # 添加媒体信息（如果有）
            if hasattr(tweet, 'media') and tweet.media:
                tweet_data['media'] = [
                    {
                        "type": media.type,
                        "url": media.media_url_https if hasattr(media, 'media_url_https') else None
                    }
                    for media in tweet.media
                ]
            
            tweet_list.append(tweet_data)
        
        return {
            "success": True,
            "username": username,
            "user_id": user.id,
            "count": len(tweet_list),
            "tweets": tweet_list
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "username": username
        }


async def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python fetch-tweets-twikit.py <username> <cookies_file> [limit]"
        }))
        sys.exit(1)
    
    username = sys.argv[1].lstrip('@')  # 移除 @ 符号
    cookies_file = sys.argv[2]
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 50
    
    result = await fetch_user_tweets(username, cookies_file, limit)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
