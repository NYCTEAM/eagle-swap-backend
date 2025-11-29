import { Router, Request, Response } from 'express';
import bridgeRelayerService from '../services/bridgeRelayerService';

const router = Router();

/**
 * GET /api/bridge/status/:txHash
 * Get bridge transaction status
 */
router.get('/status/:txHash', (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    const status = bridgeRelayerService.getStatus(txHash);
    
    if (!status) {
      return res.json({
        success: true,
        status: 'unknown',
        message: 'Transaction not found in relayer queue'
      });
    }
    
    res.json({
      success: true,
      ...status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bridge/notify
 * Notify relayer of a new bridge transaction
 */
router.post('/notify', async (req: Request, res: Response) => {
  try {
    const { txHash, fromChain, toChain, amount, recipient } = req.body;
    
    if (!txHash || !fromChain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: txHash, fromChain'
      });
    }
    
    const result = await bridgeRelayerService.notifyBridge(txHash, fromChain);
    
    res.json({
      success: true,
      message: 'Bridge notification received',
      ...result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bridge/pending
 * Get all pending bridge transactions
 */
router.get('/pending', (req: Request, res: Response) => {
  try {
    const pending = bridgeRelayerService.getAllPending();
    
    res.json({
      success: true,
      count: pending.length,
      transactions: pending
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bridge/history
 * Get bridge transaction history
 */
router.get('/history', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = bridgeRelayerService.getHistory(limit);
    
    // Format for frontend
    const transactions = history.map(tx => ({
      id: tx.txHash,
      from: tx.fromChain === 'xlayer' ? 'X Layer' : 'BSC',
      to: tx.toChain === 'xlayer' ? 'X Layer' : 'BSC',
      amount: (parseFloat(tx.amount) / 1e18).toLocaleString(),
      address: `${tx.from.substring(0, 6)}...${tx.from.substring(38)}`,
      fullAddress: tx.from,
      time: getTimeAgo(tx.createdAt),
      status: tx.status,
      txHash: tx.txHash,
      destTxHash: tx.destTxHash,
      fee: tx.fee || '0',
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
    }));
    
    res.json({
      success: true,
      count: history.length,
      transactions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bridge/stats
 * Get bridge statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = bridgeRelayerService.getStats();
    
    res.json({
      success: true,
      ...stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bridge/user/:address
 * Get user's bridge history
 */
router.get('/user/:address', (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const history = bridgeRelayerService.getUserHistory(address, limit);
    
    const transactions = history.map(tx => ({
      id: tx.txHash,
      from: tx.fromChain === 'xlayer' ? 'X Layer' : 'BSC',
      to: tx.toChain === 'xlayer' ? 'X Layer' : 'BSC',
      amount: (parseFloat(tx.amount) / 1e18).toLocaleString(),
      time: getTimeAgo(tx.createdAt),
      status: tx.status,
      txHash: tx.txHash,
      destTxHash: tx.destTxHash,
      fee: tx.fee || '0',
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
    }));
    
    res.json({
      success: true,
      count: history.length,
      transactions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bridge/info
 * Get bridge configuration info
 */
router.get('/info', (req: Request, res: Response) => {
  try {
    const stats = bridgeRelayerService.getStats();
    
    res.json({
      success: true,
      chains: {
        xlayer: {
          chainId: 196,
          name: 'X Layer',
          token: '0xdd9B82048D2408D69374Aecb6Cf65e66754c95bc',
          bridge: '0x63A65A216c213f636e06D4aD10e1b2995b19e82F',
          explorer: 'https://www.oklink.com/xlayer'
        },
        bsc: {
          chainId: 56,
          name: 'BSC',
          token: '0x83Fe5B70a08d42F6224A9644b3c73692f2d9092a',
          bridge: '0x0985DB9C2FA117152941521991E06AAfA03c82F3',
          explorer: 'https://bscscan.com'
        }
      },
      feeRate: '1%',
      minAmount: '100 EAGLE',
      stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds} sec ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export default router;
