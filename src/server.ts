import dotenv from 'dotenv';
import path from 'path';
import { app } from './app';
import { initializeDatabase } from './database/init';
import newsFeedService from './services/newsFeedService';
import twitterMonitorService from './services/twitterMonitorService';
// 图表功能已移除 - 不需要价格收集服务
// import { priceCollector } from './services/priceCollector';
// import { hotPairsMonitor } from './services/hotPairsMonitor';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3005', 10);
const HOST = process.env.HOST || '0.0.0.0';

const startServer = async () => {
  try {
    // Initialize the database
    await initializeDatabase();

    // Initialize news feed database
    try {
      newsFeedService.initDatabase();
      console.log('✅ News feed database initialized');
      
      // Fetch news on startup
      newsFeedService.fetchAllRSS().then(count => {
        console.log(`✅ Initial news fetch completed: ${count} articles`);
      }).catch(err => {
        console.error('❌ Failed to fetch initial news:', err);
      });
      
      // Auto-fetch news every 5 minutes
      setInterval(() => {
        newsFeedService.fetchAllRSS().then(count => {
          console.log(`✅ Auto news fetch completed: ${count} articles`);
        }).catch(err => {
          console.error('❌ Failed to fetch news:', err);
        });
      }, 5 * 60 * 1000); // 每5分钟
      
      console.log('✅ News feed auto-sync started (every 5 minutes)');
    } catch (error) {
      console.error('❌ Failed to initialize news feed service:', error);
    }

    // Initialize Twitter monitor
    try {
      console.log('🔧 Initializing Twitter monitor service...');
      twitterMonitorService.initDatabase();
      console.log('✅ Twitter monitor database initialized');
      
      // 使用 TwitterAPI.io 进行推文监控
      console.log('📡 Using TwitterAPI.io for tweet monitoring...');
      
      // 初始化热门账号推文（设置为优先级 1）
      console.log('🚀 Initializing popular Twitter accounts...');
      const popularAccounts = ['cz_binance', 'binance', 'elonmusk', 'VitalikButerin', 'heyibinance'];
      
      (async () => {
          let totalInitial = 0;
          for (const username of popularAccounts) {
            try {
              const tweets = await twitterMonitorService.fetchTweetsFromApi(username);
              const saved = twitterMonitorService.saveTweets(tweets);
              totalInitial += saved;
              
              // 设置为热门账号（优先级 1）
              const Database = require('better-sqlite3');
              const path = require('path');
              const db = new Database(path.join(__dirname, '../data/eagleswap.db'));
              db.prepare(`
                UPDATE user_twitter_follows 
                SET priority = 1 
                WHERE twitter_username = ?
              `).run(username);
              db.close();
              
              console.log(`✅ Initialized @${username}: ${saved} tweets (Priority: 🔥 Hot)`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
              console.error(`❌ Failed to initialize @${username}:`, error);
            }
          }
          console.log(`🎉 Popular accounts initialized: ${totalInitial} tweets`);
        })();
        
        // 分级定时监听
        // 热门账号：每 5 分钟
        setInterval(() => {
          twitterMonitorService.monitorByPriority(1, 5).catch(err => {
            console.error('❌ Failed to monitor hot accounts:', err);
          });
        }, 5 * 60 * 1000);
        
        // 普通账号：每 15 分钟
        setInterval(() => {
          twitterMonitorService.monitorByPriority(2, 15).catch(err => {
            console.error('❌ Failed to monitor normal accounts:', err);
          });
        }, 15 * 60 * 1000);
        
        // 冷门账号：每 30 分钟
        setInterval(() => {
          twitterMonitorService.monitorByPriority(3, 30).catch(err => {
            console.error('❌ Failed to monitor cold accounts:', err);
          });
        }, 30 * 60 * 1000);
        
        // 每小时自动调整优先级
        setInterval(() => {
          twitterMonitorService.autoAdjustPriorities();
        }, 60 * 60 * 1000);
        
      console.log('✅ Twitter monitor auto-sync started:');
      console.log('   🔥 Hot accounts: every 5 minutes');
      console.log('   📊 Normal accounts: every 15 minutes');
      console.log('   ❄️  Cold accounts: every 30 minutes');
      console.log('   🔄 Auto-adjust priorities: every hour');
    } catch (error: any) {
      console.error('❌ Failed to initialize Twitter monitor service:', error);
      console.error('Error details:', error?.message);
      console.error('Stack trace:', error?.stack);
    }

    // 图表功能已移除 - 禁用价格收集服务
    // Start price collector for X Layer chart data
    // priceCollector.start();

    // Start hot pairs monitor
    // hotPairsMonitor.start();

    // Start the server
    const server = app.listen(PORT, HOST as string, () => {
      console.log('✅ Eagle Swap Backend started');
      console.log(`   Port: ${PORT}`);
      console.log(`   Host: ${HOST}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Eagle Swap Backend                        ║
║                                                              ║
║  🚀 Server running on: http://${HOST}:${PORT}                    ║
║  📊 Health check: http://${HOST}:${PORT}/health                  ║
║  📚 API Documentation: http://${HOST}:${PORT}/                   ║
║                                                              ║
║  🔗 Eagle RPC Backend: ${process.env.EAGLE_RPC_BACKEND_URL || 'http://localhost:3000'}           ║
║  📈 Eagle Indexer: ${process.env.EAGLE_INDEXER_URL || 'http://localhost:3005'}               ║
║                                                              ║
║  Environment: ${(process.env.NODE_ENV || 'development').toUpperCase().padEnd(11)}                        ║
║  Database: ${path.join(__dirname, '../data/eagleswap.db').padEnd(15)}                ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully`);
      
      server.close((err: any) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err);
          process.exit(1);
        }
        
        console.log('✅ Server closed successfully');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();