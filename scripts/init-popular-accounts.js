/**
 * 初始化热门账号推文
 * 同步 CZ, Binance, Elon, Vitalik, heyibinance 的最新推文
 */

const path = require('path');

// 动态导入 ES 模块
async function main() {
  try {
    // 导入服务
    const { getTwitterApiService } = await import('../dist/services/twitterApiService.js');
    const twitterMonitorService = (await import('../dist/services/twitterMonitorService.js')).default;
    
    // 热门账号列表
    const popularAccounts = [
      { username: 'cz_binance', displayName: 'CZ 🔶 BNB' },
      { username: 'binance', displayName: 'Binance' },
      { username: 'elonmusk', displayName: 'Elon Musk' },
      { username: 'VitalikButerin', displayName: 'Vitalik Buterin' },
      { username: 'heyibinance', displayName: 'Binance Official' }
    ];
    
    console.log('🚀 Initializing popular Twitter accounts...\n');
    
    let totalTweets = 0;
    
    for (const account of popularAccounts) {
      console.log(`📡 Fetching tweets for @${account.username}...`);
      
      try {
        const tweets = await twitterMonitorService.fetchTweetsFromApi(account.username);
        const saved = twitterMonitorService.saveTweets(tweets);
        totalTweets += saved;
        
        console.log(`✅ Saved ${saved} tweets from @${account.username}\n`);
        
        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Failed to fetch @${account.username}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Initialization completed!`);
    console.log(`📊 Total tweets saved: ${totalTweets}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
