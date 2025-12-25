/**
 * Twitter 原生嵌入组件
 * 使用 Twitter 官方的嵌入式推文显示
 */

import React, { useEffect, useRef } from 'react';

interface TwitterEmbedProps {
  tweetId: string;
  theme?: 'light' | 'dark';
}

export const TwitterEmbed: React.FC<TwitterEmbedProps> = ({ 
  tweetId, 
  theme = 'light' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 加载 Twitter 嵌入脚本
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    document.body.appendChild(script);

    return () => {
      // 清理脚本
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    // 当推文 ID 改变时，重新渲染嵌入内容
    if (containerRef.current && (window as any).twttr) {
      (window as any).twttr.widgets.load(containerRef.current);
    }
  }, [tweetId]);

  return (
    <div ref={containerRef} className="twitter-embed-container">
      <blockquote 
        className="twitter-tweet" 
        data-theme={theme}
        data-dnt="true"
      >
        <a href={`https://twitter.com/x/status/${tweetId}`}>
          Loading tweet...
        </a>
      </blockquote>
    </div>
  );
};

export default TwitterEmbed;
