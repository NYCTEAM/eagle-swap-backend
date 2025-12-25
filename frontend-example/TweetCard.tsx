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

      {/* 底部：互动按钮 */}
      <div className="tweet-actions">
        <button className="tweet-action-btn reply-btn">
          <svg viewBox="0 0 24 24">
            <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/>
          </svg>
          <span>{formatCount(tweet.reply_count)}</span>
        </button>

        <button className="tweet-action-btn retweet-btn">
          <svg viewBox="0 0 24 24">
            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/>
          </svg>
          <span>{formatCount(tweet.retweet_count)}</span>
        </button>

        <button className="tweet-action-btn like-btn">
          <svg viewBox="0 0 24 24">
            <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/>
          </svg>
          <span>{formatCount(tweet.like_count)}</span>
        </button>

        <button className="tweet-action-btn share-btn">
          <svg viewBox="0 0 24 24">
            <path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TweetCard;
