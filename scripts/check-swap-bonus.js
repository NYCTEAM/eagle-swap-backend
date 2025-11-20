const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

try {
  const db = new Database(dbPath);
  
  console.log('📊 Checking swap_mining_bonus values...\n');
  
  const users = db.prepare('SELECT wallet_address, username, swap_mining_bonus, referrer_level FROM users').all();
  console.log('Users with swap_mining_bonus:');
  users.forEach(u => {
    console.log(`- ${u.wallet_address} (${u.username || 'No name'}): swap_mining_bonus=${u.swap_mining_bonus}, referrer_level=${u.referrer_level}`);
  });
  
  console.log('\n📊 Checking referrer_level_config table...');
  try {
    const config = db.prepare('SELECT * FROM referrer_level_config').all();
    console.log('Referrer level config:');
    config.forEach(c => {
      console.log(c);
    });
  } catch (error) {
    console.log('referrer_level_config table does not exist or is empty');
  }
  
  db.close();
} catch (error) {
  console.error('Error:', error.message);
}
