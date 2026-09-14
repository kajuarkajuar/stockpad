// ─── StockPad contract addresses ────────────────────────────────────────────
// Deploy with:  cd ../contracts && npx hardhat run scripts/deploy.js --network robinhood
// then paste the printed addresses here.
export const CONTRACTS = {
  launchpad: "0x0000000000000000000000000000000000000000",
  router: "0x0000000000000000000000000000000000000000",
  pairFactory: "0x0000000000000000000000000000000000000000",
  tokenFactory: "0x0000000000000000000000000000000000000000",
};

export const isDeployed = () => /^0x[0-9a-fA-F]{40}$/.test(CONTRACTS.launchpad) && !/^0x0+$/.test(CONTRACTS.launchpad);
