require("@nomicfoundation/hardhat-toolbox");

const PRIVATE_KEY = "2a37bdb9a8e1368dab8310ce45ecbea4e19a1b2698dcf709b6f0bc81c95dfb12";

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    xlayer: {
      url: "https://rpc.xlayer.tech",
      chainId: 196,
      accounts: [PRIVATE_KEY]
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org",
      chainId: 56,
      accounts: [PRIVATE_KEY]
    }
  }
};
