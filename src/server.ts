import dotenv from 'dotenv';
import { app } from './app';
import { initializeDatabase } from './database/init';
import newsFeedService from './services/newsFeedService';
import twitterMonitorService from './services/twitterMonitorService';
import TwitterScraperService from './services/twitterScraperService';
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

    // Initialize Twitter monitor with Puppeteer
    try {
      twitterMonitorService.initDatabase();
      console.log('✅ Twitter monitor database initialized');
      
      // 检查是否配置了Twitter账号
      const twitterUsername = process.env.TWITTER_USERNAME;
      const twitterPassword = process.env.TWITTER_PASSWORD;
      
      // 临时禁用Playwright，等浏览器安装完成后再启用
      if (false && twitterUsername && twitterPassword) {
        console.log('🔐 Using Puppeteer Twitter Scraper (with login)');
        
        // 创建Puppeteer scraper实例
        const twitterScraper = new TwitterScraperService({
          username: twitterUsername,
          password: twitterPassword,
          headless: process.env.TWITTER_SCRAPER_HEADLESS !== 'false'
        });
        
        // 初始化浏览器并登录
        twitterScraper.initBrowser()
          .then(() => twitterScraper.login())
          .then(() => {
            console.log('✅ Twitter scraper initialized and logged in');
            
            // 首次抓取
            return twitterScraper.monitorAllFollows();
          })
          .then(count => {
            console.log(`✅ Initial Twitter scraper completed: ${count} tweets`);
          })
          .catch(err => {
            console.error('❌ Failed to initialize Twitter scraper:', err);
            console.log('⚠️ Falling back to Nitter RSS...');
          });
        
        // 定时抓取（每5分钟）
        setInterval(() => {
          twitterScraper.monitorAllFollows()
            .then(count => {
              console.log(`✅ Auto Twitter scraper completed: ${count} tweets`);
            })
            .catch(err => {
              console.error('❌ Twitter scraper failed:', err);
            });
        }, 5 * 60 * 1000); // 每5分钟
        
        console.log('✅ Twitter scraper auto-sync started (every 5 minutes)');
      } else {
        console.log('⚠️ Twitter credentials not found, using Nitter RSS (may be unstable)');
        
        // 回退到Nitter方式
        twitterMonitorService.monitorAllFollows().then(count => {
          console.log(`✅ Initial Twitter monitor completed: ${count} tweets`);
        }).catch(err => {
          console.error('❌ Failed to monitor Twitter:', err);
        });
        
        setInterval(() => {
          twitterMonitorService.monitorAllFollows().then(count => {
            console.log(`✅ Auto Twitter monitor completed: ${count} tweets`);
          }).catch(err => {
            console.error('❌ Failed to monitor Twitter:', err);
          });
        }, 1 * 60 * 1000);
        
        console.log('✅ Twitter monitor auto-sync started (every 1 minute)');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Twitter monitor service:', error);
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
║  Database: ${(process.env.DATABASE_PATH || './data/eagleswap.db').padEnd(15)}                ║
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