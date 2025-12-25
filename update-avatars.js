/**
 * 更新现有推文的头像
 */

const Database = require('better-sqlite3');
const https = require('https');

const DB_PATH = '/app/data/eagleswap.db';
const API_KEY = process.env.TWITTER_API_KEY || 'new1_44cfcde4b8dc4ee0b07e07bb25418d9e';

// 获取用户头像
async function getUserAvatar(username) {
  return new Promise((resolve, reject) => {
    const url = `https://api.twitterapi.io/twitter/user/last_tweets?userName=${username}`;
    const options = {
      headers: { 'x-api-key': API_KEY }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data.tweets && json.data.tweets[0]) {
            const avatar = json.data.tweets[0].author.profilePicture;
            resolve(avatar || null);
          } else {
            resolve(null);
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🔄 开始更新头像...\n');

  const db = new Database(DB_PATH);

  // 获取所有没有头像的用户
  const users = db.prepare(`
    SELECT DISTINCT username 
    FROM twitter_posts 
    WHERE user_avatar IS NULL
  `).all();

  console.log(`📊 找到 ${users.length} 个需要更新头像的用户\n`);

  const updateStmt = db.prepare(`
    UPDATE twitter_posts 
    SET user_avatar = ? 
    WHERE username = ? AND user_avatar IS NULL
  `);

  let updated = 0;

  for (const user of users) {
    try {
      console.log(`🔍 获取 @${user.username} 的头像...`);
      const avatar = await getUserAvatar(user.username);

      if (avatar) {
        const result = updateStmt.run(avatar, user.username);
        updated += result.changes;
        console.log(`✅ @${user.username}: ${avatar.substring(0, 60)}...`);
      } else {
        console.log(`⚠️  @${user.username}: 未找到头像`);
      }

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ @${user.username}: ${error.message}`);
    }
  }

  db.close();

  console.log(`\n✅ 完成！更新了 ${updated} 条推文的头像`);
}

main().catch(console.error);
