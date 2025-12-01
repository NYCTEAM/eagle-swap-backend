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
        
        // Multi-chain NFT sync (set to 'true' to enable)
        USE_MULTICHAIN_NFT_SYNC: 'true',
        
        // X Layer configuration
        XLAYER_RPC_URL: 'https://rpc1.eagleswap.llc/xlayer/',
        XLAYER_NFT_ADDRESS: '0x8d3FBe540CBe8189333A1758cE3801067A023809',
        
        // BSC configuration
        BSC_RPC_URL: 'https://bsc-dataseed.binance.org',
        BSC_NFT_ADDRESS: '0xB6966D11898D7c6bC0cC942C013e314e2b4C4d15',
        BSC_MARKETPLACE_ADDRESS: '0x95c212b1ABa037266155F8af3CCF3DdAb64456E5',
        
        // Legacy support (for single-chain mode)
        NFT_CONTRACT_ADDRESS: '0x8d3FBe540CBe8189333A1758cE3801067A023809',
        USDT_CONTRACT_ADDRESS: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
        X_LAYER_RPC_URL: 'https://rpc1.eagleswap.llc/xlayer/',
      },
    },
  ],
};
