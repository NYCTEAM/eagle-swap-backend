/**
 * 推文时间线组件
 * 展示推文列表
 */

import React, { useState, useEffect } from 'react';
import TweetCard from './TweetCard';
import './TweetTimeline.css';

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

interface TweetTimelineProps {
  userAddress?: string; // 如果提供，显示个性化时间线
  limit?: number;
}

export const TweetTimeline: React.FC<TweetTimelineProps> = ({ 
  userAddress, 
  limit = 50 
}) => {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);

  useEffect(() => {
    fetchTweets();
  }, [userAddress, limit]);

  const fetchTweets = async () => {
    try {
      setLoading(true);
      setError(null);

      // 根据是否有用户地址选择不同的 API
      const endpoint = userAddress 
        ? `/api/twitter/timeline/${userAddress}?limit=${limit}`
        : `/api/twitter/all?limit=${limit}`;

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
      <div className="tweet-timeline">
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
      <div className="tweet-timeline">
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
    <div className="tweet-timeline">
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
              <path d="M4.5 12c0-4.14 3.36-7.5 7.5-7.5 1.71 0 3.28.58 4.54 1.55l-1.41 1.41C14.25 6.84 13.17 6.5 12 6.5c-3.03 0-5.5 2.47-5.5 5.5s2.47 5.5 5.5 5.5c2.47 0 4.57-1.64 5.27-3.89h2.05c-.76 3.36-3.75 5.89-7.32 5.89-4.14 0-7.5-3.36-7.5-7.5zm14-1.5h-3l4-4 4 4h-3c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.39 0 4.57.94 6.19 2.47l-1.41 1.41C14.59 4.94 13.35 4.5 12 4.5c-4.14 0-7.5 3.36-7.5 7.5s3.36 7.5 7.5 7.5 7.5-3.36 7.5-7.5z"/>
            </svg>
            刷新
          </button>
        </div>
      </div>

      {/* 推文列表 */}
      <div className="timeline-content">
        {tweets.length === 0 ? (
          <div className="timeline-empty">
            <p>暂无推文</p>
            {userAddress && (
              <p className="empty-hint">
                关注一些 Twitter 账号开始查看推文
              </p>
            )}
          </div>
        ) : (
          tweets.map((tweet) => (
            <TweetCard 
              key={tweet.id} 
              tweet={tweet} 
              showTranslation={showTranslation}
            />
          ))
        )}
      </div>

      {/* 加载更多 */}
      {tweets.length >= limit && (
        <div className="timeline-footer">
          <button className="load-more-btn">
            加载更多
          </button>
        </div>
      )}
    </div>
  );
};

export default TweetTimeline;
