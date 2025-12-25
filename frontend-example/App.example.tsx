/**
 * 完整的应用示例
 * 展示如何在 React 应用中使用推文组件
 */

import React, { useState } from 'react';
import TweetTimeline from './TweetTimeline';
import './App.css';

function App() {
  const [userAddress, setUserAddress] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 模拟登录
  const handleLogin = () => {
    // 这里应该连接 MetaMask 或其他钱包
    const mockAddress = '0x1234567890abcdef1234567890abcdef12345678';
    setUserAddress(mockAddress);
    setIsLoggedIn(true);
  };

  // 登出
  const handleLogout = () => {
    setUserAddress('');
    setIsLoggedIn(false);
  };

  return (
    <div className="app">
      {/* 顶部导航栏 */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-logo">🦅 Eagle Swap</h1>
          <nav className="app-nav">
            <a href="#home">首页</a>
            <a href="#swap">交易</a>
            <a href="#twitter" className="active">推文</a>
            <a href="#nft">NFT</a>
          </nav>
          <div className="header-actions">
            {isLoggedIn ? (
              <>
                <span className="user-address">
                  {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                </span>
                <button onClick={handleLogout} className="logout-btn">
                  登出
                </button>
              </>
            ) : (
              <button onClick={handleLogin} className="connect-btn">
                连接钱包
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="app-main">
        <div className="main-container">
          {/* 左侧边栏 */}
          <aside className="sidebar left-sidebar">
            <div className="sidebar-section">
              <h3>热门话题</h3>
              <ul className="trending-list">
                <li>
                  <span className="trend-tag">#Bitcoin</span>
                  <span className="trend-count">12.5K 推文</span>
                </li>
                <li>
                  <span className="trend-tag">#Ethereum</span>
                  <span className="trend-count">8.3K 推文</span>
                </li>
                <li>
                  <span className="trend-tag">#DeFi</span>
                  <span className="trend-count">5.7K 推文</span>
                </li>
                <li>
                  <span className="trend-tag">#NFT</span>
                  <span className="trend-count">4.2K 推文</span>
                </li>
              </ul>
            </div>
          </aside>

          {/* 中间：推文时间线 */}
          <div className="main-content">
            {isLoggedIn ? (
              <>
                <div className="timeline-tabs">
                  <button className="tab-btn active">我的时间线</button>
                  <button className="tab-btn">热门推文</button>
                </div>
                <TweetTimeline 
                  userAddress={userAddress} 
                  limit={20} 
                />
              </>
            ) : (
              <>
                <div className="welcome-banner">
                  <h2>欢迎来到 Eagle Swap 推文时间线</h2>
                  <p>连接钱包以查看个性化推文</p>
                </div>
                <TweetTimeline limit={50} />
              </>
            )}
          </div>

          {/* 右侧边栏 */}
          <aside className="sidebar right-sidebar">
            <div className="sidebar-section">
              <h3>推荐关注</h3>
              <ul className="follow-suggestions">
                <li className="suggestion-item">
                  <img 
                    src="https://ui-avatars.com/api/?name=CZ&background=1DA1F2&color=fff" 
                    alt="CZ"
                    className="suggestion-avatar"
                  />
                  <div className="suggestion-info">
                    <div className="suggestion-name">
                      CZ 🔶 BNB
                      <svg className="verified-badge" viewBox="0 0 24 24" width="16" height="16">
                        <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/>
                      </svg>
                    </div>
                    <div className="suggestion-username">@cz_binance</div>
                  </div>
                  <button className="follow-btn">关注</button>
                </li>
                <li className="suggestion-item">
                  <img 
                    src="https://ui-avatars.com/api/?name=V&background=1DA1F2&color=fff" 
                    alt="Vitalik"
                    className="suggestion-avatar"
                  />
                  <div className="suggestion-info">
                    <div className="suggestion-name">
                      Vitalik Buterin
                      <svg className="verified-badge" viewBox="0 0 24 24" width="16" height="16">
                        <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/>
                      </svg>
                    </div>
                    <div className="suggestion-username">@VitalikButerin</div>
                  </div>
                  <button className="follow-btn">关注</button>
                </li>
              </ul>
            </div>

            <div className="sidebar-section">
              <h3>统计信息</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value">1,234</div>
                  <div className="stat-label">总推文</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">5</div>
                  <div className="stat-label">关注账号</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">24h</div>
                  <div className="stat-label">更新频率</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* 底部 */}
      <footer className="app-footer">
        <p>&copy; 2025 Eagle Swap. All rights reserved.</p>
        <div className="footer-links">
          <a href="#terms">服务条款</a>
          <a href="#privacy">隐私政策</a>
          <a href="#contact">联系我们</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
