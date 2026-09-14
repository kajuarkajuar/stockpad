// Robinhood Chain Stock Tokens (ERC-20).
//
// TESTNET (chainId 46630) — only TSLA / AMZN / NFLX exist on testnet.
// Get them from the faucet: https://faucet.testnet.chain.robinhood.com
export const STOCKS = {
  TSLA: { name: "Tesla Inc.", address: "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E", color: "#e82127" },
  AMZN: { name: "Amazon.com Inc.", address: "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02", color: "#ff9900" },
  NFLX: { name: "Netflix Inc.", address: "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93", color: "#e50914" },
};

// MAINNET (chainId 4663) — full list. Switch STOCKS to these when deploying mainnet.
// Verify against https://robinhoodchain.blockscout.com before production use.
export const STOCKS_MAINNET = {
  NVDA: { name: "NVIDIA Corp.", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", color: "#76b900" },
  AAPL: { name: "Apple Inc.", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", color: "#a2aaad" },
  TSLA: { name: "Tesla Inc.", address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", color: "#e82127" },
  AMZN: { name: "Amazon.com Inc.", address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", color: "#ff9900" },
  MSFT: { name: "Microsoft Corp.", address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", color: "#00a4ef" },
  GOOGL: { name: "Alphabet Inc.", address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", color: "#4285f4" },
  META: { name: "Meta Platforms", address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", color: "#0866ff" },
  SPY: { name: "SPDR S&P 500 ETF", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", color: "#9a3324" },
};

export const STOCK_TICKERS = Object.keys(STOCKS);
