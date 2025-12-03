const { ethers } = require('ethers');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🚀 [OTC Sync] Starting order synchronization...\n');

// 1. Database Connection
const possibleDbPaths = [
  path.join(__dirname, 'src/database/eagle-swap.db'),
  path.join(__dirname, 'database/eagle-swap.db'),
  path.join(__dirname, 'dist/database/eagle-swap.db'),
  path.join(process.cwd(), 'data/eagleswap.db'), // Prioritize data/eagleswap.db as seen on server
  path.join(process.cwd(), 'src/database/eagle-swap.db'),
  path.join(process.cwd(), 'database/eagle-swap.db'),
  '/app/data/eagleswap.db',
  '/app/data/eagle-swap.db'
];

let dbPath = '';
for (const p of possibleDbPaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  console.error('❌ [OTC Sync] Database file not found!');
  process.exit(1);
}

console.log('✅ [OTC Sync] Using database:', dbPath);
const db = new Database(dbPath);

// 2. Contract Configuration
const CONFIG = {
  BSC: {
    name: 'BSC',
    chainId: 56,
    rpc: 'https://bsc-dataseed.binance.org',
    contract: '0xc7801000FCBfF7C2fA05F6B38Ead39401F0551F6',
    startBlock: 46000000 // Approx recent block to scan from (adjust if needed)
  },
  XLAYER: {
    name: 'X Layer',
    chainId: 196,
    rpc: 'https://rpc.xlayer.tech',
    contract: '0x22579d6C47edEC5Cb31Dd1fD238C7d0892Fd285c',
    startBlock: 6000000 // Approx recent block
  }
};

// Minimal ABI
const ABI = [
  "event OrderCreated(uint256 indexed orderId, bytes32 indexed pairId, address indexed maker, uint8 orderType, uint256 price, uint256 baseAmount)",
  "function orders(uint256) view returns (uint256 orderId, bytes32 pairId, address maker, uint8 orderType, address baseToken, address quoteToken, uint256 price, uint256 baseAmount, uint256 filledAmount, uint256 lockedAmount, uint256 expiryTime, uint8 status, uint256 createdAt, uint256 lastFilledAt)"
];

async function syncNetwork(networkConfig) {
  console.log(`\n📡 [OTC Sync] Syncing ${networkConfig.name}...`);
  
  try {
    const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
    const contract = new ethers.Contract(networkConfig.contract, ABI, provider);
    
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`   Current Block: ${currentBlock}`);
    
    // Scan range (limit to last 50000 blocks to be safe with RPC limits)
    // If you need deeper history, run in chunks
    const fromBlock = Math.max(networkConfig.startBlock, currentBlock - 50000);
    console.log(`   Scanning from block: ${fromBlock}`);

    // Fetch Events
    const filter = contract.filters.OrderCreated();
    const events = await contract.queryFilter(filter, fromBlock, currentBlock);
    console.log(`   Found ${events.length} OrderCreated events`);

    let newOrders = 0;
    let updatedOrders = 0;

    for (const event of events) {
      const orderId = event.args[0].toString(); // orderId is BigInt
      const maker = event.args[2];
      const txHash = event.transactionHash;
      
      process.stdout.write(`   Processing Order #${orderId}... `);

      // Fetch current order status from contract
      try {
        const orderData = await contract.orders(orderId);
        
        // orderData mapping based on ABI:
        // 0: orderId
        // 1: pairId
        // 2: maker
        // 3: orderType (0: Buy, 1: Sell)
        // 4: baseToken
        // 5: quoteToken
        // 6: price
        // 7: baseAmount
        // 8: filledAmount
        // 9: lockedAmount
        // 10: expiryTime
        // 11: status (0: Open, 1: Filled, 2: Cancelled)
        
        const statusEnum = Number(orderData[11]);
        const statusMap = ['open', 'filled', 'cancelled'];
        const status = statusMap[statusEnum] || 'unknown';
        
        const amountRemaining = ethers.formatUnits(orderData[7] - orderData[8], 0); // Keep as Wei string for DB
        const price = ethers.formatUnits(orderData[6], 6); // Assuming USDT is 6 decimals
        
        // Map Buy/Sell
        const isBuy = Number(orderData[3]) === 0;
        const type = isBuy ? 'buy' : 'sell';
        
        // Determine tokens
        let tokenSell, tokenBuy, amountSell, amountBuy;
        
        if (isBuy) {
           // Buy Base (Eagle) with Quote (USDT)
           tokenBuy = orderData[4]; // baseToken
           tokenSell = orderData[5]; // quoteToken
           // Amounts are tricky without full context, but for DB display:
           amountBuy = orderData[7].toString(); // baseAmount
           amountSell = (BigInt(amountBuy) * BigInt(orderData[6]) / BigInt(1e18)).toString(); // approx quote amount
        } else {
           // Sell Base (Eagle) for Quote (USDT)
           tokenSell = orderData[4]; // baseToken
           tokenBuy = orderData[5]; // quoteToken
           amountSell = orderData[7].toString();
           amountBuy = (BigInt(amountSell) * BigInt(orderData[6]) / BigInt(1e18)).toString();
        }

        // Insert/Update DB
        const existing = db.prepare('SELECT id FROM otc_orders WHERE order_id = ? AND network = ?').get(orderId, networkConfig.name);
        
        if (existing) {
          db.prepare('UPDATE otc_orders SET status = ?, updated_at = ? WHERE id = ?').run(
            status, 
            Math.floor(Date.now()/1000), 
            existing.id
          );
          process.stdout.write(`Updated (${status})\n`);
          updatedOrders++;
        } else {
          const insert = db.prepare(`
            INSERT INTO otc_orders (
              order_id, maker_address, side, 
              token_sell, token_buy,
              amount_sell, amount_buy, amount_remaining,
              price_usdt, status,
              created_at, expiry_ts, updated_at,
              network, chain_id, tx_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          insert.run(
            orderId,
            maker.toLowerCase(),
            type,
            tokenSell.toLowerCase(),
            tokenBuy.toLowerCase(),
            amountSell,
            amountBuy,
            amountRemaining, // Storing remaining amount
            price,
            status,
            Number(orderData[12]), // created_at
            Number(orderData[10]), // expiry_ts
            Math.floor(Date.now()/1000),
            networkConfig.name,
            networkConfig.chainId,
            txHash
          );
          process.stdout.write(`Inserted (${status})\n`);
          newOrders++;
        }

      } catch (err) {
        console.log(`Error fetching order ${orderId}:`, err.message);
      }
    }
    
    console.log(`\n✅ [${networkConfig.name}] Sync Complete: ${newOrders} new, ${updatedOrders} updated.`);

  } catch (error) {
    console.error(`❌ [${networkConfig.name}] Error:`, error.message);
  }
}

async function main() {
  await syncNetwork(CONFIG.BSC);
  await syncNetwork(CONFIG.XLAYER);
  console.log('\n🎉 All networks synced!');
  db.close();
}

main();
