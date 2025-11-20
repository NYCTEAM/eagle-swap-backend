const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'eagle-swap.db');

console.log('Adding user profile fields...\n');

try {
  const db = new Database(dbPath);
  
  // Add username field
  try {
    db.exec('ALTER TABLE users ADD COLUMN username TEXT');
    console.log('✅ Added username field');
  } catch (e) {
    if (e.message.includes('duplicate')) {
      console.log('⚠️  username field already exists');
    } else {
      throw e;
    }
  }
  
  // Add avatar_url field
  try {
    db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
    console.log('✅ Added avatar_url field');
  } catch (e) {
    if (e.message.includes('duplicate')) {
      console.log('⚠️  avatar_url field already exists');
    } else {
      throw e;
    }
  }
  
  db.close();
  console.log('\n🎉 User profile fields ready!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
