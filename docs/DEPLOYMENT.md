# Eagle Swap Backend 部署指南

## 概述

本文档详细说明了如何在不同环境中部署 Eagle Swap Backend 服务。

## 系统要求

### 最低要求

- **操作系统**: Windows 10/11, Ubuntu 18.04+, CentOS 7+, macOS 10.15+
- **Node.js**: >= 16.0.0
- **内存**: >= 2GB RAM
- **存储**: >= 10GB 可用空间
- **网络**: 稳定的互联网连接

### 推荐配置

- **CPU**: 4 核心或更多
- **内存**: >= 8GB RAM
- **存储**: >= 50GB SSD
- **网络**: 100Mbps+ 带宽

## 部署环境

### 开发环境

适用于本地开发和测试。

#### 1. 环境准备

```bash
# 检查 Node.js 版本
node --version  # 应该 >= 16.0.0
npm --version   # 应该 >= 8.0.0

# 安装 pnpm (可选，推荐)
npm install -g pnpm
```

#### 2. 项目设置

```bash
# 克隆项目
git clone <repository-url>
cd eagle-swap-backend

# 快速设置 (Windows)
scripts\setup.bat

# 或手动设置
npm install
cp .env.example .env
# 编辑 .env 文件
npm run db:init
npm run db:seed
```

#### 3. 启动服务

```bash
# 开发模式
npm run dev

# 或使用脚本
scripts\dev.bat
```

### 测试环境

适用于集成测试和预发布验证。

#### 1. 环境配置

```bash
# 设置环境变量
export NODE_ENV=test
export PORT=3001
export DATABASE_PATH=./data/test-eagle-swap.db
```

#### 2. 数据库设置

```bash
# 使用测试数据库
npm run db:init
# 不建议在测试环境使用 seed 数据
```

#### 3. 启动服务

```bash
npm run build
npm start
```

### 生产环境

适用于正式生产部署。

#### 1. 服务器准备

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm git

# CentOS/RHEL
sudo yum install -y nodejs npm git

# 安装 PM2 (进程管理器)
npm install -g pm2
```

#### 2. 项目部署

```bash
# 创建部署目录
sudo mkdir -p /opt/eagle-swap-backend
sudo chown $USER:$USER /opt/eagle-swap-backend

# 克隆项目
cd /opt/eagle-swap-backend
git clone <repository-url> .

# 安装依赖
npm ci --only=production

# 构建项目
npm run build
```

#### 3. 环境配置

```bash
# 复制并编辑生产环境配置
cp .env.example .env.production

# 编辑生产配置
nano .env.production
```

生产环境 `.env.production` 示例：

```env
# 生产环境配置
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# 数据库配置
DATABASE_PATH=/opt/eagle-swap-backend/data/eagle-swap.db

# Eagle RPC Backend
EAGLE_RPC_URL=http://localhost:3000
EAGLE_RPC_TIMEOUT=30000

# 安全配置
JWT_SECRET=your-super-secure-jwt-secret-key-here
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# 日志配置
LOG_LEVEL=warn
LOG_FILE=/var/log/eagle-swap/eagle-swap.log

# 性能配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

#### 4. 数据库初始化

```bash
# 创建数据目录
sudo mkdir -p /opt/eagle-swap-backend/data
sudo chown $USER:$USER /opt/eagle-swap-backend/data

# 初始化数据库
NODE_ENV=production npm run db:init
```

#### 5. 日志目录设置

```bash
# 创建日志目录
sudo mkdir -p /var/log/eagle-swap
sudo chown $USER:$USER /var/log/eagle-swap
```

#### 6. PM2 配置

创建 `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'eagle-swap-backend',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_file: '.env.production',
    log_file: '/var/log/eagle-swap/combined.log',
    out_file: '/var/log/eagle-swap/out.log',
    error_file: '/var/log/eagle-swap/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

#### 7. 启动服务

```bash
# 使用 PM2 启动
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 按照提示执行命令
```

## Docker 部署

### 1. Dockerfile

创建 `Dockerfile`:

```dockerfile
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建项目
RUN npm run build

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S eagle -u 1001

# 创建必要目录
RUN mkdir -p /app/data /app/logs
RUN chown -R eagle:nodejs /app

# 切换到非 root 用户
USER eagle

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# 启动命令
CMD ["npm", "start"]
```

### 2. Docker Compose

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  eagle-swap-backend:
    build: .
    container_name: eagle-swap-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOST=0.0.0.0
      - DATABASE_PATH=/app/data/eagle-swap.db
      - EAGLE_RPC_URL=http://eagle-rpc-backend:3000
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./.env.production:/app/.env
    depends_on:
      - eagle-rpc-backend
    networks:
      - eagle-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  eagle-rpc-backend:
    image: eagle-rpc-backend:latest
    container_name: eagle-rpc-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    networks:
      - eagle-network

networks:
  eagle-network:
    driver: bridge

volumes:
  eagle-data:
  eagle-logs:
```

### 3. 构建和启动

```bash
# 构建镜像
docker build -t eagle-swap-backend .

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f eagle-swap-backend

# 停止服务
docker-compose down
```

## Nginx 反向代理

### 1. 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

### 2. 配置 Nginx

创建 `/etc/nginx/sites-available/eagle-swap-backend`:

```nginx
upstream eagle_swap_backend {
    server 127.0.0.1:3001;
    # 如果使用集群模式，可以添加多个服务器
    # server 127.0.0.1:3002;
    # server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL 配置
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # 日志配置
    access_log /var/log/nginx/eagle-swap-backend.access.log;
    error_log /var/log/nginx/eagle-swap-backend.error.log;

    # 代理配置
    location / {
        proxy_pass http://eagle_swap_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查
    location /health {
        proxy_pass http://eagle_swap_backend/health;
        access_log off;
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. 启用配置

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/eagle-swap-backend /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

## 监控和日志

### 1. 系统监控

#### PM2 监控

```bash
# 查看进程状态
pm2 status

# 查看详细信息
pm2 show eagle-swap-backend

# 查看日志
pm2 logs eagle-swap-backend

# 监控面板
pm2 monit
```

#### 系统资源监控

```bash
# 安装 htop
sudo apt install htop

# 监控系统资源
htop

# 监控磁盘使用
df -h

# 监控内存使用
free -h
```

### 2. 日志管理

#### 日志轮转

创建 `/etc/logrotate.d/eagle-swap-backend`:

```
/var/log/eagle-swap/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 eagle eagle
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### 日志查看

```bash
# 查看实时日志
tail -f /var/log/eagle-swap/eagle-swap.log

# 查看错误日志
tail -f /var/log/eagle-swap/error.log

# 搜索日志
grep "ERROR" /var/log/eagle-swap/eagle-swap.log
```

## 备份和恢复

### 1. 数据库备份

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/backups/eagle-swap"
DB_PATH="/opt/eagle-swap-backend/data/eagle-swap.db"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp $DB_PATH $BACKUP_DIR/eagle-swap_$DATE.db

# 压缩备份
gzip $BACKUP_DIR/eagle-swap_$DATE.db

# 删除 7 天前的备份
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: eagle-swap_$DATE.db.gz"
```

### 2. 自动备份

```bash
# 添加到 crontab
crontab -e

# 每天凌晨 2 点备份
0 2 * * * /opt/eagle-swap-backend/scripts/backup.sh
```

### 3. 恢复数据

```bash
# 停止服务
pm2 stop eagle-swap-backend

# 恢复数据库
gunzip -c /opt/backups/eagle-swap/eagle-swap_20240101_020000.db.gz > /opt/eagle-swap-backend/data/eagle-swap.db

# 启动服务
pm2 start eagle-swap-backend
```

## 性能优化

### 1. Node.js 优化

```bash
# 设置内存限制
export NODE_OPTIONS="--max-old-space-size=2048"

# 启用 V8 优化
export NODE_OPTIONS="--optimize-for-size"
```

### 2. 数据库优化

```sql
-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tokens_chain_id ON tokens(chain_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_address ON transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
```

### 3. 缓存优化

在 `.env` 中配置缓存：

```env
# 缓存配置
CACHE_TTL_SECONDS=300
PRICE_CACHE_TTL_SECONDS=60
```

## 安全配置

### 1. 防火墙设置

```bash
# Ubuntu UFW
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp  # 仅在需要直接访问时开放
sudo ufw enable

# CentOS firewalld
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

### 2. SSL/TLS 配置

```bash
# 使用 Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### 3. 安全更新

```bash
# 定期更新系统
sudo apt update && sudo apt upgrade

# 更新 Node.js 依赖
npm audit
npm audit fix
```

## 故障排除

### 1. 常见问题

#### 服务无法启动

```bash
# 检查端口占用
netstat -tlnp | grep 3001

# 检查日志
pm2 logs eagle-swap-backend

# 检查配置
npm run check
```

#### 数据库连接失败

```bash
# 检查数据库文件权限
ls -la /opt/eagle-swap-backend/data/

# 重新初始化数据库
npm run db:init
```

#### 内存不足

```bash
# 检查内存使用
free -h

# 重启服务
pm2 restart eagle-swap-backend
```

### 2. 性能问题

```bash
# 检查 CPU 使用率
top

# 检查磁盘 I/O
iotop

# 分析慢查询
# 在应用中启用查询日志
```

### 3. 网络问题

```bash
# 检查网络连接
curl -I http://localhost:3001/health

# 检查 Eagle RPC Backend 连接
curl -I http://localhost:3000/health

# 检查 DNS 解析
nslookup api.yourdomain.com
```

## 升级指南

### 1. 准备升级

```bash
# 备份数据
./scripts/backup.sh

# 停止服务
pm2 stop eagle-swap-backend
```

### 2. 执行升级

```bash
# 拉取最新代码
git pull origin main

# 安装新依赖
npm ci --only=production

# 运行数据库迁移（如果有）
npm run db:migrate

# 构建项目
npm run build
```

### 3. 启动服务

```bash
# 启动服务
pm2 start eagle-swap-backend

# 检查服务状态
pm2 status

# 验证功能
curl http://localhost:3001/health
```

## 联系支持

如果在部署过程中遇到问题，请：

1. 查看日志文件
2. 检查配置文件
3. 参考故障排除部分
4. 联系技术支持团队

---

**注意**: 在生产环境中部署前，请务必在测试环境中验证所有配置和功能。