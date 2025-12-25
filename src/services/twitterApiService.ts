/**
 * TwitterAPI.io 服务
 * 官方文档: https://docs.twitterapi.io
 */

import https from 'https';

interface TwitterApiConfig {
  apiKey: string;
}

interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  author: {
    userName: string;
    name: string;
    id: string;
  };
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  viewCount: number;
  isReply: boolean;
  inReplyToUsername?: string;
}

interface FetchTweetsResponse {
  tweets: Tweet[];
  has_next_page: boolean;
  next_cursor?: string;
  status: string;
}

export class TwitterApiService {
  private apiKey: string;

  constructor(config: TwitterApiConfig) {
    this.apiKey = config.apiKey;
  }

  /**
   * 获取用户最新推文
   */
  async fetchUserTweets(username: string, limit: number = 20): Promise<Tweet[]> {
    try {
      const result = await this.makeRequest<FetchTweetsResponse>(
        `/twitter/user/last_tweets?userName=${username}`
      );

      if (result.status === 'success' && result.tweets) {
        return result.tweets.slice(0, limit);
      }

      return [];
    } catch (error) {
      console.error(`❌ Failed to fetch tweets for @${username}:`, error);
      return [];
    }
  }

  /**
   * 批量获取多个用户的推文
   */
  async fetchMultipleUserTweets(usernames: string[], limit: number = 20): Promise<Map<string, Tweet[]>> {
    const results = new Map<string, Tweet[]>();

    for (const username of usernames) {
      const tweets = await this.fetchUserTweets(username, limit);
      results.set(username, tweets);

      // 避免请求过快
      if (usernames.indexOf(username) < usernames.length - 1) {
        await this.sleep(1000);
      }
    }

    return results;
  }

  /**
   * 发起 HTTPS 请求
   */
  private makeRequest<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.twitterapi.io',
        path: path,
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
let twitterApiService: TwitterApiService | null = null;

export function getTwitterApiService(): TwitterApiService {
  if (!twitterApiService) {
    const apiKey = process.env.TWITTER_API_KEY || '';
    if (!apiKey) {
      throw new Error('TWITTER_API_KEY is not set');
    }
    twitterApiService = new TwitterApiService({ apiKey });
  }
  return twitterApiService;
}
