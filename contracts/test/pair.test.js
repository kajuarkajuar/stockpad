const { expect } = require("chai");
const { ethers } = require("hardhat");

const E18 = (n) => ethers.parseEther(String(n));

describe("StockPair (constant-product AMM)", function () {
  let nvda, coin, pair, owner, lp;
  let nvdaIsToken0; // token order in the pool depends on address sort

  beforeEach(async function () {
    [owner, lp] = await ethers.getSigners();
    const Stock = await ethers.getContractFactory("MockStockToken");
    nvda = await Stock.deploy("NVIDIA", "NVDA");
    coin = await Stock.deploy("Test Coin", "TEST");

    await nvda.mint(owner.address, E18(10000));
    await coin.mint(owner.address, E18(1_000_000));

    const Factory = await ethers.getContractFactory("StockPairFactory");
    const factory = await Factory.deploy();
    await factory.createPair(await coin.getAddress(), await nvda.getAddress());
    pair = await ethers.getContractAt(
      "StockPair",
      await factory.getPair(await coin.getAddress(), await nvda.getAddress())
    );
    nvdaIsToken0 = (await pair.token0()) === (await nvda.getAddress());
  });

  async function seed(amountCoin, amountNvda) {
    await coin.transfer(pair.target, E18(amountCoin));
    await nvda.transfer(pair.target, E18(amountNvda));
    await pair.mint(owner.address);
  }

  it("seeds initial liquidity and locks MINIMUM_LIQUIDITY", async function () {
    await seed(1000000, 10000);
    const [r0, r1] = await pair.getReserves();

    // coin reserve = 1e24, NVDA reserve = 1e22 (order depends on token sort)
    const coinReserve = nvdaIsToken0 ? r1 : r0;
    const nvdaReserve = nvdaIsToken0 ? r0 : r1;
    expect(coinReserve).to.equal(E18(1000000));
    expect(nvdaReserve).to.equal(E18(10000));

    // LP tokens minted minus the locked 1000 wei
    const lpBal = await pair.balanceOf(owner.address);
    expect(lpBal).to.equal(E18(100000) - 1000n);
  });

  it("swaps with a 0.30% fee and maintains the invariant", async function () {
    await seed(1000000, 10000);

    // mint extra NVDA to the owner for the swap
    await nvda.mint(owner.address, E18(10));

    const amountIn = E18(1);
    const expectedOut = await pair.getAmountOut(amountIn, nvdaIsToken0);
    const before = await coin.balanceOf(lp.address);

    await nvda.transfer(pair.target, amountIn);
    // NVDA in -> COIN out
    if (nvdaIsToken0) {
      await pair.swap(0, expectedOut, lp.address);
    } else {
      await pair.swap(expectedOut, 0, lp.address);
    }

    const after = await coin.balanceOf(lp.address);
    expect(after - before).to.equal(expectedOut);

    const [r0, r1] = await pair.getReserves();
    // k must not have decreased
    expect(r0 * r1).to.be.gte(E18(1000000) * E18(10000));
  });

  it("burns LP and returns underlying", async function () {
    await seed(1000000, 10000);
    const lpBal = await pair.balanceOf(owner.address);
    await pair.transfer(pair.target, lpBal);
    await pair.burn(owner.address);
    const [r0, r1] = await pair.getReserves();

    // the permanently-locked MINIMUM_LIQUIDITY dust keeps a tiny share of each
    // reserve. coin reserve was 1e24 wei -> 10000 wei left; NVDA was 1e22 -> 100 wei.
    const coinLeft = nvdaIsToken0 ? r1 : r0;
    const nvdaLeft = nvdaIsToken0 ? r0 : r1;
    expect(coinLeft).to.equal(10000n);
    expect(nvdaLeft).to.equal(100n);
  });
});
