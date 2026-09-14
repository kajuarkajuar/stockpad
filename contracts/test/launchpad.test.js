const { expect } = require("chai");
const { ethers } = require("hardhat");

const E18 = (n) => ethers.parseEther(String(n));

describe("Launchpad — create a coin paired with a Stock Token", function () {
  let nvda, tokenFactory, pairFactory, launchpad, router, creator, trader;

  beforeEach(async function () {
    [creator, trader] = await ethers.getSigners();

    const Stock = await ethers.getContractFactory("MockStockToken");
    nvda = await Stock.deploy("NVIDIA", "NVDA");
    await nvda.mint(creator.address, E18(10000));

    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    tokenFactory = await TokenFactory.deploy();

    const PairFactory = await ethers.getContractFactory("StockPairFactory");
    pairFactory = await PairFactory.deploy();

    const Launchpad = await ethers.getContractFactory("Launchpad");
    launchpad = await Launchpad.deploy(
      await tokenFactory.getAddress(),
      await pairFactory.getAddress()
    );

    await tokenFactory.setLaunchpad(await launchpad.getAddress());

    const Router = await ethers.getContractFactory("MemePadRouter");
    router = await Router.deploy(await pairFactory.getAddress());
  });

  it("creates a coin, seeds the pool, and gives LP to the creator", async function () {
    const totalSupply = E18(1_000_000);
    const stockAmount = E18(1000); // 1000 NVDA to seed

    await nvda.connect(creator).approve(await launchpad.getAddress(), stockAmount);

    const tx = await launchpad
      .connect(creator)
      .createCoin("Moon Coin", "MOON", totalSupply, await nvda.getAddress(), stockAmount);
    await expect(tx).to.emit(launchpad, "CoinCreated");

    const coin = await launchpad.coins(0);
    expect(coin.name).to.equal("Moon Coin");
    expect(coin.symbol).to.equal("MOON");
    expect(coin.creator).to.equal(creator.address);
    expect(coin.stockToken).to.equal(await nvda.getAddress());

    const pair = await ethers.getContractAt("StockPair", coin.pair);
    const [r0, r1] = await pair.getReserves();
    const reserves = [r0.toString(), r1.toString()];
    expect(reserves).to.include(totalSupply.toString());
    expect(reserves).to.include(stockAmount.toString());

    // creator holds LP tokens
    expect(await pair.balanceOf(creator.address)).to.be.gt(0);
    expect(await launchpad.coinCount()).to.equal(1);
  });

  it("lets a trader swap through the router with slippage protection", async function () {
    const totalSupply = E18(1_000_000);
    const stockAmount = E18(1000);

    await nvda.connect(creator).approve(await launchpad.getAddress(), stockAmount);
    await launchpad
      .connect(creator)
      .createCoin("Moon Coin", "MOON", totalSupply, await nvda.getAddress(), stockAmount);

    const coin = await launchpad.coins(0);
    const token = await ethers.getContractAt("MemeToken", coin.token);
    const pair = await ethers.getContractAt("StockPair", coin.pair);

    // trader buys MOON with 1 NVDA
    const amountIn = E18(1);
    const zeroForOne = (await pair.token0()) === (await nvda.getAddress());
    const expectedOut = await pair.getAmountOut(amountIn, zeroForOne);

    await nvda.mint(trader.address, amountIn);
    await nvda.connect(trader).approve(await router.getAddress(), amountIn);

    const before = await token.balanceOf(trader.address);
    await router
      .connect(trader)
      .swapExactTokensForTokens(
        amountIn,
        (expectedOut * 95n) / 100n, // 5% slippage tolerance
        await nvda.getAddress(),
        coin.token,
        trader.address,
        Math.floor(Date.now() / 1000) + 600
      );

    expect(await token.balanceOf(trader.address) - before).to.equal(expectedOut);
  });
});
