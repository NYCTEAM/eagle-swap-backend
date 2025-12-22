import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

/**
 * OKX Cross-Chain Bridge API Proxy
 * 
 * This proxy solves CORS issues by forwarding requests from frontend to OKX API
 * 
 * Documentation: https://web3.okx.com/zh-hans/build/docs/waas/dex-crosschain-aggregator
 */

interface OKXBridgeQuoteParams {
  fromChainId: string;
  toChainId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  userWalletAddress: string;
  slippage?: string;
}

interface OKXBridgeQuoteResponse {
  code: string;
  msg: string;
  data: Array<{
    routerList: Array<{
      router: string;
      routerName: string;
      crossChainFee: {
        amount: string;
        tokenAddress: string;
      };
      estimateGasFee: string;
      toTokenAmount: string;
      minToTokenAmount: string;
    }>;
    tx: {
      from: string;
      to: string;
      data: string;
      value: string;
      gasPrice: string;
      gas: string;
    };
  }>;
}

/**
 * GET /api/okx-bridge/quote
 * 
 * Get cross-chain bridge quote from OKX
 * 
 * Query Parameters:
 * - fromChainId: Source chain ID (e.g., "56" for BSC)
 * - toChainId: Destination chain ID (e.g., "196" for X Layer)
 * - fromTokenAddress: Source token address (use 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE for native)
 * - toTokenAddress: Destination token address
 * - amount: Amount in wei (e.g., "100000000000000000" for 0.1 BNB)
 * - userWalletAddress: User's wallet address
 * - slippage: Slippage tolerance (default: "0.5" for 0.5%)
 */
router.get('/quote', async (req: Request, res: Response) => {
  try {
    const {
      fromChainId,
      toChainId,
      fromTokenAddress,
      toTokenAddress,
      amount,
      userWalletAddress,
      slippage = '0.5'
    } = req.query as unknown as OKXBridgeQuoteParams;

    // Validate required parameters
    if (!fromChainId || !toChainId || !fromTokenAddress || !toTokenAddress || !amount || !userWalletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        required: ['fromChainId', 'toChainId', 'fromTokenAddress', 'toTokenAddress', 'amount', 'userWalletAddress']
      });
    }

    console.log('🌉 Proxying OKX Bridge quote request:');
    console.log('   From:', fromChainId, fromTokenAddress);
    console.log('   To:', toChainId, toTokenAddress);
    console.log('   Amount:', amount);
    console.log('   User:', userWalletAddress);

    // Call OKX API
    const okxUrl = 'https://www.okx.com/api/v5/dex/cross-chain/quote';
    const response = await axios.get<OKXBridgeQuoteResponse>(okxUrl, {
      params: {
        fromChainId,
        toChainId,
        fromTokenAddress,
        toTokenAddress,
        amount,
        userWalletAddress,
        slippage
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000 // 30 seconds timeout
    });

    // Check OKX API response
    if (response.data.code !== '0') {
      console.error('❌ OKX API error:', response.data.code, response.data.msg);
      return res.status(400).json({
        success: false,
        error: 'OKX API error',
        code: response.data.code,
        message: response.data.msg
      });
    }

    if (!response.data.data || response.data.data.length === 0) {
      console.error('❌ No bridge route found');
      return res.status(404).json({
        success: false,
        error: 'No bridge route found'
      });
    }

    const quote = response.data.data[0];

    console.log('✅ OKX Bridge quote received:');
    console.log('   Router:', quote.routerList[0]?.router);
    console.log('   Output:', quote.routerList[0]?.toTokenAmount);
    console.log('   Min Output:', quote.routerList[0]?.minToTokenAmount);

    // Return successful response
    res.json({
      success: true,
      data: quote
    });

  } catch (error: any) {
    console.error('❌ Error proxying OKX Bridge request:', error.message);
    
    if (error.response) {
      // OKX API returned an error
      return res.status(error.response.status).json({
        success: false,
        error: 'OKX API error',
        message: error.response.data?.msg || error.message
      });
    }

    // Network or other error
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/okx-bridge/supported-chains
 * 
 * Get list of supported chains from OKX
 */
router.get('/supported-chains', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Fetching OKX supported chains...');

    const okxUrl = 'https://www.okx.com/api/v5/dex/cross-chain/supported/chain';
    const response = await axios.get(okxUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000
    });

    console.log('✅ OKX supported chains received');

    res.json({
      success: true,
      data: response.data.data
    });

  } catch (error: any) {
    console.error('❌ Error fetching supported chains:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supported chains',
      message: error.message
    });
  }
});

/**
 * GET /api/okx-bridge/health
 * 
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'OKX Bridge proxy is running',
    timestamp: new Date().toISOString()
  });
});

export default router;
