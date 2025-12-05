import { ethers } from 'ethers';
import { db } from '../database';

// OTC合约事件监听服务
class OTCSync {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private chainId: number;
  private network: string;

  private usdtDecimals: number;
  
  constructor(chainId: number = 196) {
    this.chainId = chainId;
    this.network = chainId === 196 ? 'X Layer' : 'BSC';
    // X Layer USDT: 6 decimals, BSC USDT: 18 decimals
    this.usdtDecimals = chainId === 196 ? 6 : 18;
    
    // 初始化RPC连接
    const rpcUrl = chainId === 196 
      ? (process.env.X_LAYER_RPC_URL || 'https://rpc.xlayer.tech')
      : 'https://bsc-dataseed.binance.org';
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // OTC合约地址
    const contractAddress = chainId === 196
      ? '0x22579d6C47edEC5Cb31Dd1fD238C7d0892Fd285c'
      : '0xc7801000FCBfF7C2fA05F6B38Ead39401F0551F6';
    
    // OTC合约ABI
    const otcABI = [
      'event OrderCreated(uint256 indexed orderId, bytes32 indexed pairId, address indexed maker, uint8 orderType, uint256 price, uint256 baseAmount)',
      'event OrderFilled(uint256 indexed orderId, address indexed taker, uint256 fillAmount, uint256 remainingAmount)',
      'event OrderCancelled(uint256 indexed orderId)',
      'function orders(uint256) view returns (uint256 orderId, bytes32 pairId, address maker, uint8 orderType, address baseToken, address quoteToken, uint256 price, uint256 baseAmount, uint256 filledAmount, uint256 lockedAmount, uint256 expiryTime, uint8 status, uint256 createdAt, uint256 lastFilledAt)'
    ];

    this.contract = new ethers.Contract(contractAddress, otcABI, this.provider);
    
    console.log(`🔄 [OTC Sync] Initialized for ${this.network} (Chain ID: ${chainId})`);
    console.log(`   Contract: ${contractAddress}`);
    console.log(`   RPC: ${rpcUrl}`);
  }

  // 启动事件监听
  async start() {
    console.log(`🚀 [OTC Sync] Starting for ${this.network}...`);
    
    // 先同步历史订单
    await this.syncHistoricalOrders();
    
    // 监听 OrderCreated 事件
    this.contract.on('OrderCreated', async (orderId, pairId, maker, orderType, price, baseAmount, event) => {
      try {
        console.log(`\n📝 [OrderCreated] Order ${orderId} on ${this.network}`);
        await this.handleOrderCreated(orderId, event);
      } catch (error) {
        console.error(`❌ [OrderCreated] Error:`, error);
      }
    });

    // 监听 OrderFilled 事件
    this.contract.on('OrderFilled', async (orderId, taker, fillAmount, remainingAmount, event) => {
      try {
        console.log(`\n✅ [OrderFilled] Order ${orderId} filled on ${this.network}`);
        await this.handleOrderFilled(orderId, taker, fillAmount, event);
      } catch (error) {
        console.error(`❌ [OrderFilled] Error:`, error);
      }
    });

    // 监听 OrderCancelled 事件
    this.contract.on('OrderCancelled', async (orderId, event) => {
      try {
        console.log(`\n🚫 [OrderCancelled] Order ${orderId} cancelled on ${this.network}`);
        await this.handleOrderCancelled(orderId, event);
      } catch (error) {
        console.error(`❌ [OrderCancelled] Error:`, error);
      }
    });

    console.log(`✅ [OTC Sync] Event listeners started for ${this.network}`);
  }
  
  // 同步历史订单
  async syncHistoricalOrders() {
    console.log(`📜 [OTC Sync] Syncing historical orders for ${this.network}...`);
    
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);
      const BATCH_SIZE = 100; // 每批扫描100个区块
      
      console.log(`   Scanning blocks ${fromBlock} to ${currentBlock} (batch size: ${BATCH_SIZE})...`);
      
      let totalEvents = 0;
      
      // 分批扫描，每批100个区块，每批之间等待1秒
      for (let start = fromBlock; start < currentBlock; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE - 1, currentBlock);
        
        try {
          const filter = this.contract.filters.OrderCreated();
          const events = await this.contract.queryFilter(filter, start, end);
          
          for (const event of events) {
            try {
              const orderId = (event as any).args[0];
              
              // 检查订单是否已存在
              const existing = db.prepare('SELECT order_id FROM otc_orders WHERE order_id = ?').get(orderId.toString());
              if (!existing) {
                await this.handleOrderCreated(orderId, event);
                totalEvents++;
              }
            } catch (e) {
              console.error(`   Error processing event:`, e);
            }
          }
          
          // 每批之间等待1秒，避免RPC限流
          if (end < currentBlock) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (e) {
          console.error(`   Error scanning blocks ${start}-${end}:`, e);
        }
      }
      
      console.log(`✅ [OTC Sync] Historical sync completed for ${this.network}, synced ${totalEvents} new orders`);
    } catch (error) {
      console.error(`❌ [OTC Sync] Historical sync failed for ${this.network}:`, error);
    }
  }

  // 更新用户统计
  private updateUserStats(address: string, action: string) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const network = this.network;

      // 检查是否存在统计记录
      const existing = db
        .prepare('SELECT * FROM otc_user_stats WHERE user_address = ? AND network = ?')
        .get(address.toLowerCase(), network);

      if (!existing) {
        // 创建新记录
        db.prepare(`
          INSERT INTO otc_user_stats (
            user_address, network, orders_created, orders_filled,
            orders_cancelled, orders_taken, volume_as_maker,
            volume_as_taker, total_volume, total_trades,
            first_trade_at, last_trade_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          address.toLowerCase(),
          network,
          action === 'order_created' ? 1 : 0,
          action === 'order_filled' ? 1 : 0,
          action === 'order_cancelled' ? 1 : 0,
          action === 'order_taken' ? 1 : 0,
          0, 0, 0, 0,
          now,
          now
        );
      } else {
        // 更新现有记录
        let updateQuery = 'UPDATE otc_user_stats SET last_trade_at = ?';
        const params: any[] = [now];

        if (action === 'order_created') {
          updateQuery += ', orders_created = orders_created + 1';
        } else if (action === 'order_filled') {
          updateQuery += ', orders_filled = orders_filled + 1';
        } else if (action === 'order_cancelled') {
          updateQuery += ', orders_cancelled = orders_cancelled + 1';
        } else if (action === 'order_taken') {
          updateQuery += ', orders_taken = orders_taken + 1';
        }

        updateQuery += ' WHERE user_address = ? AND network = ?';
        params.push(address.toLowerCase(), network);

        db.prepare(updateQuery).run(...params);
      }
      console.log(`   📊 Stats updated for ${address} (${action})`);
    } catch (error) {
      console.error('❌ Failed to update user stats:', error);
    }
  }

  // 处理订单创建事件
  private async handleOrderCreated(orderId: bigint, event: any) {
    const orderData = await this.contract.orders(orderId);
    const block = await event.getBlock();
    
    const isBuy = Number(orderData[3]) === 0;
    const side = isBuy ? 'buy' : 'sell';
    
    // 格式化金额
    const baseAmount = ethers.formatUnits(orderData[7], 18); // EAGLE (always 18 decimals)
    const price = ethers.formatUnits(orderData[6], this.usdtDecimals); // USDT (6 for X Layer, 18 for BSC)
    
    let tokenSell, tokenBuy, amountSell, amountBuy;
    if (isBuy) {
      tokenBuy = orderData[4]; // EAGLE
      tokenSell = orderData[5]; // USDT
      amountBuy = baseAmount;
      amountSell = (parseFloat(baseAmount) * parseFloat(price)).toString();
    } else {
      tokenSell = orderData[4]; // EAGLE
      tokenBuy = orderData[5]; // USDT
      amountSell = baseAmount;
      amountBuy = (parseFloat(baseAmount) * parseFloat(price)).toString();
    }

    const statusEnum = Number(orderData[11]);
    const statusMap = ['open', 'filled', 'cancelled'];
    const status = statusMap[statusEnum] || 'unknown';

    // 插入或更新订单
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO otc_orders (
        order_id, maker_address, side, token_sell, token_buy, 
        amount_sell, amount_buy, amount_remaining, price_usdt, 
        status, created_at, expiry_ts, updated_at, 
        network, chain_id, tx_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      orderId.toString(),
      orderData[2].toLowerCase(),
      side,
      tokenSell.toLowerCase(),
      tokenBuy.toLowerCase(),
      amountSell,
      amountBuy,
      baseAmount,
      price,
      status,
      Number(orderData[12]),
      Number(orderData[10]),
      Math.floor(Date.now() / 1000),
      this.network,
      this.chainId,
      event.transactionHash
    );

    console.log(`   ✅ Order ${orderId} saved: ${side} ${baseAmount} EAGLE @ ${price} USDT`);
    
    // 更新 maker 统计
    this.updateUserStats(orderData[2].toLowerCase(), 'order_created');
  }

  // 处理订单成交事件
  private async handleOrderFilled(orderId: bigint, taker: string, fillAmount: bigint, event: any) {
    // 获取订单信息
    const order = db.prepare('SELECT * FROM otc_orders WHERE order_id = ?').get(orderId.toString());
    
    if (!order) {
      console.error(`   ❌ Order ${orderId} not found in database`);
      return;
    }

    const block = await event.getBlock();
    const baseAmount = ethers.formatUnits(fillAmount, 18);
    const quoteAmount = parseFloat(baseAmount) * parseFloat(order.price_usdt);

    // 插入成交记录
    const fillStmt = db.prepare(`
      INSERT INTO otc_fills (
        order_id, maker_address, taker_address, 
        base_amount, quote_amount, price, side, 
        filled_at, network, chain_id, tx_hash, block_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    fillStmt.run(
      orderId.toString(),
      order.maker_address,
      taker.toLowerCase(),
      baseAmount,
      quoteAmount,
      order.price_usdt,
      order.side,
      block.timestamp,
      this.network,
      this.chainId,
      event.transactionHash,
      event.blockNumber
    );

    // 更新订单状态
    const orderData = await this.contract.orders(orderId);
    const filledAmount = ethers.formatUnits(orderData[8], 18);
    const totalAmount = ethers.formatUnits(orderData[7], 18);
    const remaining = parseFloat(totalAmount) - parseFloat(filledAmount);
    
    const newStatus = remaining <= 0.000001 ? 'filled' : 'open';

    const updateStmt = db.prepare(`
      UPDATE otc_orders 
      SET amount_remaining = ?, status = ?, updated_at = ? 
      WHERE order_id = ?
    `);

    updateStmt.run(
      remaining.toString(),
      newStatus,
      Math.floor(Date.now() / 1000),
      orderId.toString()
    );

    console.log(`   ✅ Fill recorded: ${baseAmount} EAGLE @ ${order.price_usdt} USDT = ${quoteAmount} USDT`);
    console.log(`   📊 Order status: ${newStatus}, remaining: ${remaining} EAGLE`);
    
    // 更新统计: Maker (Filled), Taker (Taken)
    this.updateUserStats(order.maker_address, 'order_filled');
    this.updateUserStats(taker.toLowerCase(), 'order_taken');
  }

  // 处理订单取消事件
  private async handleOrderCancelled(orderId: bigint, event: any) {
    // 获取订单信息以更新 Maker 统计
    const order = db.prepare('SELECT maker_address FROM otc_orders WHERE order_id = ?').get(orderId.toString());
    
    const updateStmt = db.prepare(`
      UPDATE otc_orders 
      SET status = 'cancelled', updated_at = ? 
      WHERE order_id = ?
    `);

    updateStmt.run(
      Math.floor(Date.now() / 1000),
      orderId.toString()
    );

    console.log(`   ✅ Order ${orderId} marked as cancelled`);
    
    if (order) {
      this.updateUserStats(order.maker_address, 'order_cancelled');
    }
  }

  // 停止监听
  stop() {
    this.contract.removeAllListeners();
    console.log(`🛑 [OTC Sync] Stopped event listeners for ${this.network}`);
  }
}

// 导出单例
let xlayerSync: OTCSync | null = null;
let bscSync: OTCSync | null = null;

export function startOTCSync() {
  // 启动 X Layer 同步
  if (!xlayerSync) {
    xlayerSync = new OTCSync(196);
    xlayerSync.start();
  }

  // 启动 BSC 同步
  if (!bscSync) {
    bscSync = new OTCSync(56);
    bscSync.start();
  }
}

export function stopOTCSync() {
  if (xlayerSync) {
    xlayerSync.stop();
    xlayerSync = null;
  }
  if (bscSync) {
    bscSync.stop();
    bscSync = null;
  }
}

// 导出单独的实例供 app.ts 使用
export const otcSyncXLayer = new OTCSync(196);
export const otcSyncBSC = new OTCSync(56);

export { OTCSync };
