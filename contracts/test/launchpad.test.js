const { expect } = require("chai");
const { ethers } = require("hardhat");

const E18 = (n) => ethers.parseEther(String(n));
const B = (n) => E18(n * 1e9); // tokens (1B supply)

describe("Launchpad — pons-style economics on a bonding curve", function () {
  let nvda, tokenFactory, pairFactory, launchpad, router, creator, trader, dead;

  const SEED = E18(1); // 1 NVDA virtual seed
  const TARGET = E18(10); // graduate at 10 NVDA collected
  const CREATOR_FEE_BPS = 5000n; // creator takes 50% of the 1% fee
  const LAUNCH_FEE = ethers.parseEther("0.0005");

  beforeEach(async function () {
    [creator, trader] = await ethers.getSigners();
    dead = "0x000000000000000000000000000000000000dEaD";

    const Stock = await ethers.getContractFactory("MockStockToken");
    nvda = await Stock.deploy("NVIDIA", "NVDA");
    await nvda.mint(creator.address, E18(10000));
    await nvda.mint(trader.address, E18(10000));

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

  async function launch(opts = {}) {
    return launchpad.connect(opts.from || creator).launch(
      opts.name || "Moon Coin",
      opts.symbol || "MOON",
      opts.quote || (await nvda.getAddress()),
      opts.seed || SEED,
      opts.target || TARGET,
      opts.feeBps ?? CREATOR_FEE_BPS,
      { value: opts.value ?? LAUNCH_FEE }
    );
  }

  it("charges the launch fee in ETH (0.0005 default)", async function () {
    expect(await launchpad.launchFee()).to.equal(LAUNCH_FEE);

    // without the fee → reverts
    await expect(
      launchpad.connect(creator).launch(
        "Moon Coin", "MOON", await nvda.getAddress(), SEED, TARGET, CREATOR_FEE_BPS
      )
    ).to.be.revertedWith("LP: insufficient fee");

    // with the fee → succeeds
    await expect(launch()).to.emit(launchpad, "Launched");
  });

  it("owner can update the launch fee", async function () {
    await expect(launchpad.setLaunchFee(E18(0.001)))
      .to.emit(launchpad, "LaunchFeeUpdated");
    expect(await launchpad.launchFee()).to.equal(E18(0.001));

    await expect(launchpad.connect(trader).setLaunchFee(0)).to.be.reverted;
  });

  it("launches a 1B coin onto the curve with no upfront liquidity", async function () {
    await expect(launch()).to.emit(launchpad, "Launched");

    const c = await launchpad.curves(0);
    expect(c.token).to.not.equal(ethers.ZeroAddress);
    expect(c.creator).to.equal(creator.address);
    expect(c.totalSupply).to.equal(B(1));
    expect(c.realTokenReserve).to.equal(B(1));
    expect(c.realQuoteReserve).to.equal(0);
    expect(c.graduated).to.equal(false);
    expect(c.creatorFeeBps).to.equal(CREATOR_FEE_BPS);
    expect(await launchpad.curveCount()).to.equal(1);
    expect(await launchpad.priceOf(0)).to.be.gt(0);
  });

  it("buying moves the price up and splits the 1% fee with the creator", async function () {
    await launch();

    const before = await launchpad.priceOf(0);
    const [expected, fee] = await launchpad.getBuyQuote(0, E18(1));
    expect(fee).to.equal(E18(0.01)); // 1% of 1 NVDA

    await nvda.connect(trader).approve(await launchpad.getAddress(), E18(1));
    await launchpad.connect(trader).buy(0, E18(1), 0);

    const after = await launchpad.priceOf(0);
    expect(after).to.be.gt(before);
    expect(expected).to.be.gt(0);

    const c = await launchpad.curves(0);
    expect(c.realQuoteReserve).to.equal(E18(1) - fee);

    // creator accrued 50% of the fee
    expect(c.creatorAccrued).to.equal((fee * CREATOR_FEE_BPS) / 10000n);
  });

  it("creator can claim their accrued fee share", async function () {
    await launch();
    await nvda.connect(trader).approve(await launchpad.getAddress(), E18(1));
    await launchpad.connect(trader).buy(0, E18(1), 0);

    const c = await launchpad.curves(0);
    const accrued = c.creatorAccrued;
    expect(accrued).to.be.gt(0);

    const balBefore = await nvda.balanceOf(creator.address);
    await launchpad.connect(creator).claimFees(0);
    expect(await nvda.balanceOf(creator.address) - balBefore).to.equal(accrued);

    // non-creator cannot claim
    await expect(launchpad.connect(trader).claimFees(0)).to.be.revertedWith("LP: not creator");
  });

  it("selling returns quote minus fee and lowers the price", async function () {
    await launch();

    await nvda.connect(trader).approve(await launchpad.getAddress(), E18(5));
    await launchpad.connect(trader).buy(0, E18(5), 0);
    const c1 = await launchpad.curves(0);
    const MemeToken = await ethers.getContractAt("MemeToken", c1.token);
    const traderTokens = await MemeToken.balanceOf(trader.address);

    const priceBefore = await launchpad.priceOf(0);
    const [qOut, fee] = await launchpad.getSellQuote(0, traderTokens);

    await MemeToken.connect(trader).approve(await launchpad.getAddress(), traderTokens);
    const balBefore = await nvda.balanceOf(trader.address);

    await launchpad.connect(trader).sell(0, traderTokens, 0);

    const balAfter = await nvda.balanceOf(trader.address);
    expect(balAfter - balBefore).to.equal(qOut - fee);
    expect(await launchpad.priceOf(0)).to.be.lt(priceBefore);
  });

  it("graduates at the target: migrates to AMM and burns the LP", async function () {
    await launch();

    await nvda.connect(trader).approve(await launchpad.getAddress(), E18(12));
    const tx = await launchpad.connect(trader).buy(0, E18(12), 0);
    await expect(tx).to.emit(launchpad, "Graduated");

    const c = await launchpad.curves(0);
    expect(c.graduated).to.equal(true);
    expect(c.pair).to.not.equal(ethers.ZeroAddress);

    const pair = await ethers.getContractAt("StockPair", c.pair);
    expect(await pair.balanceOf(dead)).to.be.gt(0);
    expect(await pair.balanceOf(await launchpad.getAddress())).to.equal(0);
    expect(await pair.balanceOf("0x0000000000000000000000000000000000000001")).to.equal(1000n);

    const [r0, r1] = await pair.getReserves();
    expect(r0 + r1).to.be.gt(0);

    expect(await launchpad.progressOf(0)).to.equal(E18(1));
    await expect(launchpad.connect(trader).buy(0, E18(1), 0)).to.be.revertedWith("LP: graduated");
  });

  it("trading continues on the AMM via the router after graduation", async function () {
    await launch();

    await nvda.connect(trader).approve(await launchpad.getAddress(), E18(12));
    await launchpad.connect(trader).buy(0, E18(12), 0);

    const c = await launchpad.curves(0);
    const pair = await ethers.getContractAt("StockPair", c.pair);

    const amountIn = E18(1);
    const nvdaIs0 = (await pair.token0()) === (await nvda.getAddress());
    const expectedOut = await pair.getAmountOut(amountIn, nvdaIs0);

    await nvda.connect(trader).approve(await router.getAddress(), amountIn);
    const token = await ethers.getContractAt("MemeToken", c.token);
    const before = await token.balanceOf(trader.address);

    await router
      .connect(trader)
      .swapExactTokensForTokens(
        amountIn,
        (expectedOut * 95n) / 100n,
        await nvda.getAddress(),
        c.token,
        trader.address,
        Math.floor(Date.now() / 1000) + 600
      );

    expect(await token.balanceOf(trader.address) - before).to.equal(expectedOut);
  });
});
