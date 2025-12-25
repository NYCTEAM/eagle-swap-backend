# Twitter Login with Twikit

使用 [Twikit](https://github.com/d60/twikit) 实现更可靠的 Twitter 登录方案。

## ✨ 优势

- ✅ **不需要 API Key**（使用 Twitter 内部 API）
- ✅ **免费**
- ✅ **更稳定**（相比 Playwright 自动化）
- ✅ **Cookie 持久化**
- ✅ **异步支持**

## 📦 安装

### 方法 1：使用安装脚本（推荐）

```bash
# 在服务器上运行
npm run install-twikit
```

### 方法 2：手动安装

```bash
# 安装 Python3 和 pip（如果还没有）
apt-get update
apt-get install -y python3 python3-pip

# 安装 twikit
pip3 install twikit
```

## 🚀 使用方法

### 1. 登录 Twitter

```bash
# 使用命令行参数
npm run twitter-twikit-login -- <username> <email> <password>

# 或使用环境变量
export TWITTER_USERNAME="adog_official"
export TWITTER_EMAIL="cibihuang38@gmail.com"
export TWITTER_PASSWORD="dan12345678"
npm run twitter-twikit-login
```

### 2. 验证 Cookies

```bash
npm run twitter-twikit-verify
```

### 3. 在代码中使用

```javascript
const { loginTwitter, verifyCookies } = require('./scripts/twitter-twikit-wrapper');

// 登录
const result = await loginTwitter(
  'username',
  'email@example.com',
  'password',
  './data/twitter_cookies.json'
);

if (result.success) {
  console.log('登录成功!', result.user);
}

// 验证 cookies
const verified = await verifyCookies('./data/twitter_cookies.json');
if (verified.success) {
  console.log('Cookies 有效!', verified.user);
}
```

## 🔧 集成到后端服务

修改 `src/services/twitterScraperService.ts`：

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

async function loginWithTwikit() {
  const username = process.env.TWITTER_USERNAME;
  const email = process.env.TWITTER_EMAIL;
  const password = process.env.TWITTER_PASSWORD;
  const cookiesFile = path.join(__dirname, '../../data/twitter_cookies.json');
  
  try {
    const { stdout } = await execAsync(
      `python3 scripts/twitter-login-twikit.py login "${username}" "${email}" "${password}" "${cookiesFile}"`
    );
    
    const result = JSON.parse(stdout);
    return result;
  } catch (error) {
    console.error('Twikit 登录失败:', error);
    return { success: false, error: error.message };
  }
}

async function verifyTwitterCookies() {
  const cookiesFile = path.join(__dirname, '../../data/twitter_cookies.json');
  
  try {
    const { stdout } = await execAsync(
      `python3 scripts/twitter-login-twikit.py verify "${cookiesFile}"`
    );
    
    const result = JSON.parse(stdout);
    return result;
  } catch (error) {
    console.error('Cookies 验证失败:', error);
    return { success: false, error: error.message };
  }
}
```

## 📁 文件结构

```
eagle-swap-backend/
├── scripts/
│   ├── twitter-login-twikit.py       # Python 登录脚本
│   ├── twitter-twikit-wrapper.js     # Node.js 包装器
│   └── install-twikit.sh             # 安装脚本
├── data/
│   └── twitter_cookies.json          # Cookie 存储
└── docs/
    └── TWITTER_TWIKIT_SETUP.md       # 本文档
```

## 🔒 安全建议

1. **不要提交 cookies 文件到 Git**
   ```bash
   echo "data/twitter_cookies.json" >> .gitignore
   ```

2. **使用环境变量存储凭据**
   ```bash
   # .env
   TWITTER_USERNAME=your_username
   TWITTER_EMAIL=your_email
   TWITTER_PASSWORD=your_password
   ```

3. **定期更新 cookies**
   - 设置定时任务每天验证 cookies
   - 如果失效，自动重新登录

## 🐛 故障排除

### 问题 1：Python3 未找到

```bash
# Ubuntu/Debian
apt-get install -y python3 python3-pip

# CentOS/RHEL
yum install -y python3 python3-pip
```

### 问题 2：Twikit 导入失败

```bash
pip3 install --upgrade twikit
```

### 问题 3：登录失败

- 检查用户名、邮箱、密码是否正确
- 检查网络连接
- 检查 Twitter 是否要求验证码（可能需要手动登录一次）

## 📚 相关资源

- [Twikit GitHub](https://github.com/d60/twikit)
- [Twikit 文档](https://twikit.readthedocs.io/)
- [Twitter API 替代方案](https://github.com/topics/twitter-scraper)

## 🔄 迁移指南

从旧的 Playwright 方案迁移到 Twikit：

1. **安装 Twikit**
   ```bash
   npm run install-twikit
   ```

2. **测试登录**
   ```bash
   npm run twitter-twikit-login
   ```

3. **更新服务代码**
   - 替换 `twitterScraperService.ts` 中的登录逻辑
   - 使用 `twitter-twikit-wrapper.js` 提供的函数

4. **禁用旧的自动登录**
   ```bash
   # 在 Coolify 环境变量中设置
   DISABLE_TWITTER_LOGIN=true
   ```

5. **设置定时验证**
   ```typescript
   // 每天验证一次 cookies
   cron.schedule('0 0 * * *', async () => {
     const result = await verifyCookies('./data/twitter_cookies.json');
     if (!result.success) {
       // 重新登录
       await loginTwitter(username, email, password, cookiesFile);
     }
   });
   ```

## ✅ 测试清单

- [ ] Python3 已安装
- [ ] Twikit 已安装
- [ ] 登录成功
- [ ] Cookies 已保存
- [ ] Cookies 验证通过
- [ ] 后端服务集成完成
- [ ] 定时验证任务设置完成
