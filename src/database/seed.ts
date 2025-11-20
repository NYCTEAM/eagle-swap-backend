import { Database } from 'sqlite3';
import { getDatabase } from './init';
import { logger } from '../utils/logger';

// Sample data for seeding the database
const sampleTokens = [
  {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    chain_id: 1,
    logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    is_verified: 1
  },
  {
    address: '0xa0b86a33e6441e6c7b4b1b248e0b0b4b1b1b1b1b',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    chain_id: 1,
    logo_url: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    is_verified: 1
  },
  {
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    chain_id: 1,
    logo_url: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    is_verified: 1
  },
  // BSC tokens
  {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Binance Coin',
    symbol: 'BNB',
    decimals: 18,
    chain_id: 56,
    logo_url: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    is_verified: 1
  },
  {
    address: '0x55d398326f99059ff775485246999027b3197955',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 18,
    chain_id: 56,
    logo_url: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    is_verified: 1
  }
];

const sampleTokenPrices = [
  {
    token_address: '0x0000000000000000000000000000000000000000',
    chain_id: 1,
    price_usd: '2000.50',
    price_change_24h: 2.5,
    market_cap: '240000000000',
    volume_24h: '15000000000'
  },
  {
    token_address: '0xa0b86a33e6441e6c7b4b1b248e0b0b4b1b1b1b1b',
    chain_id: 1,
    price_usd: '1.00',
    price_change_24h: 0.1,
    market_cap: '25000000000',
    volume_24h: '3000000000'
  },
  {
    token_address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    chain_id: 1,
    price_usd: '1.00',
    price_change_24h: -0.05,
    market_cap: '85000000000',
    volume_24h: '25000000000'
  },
  {
    token_address: '0x0000000000000000000000000000000000000000',
    chain_id: 56,
    price_usd: '300.25',
    price_change_24h: 1.8,
    market_cap: '46000000000',
    volume_24h: '2000000000'
  },
  {
    token_address: '0x55d398326f99059ff775485246999027b3197955',
    chain_id: 56,
    price_usd: '1.00',
    price_change_24h: 0.02,
    market_cap: '85000000000',
    volume_24h: '8000000000'
  }
];

const sampleTradingPairs = [
  {
    pair_address: '0x1234567890123456789012345678901234567890',
    token0: '0x0000000000000000000000000000000000000000',
    token1: '0xa0b86a33e6441e6c7b4b1b248e0b0b4b1b1b1b1b',
    chain_id: 1,
    reserve0: '1000000000000000000000',
    reserve1: '2000000000000',
    total_supply: '44721359549995793928',
    fee_tier: 3000
  },
  {
    pair_address: '0x2345678901234567890123456789012345678901',
    token0: '0x0000000000000000000000000000000000000000',
    token1: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    chain_id: 1,
    reserve0: '500000000000000000000',
    reserve1: '1000000000000',
    total_supply: '22360679774997896964',
    fee_tier: 3000
  },
  {
    pair_address: '0x3456789012345678901234567890123456789012',
    token0: '0x0000000000000000000000000000000000000000',
    token1: '0x55d398326f99059ff775485246999027b3197955',
    chain_id: 56,
    reserve0: '100000000000000000000',
    reserve1: '30000000000000000000000',
    total_supply: '5477225575051661134',
    fee_tier: 2500
  }
];

const sampleFarms = [
  {
    name: 'ETH-USDC LP Farm',
    contract_address: '0x4567890123456789012345678901234567890123',
    staking_token: '0x1234567890123456789012345678901234567890',
    reward_token: '0x0000000000000000000000000000000000000000',
    chain_id: 1,
    apy: 25.5,
    total_staked: '0',
    start_block: 18500000,
    end_block: 19000000,
    reward_per_block: '100000000000000000',
    is_active: 1
  },
  {
    name: 'ETH-USDT LP Farm',
    contract_address: '0x5678901234567890123456789012345678901234',
    staking_token: '0x2345678901234567890123456789012345678901',
    reward_token: '0x0000000000000000000000000000000000000000',
    chain_id: 1,
    apy: 18.2,
    total_staked: '0',
    start_block: 18500000,
    end_block: 19000000,
    reward_per_block: '75000000000000000',
    is_active: 1
  },
  {
    name: 'BNB-USDT LP Farm',
    contract_address: '0x6789012345678901234567890123456789012345',
    staking_token: '0x3456789012345678901234567890123456789012',
    reward_token: '0x0000000000000000000000000000000000000000',
    chain_id: 56,
    apy: 35.8,
    total_staked: '0',
    start_block: 32500000,
    end_block: 33000000,
    reward_per_block: '200000000000000000',
    is_active: 1
  }
];

const sampleUsers = [
  {
    address: '0x742d35cc6634c0532925a3b8d0c9e3e8d4c4c4c4',
    username: 'alice_trader',
    email: 'alice@example.com',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
    preferences: JSON.stringify({
      defaultChain: 1,
      slippageTolerance: 0.5,
      theme: 'dark'
    })
  },
  {
    address: '0x853e46dd7635d1e5e8e5e9e9e9e9e9e9e9e9e9e9',
    username: 'bob_farmer',
    email: 'bob@example.com',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
    preferences: JSON.stringify({
      defaultChain: 56,
      slippageTolerance: 1.0,
      theme: 'light'
    })
  }
];

export async function seedDatabase(): Promise<void> {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Seed tokens
      const insertToken = db.prepare(`
        INSERT OR IGNORE INTO tokens (
          address, name, symbol, decimals, chain_id, logo_url, is_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      sampleTokens.forEach(token => {
        insertToken.run([
          token.address,
          token.name,
          token.symbol,
          token.decimals,
          token.chain_id,
          token.logo_url,
          token.is_verified
        ]);
      });

      insertToken.finalize();
      logger.info('Seeded tokens', { count: sampleTokens.length });

      // Seed token prices
      const insertPrice = db.prepare(`
        INSERT OR IGNORE INTO token_prices (
          token_address, chain_id, price_usd, price_change_24h, market_cap, volume_24h
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      sampleTokenPrices.forEach(price => {
        insertPrice.run([
          price.token_address,
          price.chain_id,
          price.price_usd,
          price.price_change_24h,
          price.market_cap,
          price.volume_24h
        ]);
      });

      insertPrice.finalize();
      logger.info('Seeded token prices', { count: sampleTokenPrices.length });

      // Seed trading pairs
      const insertPair = db.prepare(`
        INSERT OR IGNORE INTO trading_pairs (
          pair_address, token0, token1, chain_id, reserve0, reserve1, total_supply, fee_tier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      sampleTradingPairs.forEach(pair => {
        insertPair.run([
          pair.pair_address,
          pair.token0,
          pair.token1,
          pair.chain_id,
          pair.reserve0,
          pair.reserve1,
          pair.total_supply,
          pair.fee_tier
        ]);
      });

      insertPair.finalize();
      logger.info('Seeded trading pairs', { count: sampleTradingPairs.length });

      // Seed farms
      const insertFarm = db.prepare(`
        INSERT OR IGNORE INTO farms (
          name, contract_address, staking_token, reward_token, chain_id, apy, 
          total_staked, start_block, end_block, reward_per_block, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      sampleFarms.forEach(farm => {
        insertFarm.run([
          farm.name,
          farm.contract_address,
          farm.staking_token,
          farm.reward_token,
          farm.chain_id,
          farm.apy,
          farm.total_staked,
          farm.start_block,
          farm.end_block,
          farm.reward_per_block,
          farm.is_active
        ]);
      });

      insertFarm.finalize();
      logger.info('Seeded farms', { count: sampleFarms.length });

      // Seed users
      const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (
          address, username, email, avatar_url, preferences
        ) VALUES (?, ?, ?, ?, ?)
      `);

      sampleUsers.forEach(user => {
        insertUser.run([
          user.address,
          user.username,
          user.email,
          user.avatar_url,
          user.preferences
        ]);
      });

      insertUser.finalize();
      logger.info('Seeded users', { count: sampleUsers.length });

      logger.info('Database seeding completed successfully');
      resolve();
    });

    db.on('error', (error) => {
      logger.error('Database seeding failed', { error });
      reject(error);
    });
  });
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding failed', { error });
      process.exit(1);
    });
}