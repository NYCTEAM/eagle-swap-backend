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
        
        // X Layer configuration (Multi-Chain Global Token ID)
        XLAYER_RPC_URL: 'https://rpc1.eagleswap.llc/xlayer/',
        XLAYER_NFT_ADDRESS: '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7', // NEW: Multi-Chain Global
        
        // BSC configuration (Multi-Chain Global Token ID)
        BSC_RPC_URL: 'https://bsc-dataseed.binance.org',
        BSC_NFT_ADDRESS: '0xc0a4ab40306FD77abB8Ccd376876b276423d40af', // NEW: Multi-Chain Global
        BSC_MARKETPLACE_ADDRESS: '0x95c212b1ABa037266155F8af3CCF3DdAb64456E5',
        
        // Legacy support (for single-chain mode) - Updated to new contract
        NFT_CONTRACT_ADDRESS: '0xfe016c9A9516AcB14d504aE821C46ae2bc968cd7',
        USDT_CONTRACT_ADDRESS: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
        X_LAYER_RPC_URL: 'https://rpc1.eagleswap.llc/xlayer/',
      },
    },
  ],
};
