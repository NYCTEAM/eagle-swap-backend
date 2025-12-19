import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { initDatabase } from './database/init';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger, logRequest } from './utils/logger';

// Import services
import { simpleNftSync } from './services/simpleNftSync';
import { multiChainNftSync } from './services/multiChainNftSync';
import { marketplaceSyncService } from './services/marketplaceSyncService';
import { otcSyncXLayer, otcSyncBSC } from './services/otcSync';

// Import routes
import tokensRouter from './routes/tokens';
import swapRouter from './routes/swap';
import liquidityRouter from './routes/liquidity';
import farmsRouter from './routes/farms';
import usersRouter from './routes/users';
import pricesRouter from './routes/prices';
import nodesRouter from './routes/nodes';
import miningRouter from './routes/mining';
import swapMiningRouter from './routes/swapMining';
import communityRouter from './routes/community';
import communityCreationRouter from './routes/community-creation';
import adminRouter from './routes/admin';
import dashboardRouter from './routes/dashboard';
import swapHistoryRouter from './routes/swapHistory';
import xlayerChartRouter from './routes/xlayerChart';
import marketplaceRouter from './routes/nftMarketplace';
import nftRouter from './routes/nftRoutes';
import simpleNftRouter from './routes/simpleNft';
import otcRouter from './routes/otc';
import bridgeRouter from './routes/bridge';
import solanaSwapRouter from './routes/solanaSwap';
import multichainNftRouter from './routes/multichainNft';
import nftMiningRouter from './routes/nft-mining';
import { bridgeRelayerService } from './services/bridgeRelayerService';

const app = express();

// Trust proxy - required for Nginx reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost and development origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:3002',
      'http://localhost:3005',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3005',
      'https://eagleswap.llc',
      'https://www.eagleswap.llc',
      'http://eagleswap.llc',
      'http://www.eagleswap.llc'
    ];

    // Add production origins from environment
    const productionOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    allowedOrigins.push(...productionOrigins);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin', { origin });
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// HTTP request logging
app.use((req, res, next) => {
  logRequest(req, res);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Eagle Swap Backend is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/tokens', tokensRouter);
app.use('/api/swap', swapRouter);
app.use('/api/liquidity', liquidityRouter);
app.use('/api/farms', farmsRouter);
app.use('/api/users', usersRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/nodes', nodesRouter);
app.use('/api/mining', miningRouter);
app.use('/api/swap-mining', swapMiningRouter);
app.use('/api/community', communityRouter);
app.use('/api/community-creation', communityCreationRouter);
app.use('/api/admin', adminRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/swap-history', swapHistoryRouter);
app.use('/api/xlayer-chart', xlayerChartRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/nft', nftRouter);
app.use('/api/simple-nft', simpleNftRouter);
app.use('/api/otc', otcRouter);
app.use('/api/bridge', bridgeRouter);
app.use('/api/solana-swap', solanaSwapRouter);
app.use('/api/multichain-nft', multichainNftRouter);
app.use('/api/nft-mining', nftMiningRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Eagle Swap Backend API',
    version: process.env.npm_package_version || '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      tokens: '/api/tokens',
      swap: '/api/swap',
      liquidity: '/api/liquidity',
      farms: '/api/farms',
      users: '/api/users',
      prices: '/api/prices',
      health: '/health'
    }
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize database on startup
const initializeApp = async () => {
  try {
    await initDatabase();
    logger.info('Database initialized successfully');
    
    // 启动多链NFT同步服务
    const useMultiChain = process.env.USE_MULTICHAIN_NFT_SYNC === 'true';
    
    if (useMultiChain) {
      await multiChainNftSync.start();
      logger.info('Multi-chain NFT sync service started successfully');
    } else {
      await simpleNftSync.start();
      logger.info('Single-chain NFT sync service started successfully');
    }
    
    // 启动 Marketplace 同步服务
    await marketplaceSyncService.start(30000); // 每30秒同步一次
    logger.info('Marketplace sync service started successfully');
    
    // 启动 OTC 同步服务
    try {
      await otcSyncXLayer.start();
      logger.info('OTC sync service started for X Layer');
      await otcSyncBSC.start();
      logger.info('OTC sync service started for BSC');
    } catch (error) {
      logger.warn('OTC sync service failed to start', { error });
    }
    
    // 启动Bridge Relayer服务
    if (process.env.RELAYER_PRIVATE_KEY) {
      await bridgeRelayerService.start();
      logger.info('Bridge relayer service started successfully');
    } else {
      logger.warn('RELAYER_PRIVATE_KEY not set, bridge relayer disabled');
    }
  } catch (error) {
    logger.error('Failed to initialize application', { error });
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

export { app, initializeApp };