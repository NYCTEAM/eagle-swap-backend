/**
 * Node.js 包装器：使用 Twikit 获取 Twitter 推文
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

/**
 * 获取用户推文
 * @param {string} username - Twitter 用户名（不带 @）
 * @param {string} cookiesFile - Cookie 文件路径
 * @param {number} limit - 获取推文数量
 * @returns {Promise<Object>}
 */
async function fetchUserTweets(username, cookiesFile = './data/twitter_cookies.json', limit = 50) {
  try {
    const scriptPath = path.join(__dirname, 'fetch-tweets-twikit.py');
    const command = `python3 "${scriptPath}" "${username}" "${cookiesFile}" ${limit}`;
    
    console.log(`🐦 Fetching tweets for @${username}...`);
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    if (stderr && !stderr.includes('Warning')) {
      console.error('⚠️ Python stderr:', stderr);
    }
    
    const result = JSON.parse(stdout);
    
    if (result.success) {
      console.log(`✅ Fetched ${result.count} tweets from @${username}`);
    } else {
      console.error(`❌ Failed to fetch tweets: ${result.error}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error fetching tweets:', error.message);
    return {
      success: false,
      error: error.message,
      username
    };
  }
}

/**
 * 批量获取多个用户的推文
 * @param {string[]} usernames - Twitter 用户名列表
 * @param {string} cookiesFile - Cookie 文件路径
 * @param {number} limit - 每个用户获取推文数量
 * @returns {Promise<Object[]>}
 */
async function fetchMultipleUserTweets(usernames, cookiesFile = './data/twitter_cookies.json', limit = 50) {
  const results = [];
  
  for (const username of usernames) {
    const result = await fetchUserTweets(username, cookiesFile, limit);
    results.push(result);
    
    // 避免请求过快，等待 2 秒
    if (usernames.indexOf(username) < usernames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}

// CLI 使用
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node fetch-tweets-wrapper.js <username> [cookies_file] [limit]');
    console.log('');
    console.log('Examples:');
    console.log('  node fetch-tweets-wrapper.js binance');
    console.log('  node fetch-tweets-wrapper.js binance ./data/twitter_cookies.json 100');
    process.exit(1);
  }
  
  const username = args[0];
  const cookiesFile = args[1] || './data/twitter_cookies.json';
  const limit = parseInt(args[2]) || 50;
  
  fetchUserTweets(username, cookiesFile, limit)
    .then(result => {
      console.log('\n📊 Result:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = {
  fetchUserTweets,
  fetchMultipleUserTweets
};
