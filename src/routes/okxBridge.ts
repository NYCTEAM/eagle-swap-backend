import express, { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';

const router = express.Router();

// OKX API Configuration
const OKX_API_KEY = process.env.OKX_API_KEY || '';
const OKX_API_SECRET = process.env.OKX_API_SECRET || '';
const OKX_API_PASSPHRASE = process.env.OKX_API_PASSPHRASE || '';
const OKX_API_PROJECT = process.env.OKX_API_PROJECT || '';

/**
 * Generate OKX API signature
 * Format: timestamp + method + requestPath + queryString + body
 * For GET requests, body is empty but queryString is included
 */
function generateOKXSignature(timestamp: string, method: string, requestPath: string, queryString: string = '', body: string = ''): string {
  const message = timestamp + method + requestPath + queryString + body;
  const hmac = crypto.createHmac('sha256', OKX_API_SECRET);
  return hmac.update(message).digest('base64');
}

/**
 * Cross-Chain Bridge API Proxy using LI.FI
 * 
 * LI.FI is a cross-chain bridge aggregator that is completely free and requires no API key
 * It aggregates multiple bridges including Stargate, Hop, Across, and more
 * 
 * Documentation: https://docs.li.fi/
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

    console.log('🌉 Fetching cross-chain quote from OKX:');
    console.log('   From:', fromChainId, fromTokenAddress);
    console.log('   To:', toChainId, toTokenAddress);
    console.log('   Amount:', amount);
    console.log('   User:', userWalletAddress);

    // Generate OKX API signature
    // OKX requires ISO timestamp format and query string in signature
    const timestamp = new Date().toISOString();
    const method = 'GET';
    const requestPath = '/api/v5/dex/cross-chain/quote';
    
    // Build query string for signature
    const queryParams = new URLSearchParams({
      fromChainId,
      toChainId,
      fromTokenAddress,
      toTokenAddress,
      amount,
      userWalletAddress,
      slippage
    });
    const queryString = '?' + queryParams.toString();
    const signature = generateOKXSignature(timestamp, method, requestPath, queryString, '');
    
    console.log('🔐 Auth Debug:');
    console.log('   Timestamp:', timestamp);
    console.log('   API Key:', OKX_API_KEY ? 'Set' : 'Missing');
    console.log('   Secret:', OKX_API_SECRET ? 'Set' : 'Missing');
    console.log('   Passphrase:', OKX_API_PASSPHRASE ? 'Set' : 'Missing');

    // Try OKX API with authentication
    console.log('🔄 Testing OKX API with authentication...');
    
    let response;
    let isOKXResponse = false;
    
    try {
      // Use web3.okx.com as per official examples
      const okxUrl = 'https://web3.okx.com/api/v5/dex/cross-chain/quote';
      response = await axios.get(okxUrl, {
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
          'OK-ACCESS-KEY': OKX_API_KEY,
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': OKX_API_PASSPHRASE,
          'OK-ACCESS-PROJECT': OKX_API_PROJECT,
          'x-simulated-trading': '0', // Add this header
        },
        timeout: 30000
      });
      
      console.log('✅ OKX API authentication successful!');
      isOKXResponse = true;
      
    } catch (okxError: any) {
      // Log error but don't fail yet - try LI.FI fallback
      const status = okxError.response?.status;
      const msg = okxError.response?.data?.msg || okxError.message;
      
      console.log(`⚠️ OKX API unavailable or failed (${status}): ${msg}`);
      
      if (okxError.response?.data) {
        console.log('   Full OKX Error:', JSON.stringify(okxError.response.data));
      }
      
      console.log('🔄 Falling back to LI.FI API...');
      
      // Fallback to LI.FI
      const lifiUrl = 'https://li.quest/v1/quote';
      response = await axios.get(lifiUrl, {
        params: {
          fromChain: fromChainId,
          toChain: toChainId,
          fromToken: fromTokenAddress,
          toToken: toTokenAddress,
          fromAmount: amount,
          fromAddress: userWalletAddress,
          slippage: parseFloat(slippage) / 100,
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000
      });
      
      console.log('✅ LI.FI API called successfully');
      console.log('📊 LI.FI Raw Response:', JSON.stringify(response.data, null, 2));
      isOKXResponse = false;
    }

    // Handle response based on API type
    let quote;
    
    if (isOKXResponse && response.data.code === '0') {
      // OKX API response format (官方文档确认 data 是对象，不是数组)
      console.log('✅ Processing OKX API response');
      console.log('📊 OKX Raw Response:', JSON.stringify(response.data, null, 2));
      
      if (!response.data.data || !response.data.data.routerList || response.data.data.routerList.length === 0) {
        console.error('❌ No bridge route found in OKX response');
        return res.status(404).json({
          success: false,
          error: 'No bridge route found'
        });
      }
      
      // OKX data 是对象，包含 routerList 数组
      const okxData = response.data.data;
      const firstRoute = okxData.routerList[0];
      
      quote = {
        routerList: [{
          router: firstRoute.router?.bridgeName || 'OKX Bridge',
          routerName: firstRoute.router?.bridgeName || 'OKX Bridge',
          toTokenAmount: firstRoute.toTokenAmount || '0',
          minToTokenAmount: firstRoute.minimumReceived || '0',
          crossChainFee: {
            amount: firstRoute.router?.crossChainFee || '0',
            tokenAddress: firstRoute.router?.crossChainFeeTokenAddress || ''
          },
          estimateGasFee: firstRoute.router?.estimateGasFee || '0'
        }],
        tx: {
          from: userWalletAddress,
          to: firstRoute.router?.bridgeContractAddress || '',
          data: firstRoute.txData || '0x',
          value: amount,
          gasPrice: '0',
          gas: firstRoute.router?.estimateGasFee || '0'
        }
      };
      
      console.log('✅ OKX Bridge quote received:');
      console.log('   Bridge:', firstRoute.router?.bridgeName);
      console.log('   Output:', firstRoute.toTokenAmount);
      console.log('   Min Output:', firstRoute.minimumReceived);
      
    } else {
      // LI.FI API response format
      console.log('✅ Processing LI.FI API response');
      
      if (!response.data || response.data.message === 'No possible route found' || response.data.message?.includes('No route found')) {
        console.error('❌ No bridge route found in LI.FI response');
        console.error('   This chain combination may not be supported');
        console.error('   Try using a different target chain or token');
        return res.status(404).json({
          success: false,
          error: 'No bridge route found for this chain combination',
          suggestion: 'Try BSC → Ethereum or use supported tokens like USDT'
        });
      }

      const lifiQuote = response.data;

      // Convert LI.FI response to OKX-compatible format
      const toAmount = lifiQuote.estimate?.toAmount || '0';
      const toAmountMin = lifiQuote.estimate?.toAmountMin || '0';
      
      // Check if we got a valid quote
      if (toAmount === '0' || !lifiQuote.transactionRequest?.to) {
        console.error('❌ LI.FI returned invalid quote (zero amount or no target contract)');
        console.error('   Chain combination BSC → X Layer may not be supported');
        return res.status(404).json({
          success: false,
          error: 'Chain combination not supported',
          suggestion: 'X Layer may not be supported by bridge providers. Try BSC → Ethereum instead.'
        });
      }
      
      quote = {
        routerList: [{
          router: lifiQuote.toolDetails?.name || 'LI.FI',
          routerName: lifiQuote.toolDetails?.name || 'LI.FI Bridge',
          toTokenAmount: toAmount,
          minToTokenAmount: toAmountMin,
          crossChainFee: {
            amount: lifiQuote.estimate?.gasCosts?.[0]?.amount || '0',
            tokenAddress: lifiQuote.estimate?.gasCosts?.[0]?.token?.address || ''
          },
          estimateGasFee: lifiQuote.estimate?.executionDuration || '0'
        }],
        tx: {
          from: lifiQuote.transactionRequest?.from || userWalletAddress,
          to: lifiQuote.transactionRequest?.to || '',
          data: lifiQuote.transactionRequest?.data || '0x',
          value: lifiQuote.transactionRequest?.value || '0',
          gasPrice: lifiQuote.transactionRequest?.gasPrice || '0',
          gas: lifiQuote.transactionRequest?.gasLimit || '0'
        }
      };

      console.log('✅ LI.FI Bridge quote received:');
      console.log('   Tool:', quote.routerList[0]?.routerName);
      console.log('   Output:', quote.routerList[0]?.toTokenAmount);
      console.log('   Min Output:', quote.routerList[0]?.minToTokenAmount);
      console.log('   Target Contract:', quote.tx.to);
    }

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
 * GET /api/okx-bridge/build-tx
 * 
 * Build cross-chain transaction with OKX
 * This endpoint returns the actual transaction data needed to execute the swap
 * 
 * Query Parameters: Same as /quote plus optional parameters
 */
router.get('/build-tx', async (req: Request, res: Response) => {
  try {
    const {
      fromChainId,
      toChainId,
      fromTokenAddress,
      toTokenAddress,
      amount,
      userWalletAddress,
      slippage = '0.5',
      sort,
      dexIds,
      receiveAddress,
      feePercent,
      referrerAddress,
      priceImpactProtectionPercentage,
      onlyBridge
    } = req.query;

    // Validate required parameters
    if (!fromChainId || !toChainId || !fromTokenAddress || !toTokenAddress || !amount || !userWalletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        required: ['fromChainId', 'toChainId', 'fromTokenAddress', 'toTokenAddress', 'amount', 'userWalletAddress']
      });
    }

    console.log('🔨 Building OKX cross-chain transaction...');
    console.log('   From:', fromChainId, fromTokenAddress);
    console.log('   To:', toChainId, toTokenAddress);
    console.log('   Amount:', amount);

    // Generate OKX API signature
    const timestamp = new Date().toISOString();
    const method = 'GET';
    const requestPath = '/api/v5/dex/cross-chain/build-tx';
    
    // Build query string for signature
    const queryParams: any = {
      fromChainId,
      toChainId,
      fromTokenAddress,
      toTokenAddress,
      amount,
      userWalletAddress,
      slippage
    };
    
    // Add optional parameters
    if (sort) queryParams.sort = sort;
    if (dexIds) queryParams.dexIds = dexIds;
    if (receiveAddress) queryParams.receiveAddress = receiveAddress;
    if (feePercent) queryParams.feePercent = feePercent;
    if (referrerAddress) queryParams.referrerAddress = referrerAddress;
    if (priceImpactProtectionPercentage) queryParams.priceImpactProtectionPercentage = priceImpactProtectionPercentage;
    if (onlyBridge) queryParams.onlyBridge = onlyBridge;
    
    const queryString = '?' + new URLSearchParams(queryParams).toString();
    const signature = generateOKXSignature(timestamp, method, requestPath, queryString, '');

    let response;
    let isOKXResponse = false;

    try {
      // Call OKX build-tx API
      const okxUrl = 'https://web3.okx.com/api/v5/dex/cross-chain/build-tx';
      response = await axios.get(okxUrl, {
        params: queryParams,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'OK-ACCESS-KEY': OKX_API_KEY,
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': OKX_API_PASSPHRASE,
          'OK-ACCESS-PROJECT': OKX_API_PROJECT,
        },
        timeout: 30000
      });

      console.log('✅ OKX build-tx successful!');
      console.log('📊 OKX TX Response:', JSON.stringify(response.data, null, 2));
      isOKXResponse = true;

    } catch (okxError: any) {
      const status = okxError.response?.status;
      const msg = okxError.response?.data?.msg || okxError.message;
      
      console.log(`⚠️ OKX build-tx failed (${status}): ${msg}`);
      
      if (okxError.response?.data) {
        console.log('   Full OKX Error:', JSON.stringify(okxError.response.data));
      }
      
      console.log('🔄 Falling back to LI.FI API...');
      
      // Fallback to LI.FI
      const lifiUrl = 'https://li.quest/v1/quote';
      response = await axios.get(lifiUrl, {
        params: {
          fromChain: fromChainId,
          toChain: toChainId,
          fromToken: fromTokenAddress,
          toToken: toTokenAddress,
          fromAmount: amount,
          fromAddress: userWalletAddress,
          slippage: parseFloat(slippage as string) / 100,
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000
      });
      
      console.log('✅ LI.FI API called successfully');
      isOKXResponse = false;
    }

    // Handle response
    let txData;
    
    if (isOKXResponse && response.data.code === '0') {
      // OKX response format
      const okxData = response.data.data;
      
      txData = {
        tx: okxData.tx,
        router: okxData.router,
        fromTokenAmount: okxData.fromTokenAmount,
        toTokenAmount: okxData.toTokenAmount,
        minimumReceived: okxData.minmumReceive || okxData.minimumReceived
      };
      
      console.log('✅ OKX transaction data ready');
      console.log('   To:', txData.tx.to);
      console.log('   Value:', txData.tx.value);
      console.log('   Gas Limit:', txData.tx.gasLimit);
      
    } else {
      // LI.FI response format
      const lifiQuote = response.data;
      
      if (!lifiQuote.transactionRequest) {
        return res.status(404).json({
          success: false,
          error: 'No transaction data available'
        });
      }
      
      txData = {
        tx: {
          from: lifiQuote.transactionRequest.from || userWalletAddress,
          to: lifiQuote.transactionRequest.to,
          data: lifiQuote.transactionRequest.data,
          value: lifiQuote.transactionRequest.value || '0',
          gasLimit: lifiQuote.transactionRequest.gasLimit || '500000',
          gasPrice: lifiQuote.transactionRequest.gasPrice || '0'
        },
        router: {
          bridgeName: lifiQuote.toolDetails?.name || 'LI.FI'
        },
        fromTokenAmount: amount,
        toTokenAmount: lifiQuote.estimate?.toAmount || '0',
        minimumReceived: lifiQuote.estimate?.toAmountMin || '0'
      };
      
      console.log('✅ LI.FI transaction data ready');
    }

    res.json({
      success: true,
      data: txData
    });

  } catch (error: any) {
    console.error('❌ Error building transaction:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to build transaction',
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
