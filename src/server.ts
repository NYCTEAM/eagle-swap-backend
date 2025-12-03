import dotenv from 'dotenv';
import { app, initializeApp } from './app';
import { logger } from './utils/logger';
import { startDailySettlement } from './services/dailySettlement';
import { startOTCSync } from './services/otcSync';
// 图表功能已移除 - 不需要价格收集服务
// import { priceCollector } from './services/priceCollector';
// import { hotPairsMonitor } from './services/hotPairsMonitor';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3005', 10);
const HOST = process.env.HOST || '0.0.0.0';

const startServer = async () => {
  try {
    // Initialize the application (database, etc.)
    await initializeApp();

    // Start daily settlement cron job
    startDailySettlement();

    // Start OTC event sync service
    startOTCSync();

    // 图表功能已移除 - 禁用价格收集服务
    // Start price collector for X Layer chart data
    // priceCollector.start();

    // Start hot pairs monitor
    // hotPairsMonitor.start();

    // Start the server
    const server = app.listen(PORT, HOST as string, () => {
      logger.info('Eagle Swap Backend started', {
        port: PORT,
        host: HOST,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      });

      // Log configuration
      logger.info('Configuration loaded', {
        eagleRpcBackendUrl: process.env.EAGLE_RPC_BACKEND_URL || 'http://localhost:3000',
        eagleIndexerUrl: process.env.EAGLE_INDEXER_URL || 'http://localhost:3005',
        databasePath: process.env.DATABASE_PATH || './data/eagleswap.db',
        logLevel: process.env.LOG_LEVEL || 'info',
        nodeEnv: process.env.NODE_ENV || 'development'
      });

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
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        logger.error('Server error', { error });
        process.exit(1);
      }
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      
      server.close((err) => {
        if (err) {
          logger.error('Error during server shutdown', { error: err });
          process.exit(1);
        }
        
        logger.info('Server closed successfully');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Start the server
startServer();