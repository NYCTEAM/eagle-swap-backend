
const Database = require('better-sqlite3');
const path = require('path');

// User address
const userAddress = '0x4Af7F86C70a6FbA4ED9d49074D0805A3c63B1E5B';

try {
    const dbPath = path.join(__dirname, 'data', 'eagleswap.db');
    console.log('Opening database:', dbPath);
    const db = new Database(dbPath, { readonly: true });

    // 1. Check Config
    const config = db.prepare('SELECT * FROM swap_mining_config WHERE id = 1').get();
    console.log('\n--- Swap Mining Config ---');
    console.log(config);

    // 2. Check User NFTs and Multiplier
    const userNfts = db.prepare('SELECT * FROM user_nfts WHERE owner_address = ?').all(userAddress.toLowerCase());
    console.log('\n--- User NFTs ---');
    console.log(`Found ${userNfts.length} NFTs`);
    userNfts.forEach(nft => {
        console.log(`Token ID: ${nft.token_id}, Level: ${nft.level}, Multiplier: ${nft.bonus_multiplier}x`);
    });

    // 3. Check Level Bonus Config
    const levelBonus = db.prepare('SELECT * FROM nft_level_bonus').all();
    console.log('\n--- NFT Level Bonus Config ---');
    levelBonus.forEach(lb => {
        console.log(`Level ${lb.nft_level}: ${lb.bonus_multiplier}x`);
    });

    // 4. Check Recent Reward Logs
    const logs = db.prepare(`
        SELECT * FROM swap_mining_nft_bonus_log 
        WHERE user_address = ? 
        ORDER BY id DESC 
        LIMIT 5
    `).all(userAddress.toLowerCase()); // Check lowercase too just in case
    
    // Try case-insensitive search if empty
    let logs2 = [];
    if (logs.length === 0) {
         logs2 = db.prepare(`
            SELECT * FROM swap_mining_nft_bonus_log 
            WHERE user_address LIKE ? 
            ORDER BY id DESC 
            LIMIT 5
        `).all(userAddress);
    }

    console.log('\n--- Recent Bonus Logs ---');
    const finalLogs = logs.length > 0 ? logs : logs2;
    if (finalLogs.length === 0) {
        console.log('No bonus logs found for this user.');
    } else {
        finalLogs.forEach(log => {
            console.log(`TX: ${log.tx_hash.substring(0, 10)}...`);
            console.log(`   Base Reward: ${log.base_reward}`);
            console.log(`   NFT Weight: ${log.nft_weight} (Multiplier: ${(log.bonus_percent/100 + 1).toFixed(1)}x)`);
            console.log(`   Bonus Amount: ${log.bonus_amount}`);
            console.log(`   Final Reward: ${log.final_reward}`);
            console.log('-------------------');
        });
    }
    
    // 5. Check Recent Transactions
     const txs = db.prepare(`
        SELECT * FROM swap_transactions 
        WHERE user_address LIKE ? 
        ORDER BY id DESC 
        LIMIT 3
    `).all(userAddress);
    console.log('\n--- Recent Swap Transactions ---');
    txs.forEach(tx => {
        console.log(`TX: ${tx.tx_hash.substring(0, 10)}...`);
        console.log(`   Pair: ${tx.from_token_symbol} -> ${tx.to_token_symbol}`);
        console.log(`   Value USDT: $${tx.trade_value_usdt}`);
        console.log(`   Eagle Reward: ${tx.eagle_reward}`);
    });

} catch (error) {
    console.error('Error:', error);
}
