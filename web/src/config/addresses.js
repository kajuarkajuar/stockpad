// ─── MemePad contract addresses ────────────────────────────────────────────
// Deployed on Robinhood Chain TESTNET (chainId 46630).
// Mainnet (4663): deploy with `npx hardhat run scripts/deploy.js --network robinhood`
// then paste the addresses here.

export const CONTRACTS = {
  // testnet
  launchpad: "0x1dcc8C8d7Eb74d02B62E86e43e7B2028Abd40dF9",
  router: "0xbF9FCb2f0912e0Fd8E97B92De0B8C4Ba108d3c14",
  pairFactory: "0xEFbd1387a348dD5D2beC386Cc73B45D8c2F39113",
  tokenFactory: "0x90C91E95c3e14196a2482837d77614F37d29B636",
};

export const isDeployed = () => /^0x[0-9a-fA-F]{40}$/.test(CONTRACTS.launchpad) && !/^0x0+$/.test(CONTRACTS.launchpad);
