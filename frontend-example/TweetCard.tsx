/**
 * Twitter 风格的推文卡片组件
 * 支持中英文显示和引用推文
 */

import React from 'react';
import './TweetCard.css';

interface Tweet {
  id: number;
  tweet_id: string;
  username: string;
  user_display_name: string;
  user_avatar?: string;
  content: string;
  content_zh?: string;
  tweet_url: string;
  retweet_count?: number;
  like_count?: number;
  reply_count?: number;
  is_reply: number;
  reply_to_username?: string;
  quoted_tweet_id?: string;
  quoted_tweet_content?: string;
  quoted_tweet_content_zh?: string;
  quoted_tweet_author?: string;
  published_at: string;
}

interface TweetCardProps {
  tweet: Tweet;
  showTranslation?: boolean; // 是否显示翻译
}

export const TweetCard: React.FC<TweetCardProps> = ({ 
  tweet, 
  showTranslation = true 
}) => {
  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else {
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // 格式化数字（17.1K）
  const formatCount = (count?: number) => {
    if (!count) return '0';
    if (count < 1000) return count.toString();
    if (count < 10000) return (count / 1000).toFixed(1) + 'K';
    if (count < 1000000) return Math.floor(count / 1000) + 'K';
    return (count / 1000000).toFixed(1) + 'M';
  };

  // 获取用户头像
  const getAvatar = () => {
    if (tweet.user_avatar) return tweet.user_avatar;
    // 默认头像：使用用户名首字母
    const initial = tweet.username.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${initial}&background=1DA1F2&color=fff&size=128`;
  };

  return (
    <div className="tweet-card">
      {/* 头部：用户信息 */}
      <div className="tweet-header">
        <img 
          src={getAvatar()} 
          alt={tweet.user_display_name}
          className="tweet-avatar"
        />
        <div className="tweet-user-info">
          <div className="tweet-user-name">
            {tweet.user_display_name}
            {/* 认证标志 */}
            {['binance', 'cz_binance', 'elonmusk', 'VitalikButerin'].includes(tweet.username) && (
              <svg className="verified-badge" viewBox="0 0 24 24">
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/>
              </svg>
            )}
          </div>
          <div className="tweet-username">@{tweet.username}</div>
        </div>
        <div className="tweet-time">{formatTime(tweet.published_at)}</div>
        <a 
          href={tweet.tweet_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="tweet-link-icon"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>
      </div>

      {/* 内容：推文文本 */}
      <div className="tweet-content">
        {/* 如果是回复 */}
        {tweet.is_reply === 1 && tweet.reply_to_username && (
          <div className="tweet-reply-to">
            回复 <span className="mention">@{tweet.reply_to_username}</span>
          </div>
        )}

        {/* 原文 */}
        <p className="tweet-text">{tweet.content}</p>

        {/* 中文翻译 */}
        {showTranslation && tweet.content_zh && tweet.content_zh !== tweet.content && (
          <p className="tweet-text-zh">
            <span className="translation-label">翻译：</span>
            {tweet.content_zh}
          </p>
        )}

        {/* 引用推文 */}
        {tweet.quoted_tweet_id && (
          <div className="quoted-tweet">
            <div className="quoted-tweet-header">
              <span className="quoted-author">@{tweet.quoted_tweet_author}</span>
            </div>
            <p className="quoted-text">{tweet.quoted_tweet_content}</p>
            {showTranslation && tweet.quoted_tweet_content_zh && (
              <p className="quoted-text-zh">
                <span className="translation-label">翻译：</span>
                {tweet.quoted_tweet_content_zh}
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default TweetCard;
