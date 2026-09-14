require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

// Robinhood Chain network parameters
// Mainnet: chainId 4663  | RPC https://rpc.mainnet.chain.robinhood.com
// Testnet: chainId 46630 | RPC https://rpc.testnet.chain.robinhood.com
// Explorer: https://robinhoodchain.blockscout.com
// Gas token: ETH (Arbitrum Orbit / Nitro stack — fully EVM compatible)

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      viaIR: true,
    },
  },
  networks: {
    hardhat: {},
    robinhood: {
      url: process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts,
    },
    "robinhood-testnet": {
      url: process.env.RPC_URL_TESTNET || "https://rpc.testnet.chain.robinhood.com",
      chainId: 46630,
      accounts,
    },
  },
};
