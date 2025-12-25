/**
 * Twitter 嵌入式时间线
 * 使用 Twitter 官方嵌入显示推文
 */

import React, { useState, useEffect } from 'react';
import TwitterEmbed from './TwitterEmbed';
import './TwitterEmbedTimeline.css';

interface Tweet {
  id: number;
  tweet_id: string;
  username: string;
  user_display_name: string;
  content: string;
  content_zh?: string;
  published_at: string;
}

interface PopularAccount {
  username: string;
  displayName: string;
  avatar: string | null;
}

interface TwitterEmbedTimelineProps {
  userAddress?: string;
  limit?: number;
}

export const TwitterEmbedTimeline: React.FC<TwitterEmbedTimelineProps> = ({ 
  userAddress, 
  limit = 50 
}) => {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popularAccounts, setPopularAccounts] = useState<PopularAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);

  useEffect(() => {
    fetchPopularAccounts();
  }, []);

  useEffect(() => {
    fetchTweets();
  }, [userAddress, limit, selectedAccount]);

  const fetchPopularAccounts = async () => {
    try {
      const response = await fetch('/api/twitter/popular-accounts');
      const data = await response.json();
      
      if (data.success) {
        setPopularAccounts(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch popular accounts:', err);
    }
  };

  const fetchTweets = async () => {
    try {
      setLoading(true);
      setError(null);

      let endpoint;
      if (userAddress) {
        endpoint = `/api/twitter/timeline/${userAddress}?limit=${limit}`;
      } else if (selectedAccount) {
        endpoint = `/api/twitter/all?limit=${limit}&username=${selectedAccount}`;
      } else {
        endpoint = `/api/twitter/all?limit=${limit}`;
      }

      const response = await fetch(endpoint);
      const data = await response.json();

      if (data.success) {
        setTweets(data.data);
      } else {
        setError(data.error || '获取推文失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
      console.error('Failed to fetch tweets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchTweets();
  };

  if (loading) {
    return (
      <div className="twitter-embed-timeline">
        <div className="timeline-header">
          <h2>推文时间线</h2>
        </div>
        <div className="timeline-loading">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="twitter-embed-timeline">
        <div className="timeline-header">
          <h2>推文时间线</h2>
        </div>
        <div className="timeline-error">
          <p>{error}</p>
          <button onClick={handleRefresh} className="retry-btn">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="twitter-embed-timeline">
      {/* 头部 */}
      <div className="timeline-header">
        <h2>{userAddress ? '我的时间线' : '热门推文'}</h2>
        <div className="timeline-controls">
          <button 
            onClick={() => setShowTranslation(!showTranslation)}
            className="toggle-translation-btn"
          >
            {showTranslation ? '隐藏翻译' : '显示翻译'}
          </button>
          <button onClick={handleRefresh} className="refresh-btn">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M4.5 12c0-4.14 3.36-7.5 7.5-7.5 1.71 0 3.28.58 4.54 1.55l-1.41 1.41C14.25 6.84 13.17 6.5 12 6.5c-3.03 0-5.5 2.47-5.5 5.5s2.47 5.5 5.5 5.5c2.47 0 4.57-1.64 5.27-3.89h2.05c-.76 3.36-3.75 5.89-7.32 5.89-4.14 0-7.5-3.36-7.5-7.5z"/>
            </svg>
            刷新
          </button>
        </div>
      </div>

      {/* 热门账号筛选标签 */}
      {!userAddress && popularAccounts.length > 0 && (
        <div className="account-filters">
          <button
            className={`account-filter-btn ${!selectedAccount ? 'active' : ''}`}
            onClick={() => setSelectedAccount(null)}
          >
            全部
          </button>
          {popularAccounts.map((account) => (
            <button
              key={account.username}
              className={`account-filter-btn ${selectedAccount === account.username ? 'active' : ''}`}
              onClick={() => setSelectedAccount(account.username)}
            >
              {account.displayName}
            </button>
          ))}
        </div>
      )}

      {/* 推文列表 - 使用 Twitter 嵌入 */}
      <div className="timeline-content">
        {tweets.length === 0 ? (
          <div className="timeline-empty">
            <p>暂无推文</p>
          </div>
        ) : (
          tweets.map((tweet) => (
            <div key={tweet.id} className="tweet-embed-wrapper">
              {/* Twitter 原生嵌入 */}
              <TwitterEmbed tweetId={tweet.tweet_id} theme="light" />
              
              {/* 中文翻译（如果有且开启） */}
              {showTranslation && tweet.content_zh && (
                <div className="tweet-translation">
                  <div className="translation-label">🌐 中文翻译：</div>
                  <div className="translation-content">{tweet.content_zh}</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 加载更多 */}
      {tweets.length >= limit && (
        <div className="timeline-footer">
          <button className="load-more-btn" onClick={() => {}}>
            加载更多
          </button>
        </div>
      )}
    </div>
  );
};

export default TwitterEmbedTimeline;
