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
        NFT_CONTRACT_ADDRESS: '0x8d3FBe540CBe8189333A1758cE3801067A023809',
        USDT_CONTRACT_ADDRESS: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
        X_LAYER_RPC_URL: 'https://rpc1.eagleswap.llc/xlayer/',
      },
    },
  ],
};
