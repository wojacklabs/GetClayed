require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // Irys testnet
    irysTestnet: {
      url: "https://testnet-rpc.irys.xyz/v1/execution-rpc",
      chainId: 1270,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    // For future mainnet deployment
    irysMainnet: {
      url: "https://rpc.irys.xyz/v1/execution-rpc",
      chainId: 1271,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    }
  }
};

