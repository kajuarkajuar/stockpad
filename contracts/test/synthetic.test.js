const { expect } = require("chai");
const { ethers } = require("hardhat");

const USDC = (n) => BigInt(Math.round(n * 1e6));
const E18 = (n) => ethers.parseEther(String(n));

describe("SyntheticStock (Chainlink-pegged, USDC collateral)", function () {
  let usdc, feed, synth, user;

  beforeEach(async function () {
    [user] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    usdc = await USDC.deploy();

    const Feed = await ethers.getContractFactory("MockPriceFeed");
    feed = await Feed.deploy();
    await feed.setAnswer(140_00000000); // NVDA = $140.00 (8 decimals)

    const Synth = await ethers.getContractFactory("SyntheticStock");
    synth = await Synth.deploy(
      "Synthetic NVIDIA",
      "sNVDA",
      await usdc.getAddress(),
      await feed.getAddress(),
      user.address
    );
  });

  it("mints shares 1:1 against USD value and redeems at the same price", async function () {
    await usdc.mint(user.address, USDC(140));
    await usdc.approve(await synth.getAddress(), USDC(140));

    const shares = await synth.connect(user).mint.staticCall(USDC(140));
    expect(shares).to.equal(E18(1)); // $140 / $140 = 1 share

    await synth.connect(user).mint(USDC(140));
    expect(await synth.balanceOf(user.address)).to.equal(E18(1));

    // redeem round-trip at unchanged price
    const out = await synth.connect(user).redeem.staticCall(E18(1));
    expect(out).to.equal(USDC(140));

    await synth.connect(user).redeem(E18(1));
    expect(await usdc.balanceOf(user.address)).to.equal(USDC(140));
    expect(await synth.balanceOf(user.address)).to.equal(0);
  });

  it("mints fewer shares when the price rises", async function () {
    await feed.setAnswer(280_00000000); // $280
    await usdc.mint(user.address, USDC(140));
    await usdc.approve(await synth.getAddress(), USDC(140));
    const shares = await synth.connect(user).mint.staticCall(USDC(140));
    expect(shares).to.equal(E18(0.5)); // $140 / $280 = 0.5 share
  });

  it("rejects stale prices", async function () {
    await feed.setAnswer(140_00000000);
    await ethers.provider.send("evm_increaseTime", [2 * 86400]); // 2 days
    await ethers.provider.send("evm_mine", []);
    await expect(synth.price()).to.be.revertedWith("SS: stale price");
  });
});
