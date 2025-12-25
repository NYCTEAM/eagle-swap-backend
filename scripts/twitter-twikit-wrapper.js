#!/usr/bin/env node
/**
 * Node.js wrapper for Twikit Python script
 * 用于从 Node.js 调用 Python Twikit 脚本
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * 执行 Python 脚本
 * @param {string[]} args - 命令行参数
 * @returns {Promise<object>} 执行结果
 */
function executePythonScript(args) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'twitter-login-twikit.py');
    const python = spawn('python3', [scriptPath, ...args]);
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}\n${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse JSON output: ${stdout}\n${stderr}`));
      }
    });
    
    python.on('error', (error) => {
      reject(new Error(`Failed to start Python script: ${error.message}`));
    });
  });
}

/**
 * 使用 Twikit 登录 Twitter
 * @param {string} username - Twitter 用户名
 * @param {string} email - Twitter 邮箱
 * @param {string} password - Twitter 密码
 * @param {string} cookiesFile - Cookie 保存路径
 * @returns {Promise<object>} 登录结果
 */
async function loginTwitter(username, email, password, cookiesFile) {
  console.log('🔐 正在使用 Twikit 登录 Twitter...');
  
  try {
    const result = await executePythonScript([
      'login',
      username,
      email,
      password,
      cookiesFile
    ]);
    
    if (result.success) {
      console.log('✅ 登录成功!');
      console.log(`👤 用户: ${result.user.name} (@${result.user.screen_name})`);
      console.log(`📁 Cookies 已保存到: ${result.cookies_file}`);
    } else {
      console.error('❌ 登录失败:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 验证 cookies 是否有效
 * @param {string} cookiesFile - Cookie 文件路径
 * @returns {Promise<object>} 验证结果
 */
async function verifyCookies(cookiesFile) {
  console.log('🔍 正在验证 cookies...');
  
  try {
    const result = await executePythonScript([
      'verify',
      cookiesFile
    ]);
    
    if (result.success) {
      console.log('✅ Cookies 有效!');
      console.log(`👤 用户: ${result.user.name} (@${result.user.screen_name})`);
    } else {
      console.error('❌ Cookies 无效:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// CLI 模式
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'login') {
    const username = process.argv[3] || process.env.TWITTER_USERNAME;
    const email = process.argv[4] || process.env.TWITTER_EMAIL;
    const password = process.argv[5] || process.env.TWITTER_PASSWORD;
    const cookiesFile = process.argv[6] || path.join(__dirname, '../data/twitter_cookies.json');
    
    if (!username || !email || !password) {
      console.error('❌ 缺少参数!');
      console.log('用法: node twitter-twikit-wrapper.js login <username> <email> <password> [cookies_file]');
      console.log('或设置环境变量: TWITTER_USERNAME, TWITTER_EMAIL, TWITTER_PASSWORD');
      process.exit(1);
    }
    
    loginTwitter(username, email, password, cookiesFile)
      .then(result => {
        process.exit(result.success ? 0 : 1);
      });
      
  } else if (command === 'verify') {
    const cookiesFile = process.argv[3] || path.join(__dirname, '../data/twitter_cookies.json');
    
    verifyCookies(cookiesFile)
      .then(result => {
        process.exit(result.success ? 0 : 1);
      });
      
  } else {
    console.error('❌ 未知命令:', command);
    console.log('用法:');
    console.log('  node twitter-twikit-wrapper.js login <username> <email> <password> [cookies_file]');
    console.log('  node twitter-twikit-wrapper.js verify [cookies_file]');
    process.exit(1);
  }
}

module.exports = {
  loginTwitter,
  verifyCookies
};
