module.exports = {
  apps: [
    {
      name: 'eagle-backend',
      script: 'dist/app.js',
      cwd: '/www/wwwroot/eagleswap.llc/eagle-swap-backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        DATABASE_PATH: './data/eagle-swap.db',
      },
    },
  ],
};
