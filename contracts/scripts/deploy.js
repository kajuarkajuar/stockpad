// MemePad deployment script
// Deploys: TokenFactory -> StockPairFactory -> Launchpad -> MemePadRouter
// (optional) SyntheticStock example (USDC-collateralized, Chainlink feed)
//
// Usage:
//   npx hardhat run scripts/deploy.js --network robinhood-testnet
//   npx hardhat run scripts/deploy.js --network robinhood
//
// After deploying, paste the printed addresses into ../web/src/config/addresses.ts

const hre = require("hardhat");

// Known Robinhood Chain Stock Token addresses (mainnet, chainId 4663).
// Verify in https://robinhoodchain.blockscout.com before production use.
const STOCK_TOKENS = {
  NVDA: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
  AAPL: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
  TSLA: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
  AMZN: "0x12f190a9F9d7D37a250758b26824B97CE941bF54",
  MSFT: "0xe93237C50D904957Cf27E7B1133b510C669c2e74",
  GOOGL: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",
  META: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",
  SPY: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  console.log(`Deploying MemePad on chainId ${chainId} from ${deployer.address}`);

  const TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
  const StockPairFactory = await hre.ethers.getContractFactory("StockPairFactory");

  const tokenFactory = await TokenFactory.deploy();
  await tokenFactory.waitForDeployment();

  const pairFactory = await StockPairFactory.deploy();
  await pairFactory.waitForDeployment();

  const Launchpad = await hre.ethers.getContractFactory("Launchpad");
  const launchpad = await Launchpad.deploy(
    await tokenFactory.getAddress(),
    await pairFactory.getAddress()
  );
  await launchpad.waitForDeployment();

  // Wire the TokenFactory to the Launchpad (one-time).
  await tokenFactory.setLaunchpad(await launchpad.getAddress());

  const Router = await hre.ethers.getContractFactory("MemePadRouter");
  const router = await Router.deploy(await pairFactory.getAddress());
  await router.waitForDeployment();

  console.log("\n===== MemePad contracts =====");
  console.log(`StockPairFactory : ${await pairFactory.getAddress()}`);
  console.log(`TokenFactory     : ${await tokenFactory.getAddress()}`);
  console.log(`Launchpad        : ${await launchpad.getAddress()}`);
  console.log(`Router           : ${await router.getAddress()}`);
  console.log("\nStock Tokens (mainnet) to approve for LP:", STOCK_TOKENS);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
