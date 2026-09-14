import { createPublicClient, createWalletClient, custom, http, erc20Abi } from "viem";
import { DEFAULT_CHAIN } from "../config/chain";
import { CONTRACTS, isDeployed } from "../config/addresses";

import LaunchpadABI from "../abi/Launchpad.json";
import StockPairABI from "../abi/StockPair.json";
import MemePadRouterABI from "../abi/MemePadRouter.json";

export const publicClient = createPublicClient({
  chain: DEFAULT_CHAIN,
  transport: http(DEFAULT_CHAIN.rpcUrls.default.http[0]),
});

export function walletClient() {
  return createWalletClient({ chain: DEFAULT_CHAIN, transport: custom(window.ethereum) });
}

export const MAX_UINT = 2n ** 256n - 1n;
export const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n; // 1B, fixed
export const FEE_BPS = 100; // 1%

export async function waitForReceipt(hash) {
  return publicClient.waitForTransactionReceipt({ hash });
}

// ── launchpad meta ──────────────────────────────────────────────────────────

export async function readLaunchpad() {
  if (!isDeployed()) return { fee: 0n, count: 0n };
  const [fee, count] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "launchFee" }),
    publicClient.readContract({ address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "curveCount" }),
  ]);
  return { fee, count };
}

async function readPairState(pair) {
  const [token0, token1, reserves] = await Promise.all([
    publicClient.readContract({ address: pair, abi: StockPairABI, functionName: "token0" }),
    publicClient.readContract({ address: pair, abi: StockPairABI, functionName: "token1" }),
    publicClient.readContract({ address: pair, abi: StockPairABI, functionName: "getReserves" }),
  ]);
  return { token0, token1, reserve0: reserves[0], reserve1: reserves[1] };
}

async function readCurve(index) {
  const c = await publicClient.readContract({
    address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "curves", args: [BigInt(index)],
  });
  const [price, mcap, progress] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "priceOf", args: [BigInt(index)] }),
    publicClient.readContract({ address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "marketCapOf", args: [BigInt(index)] }),
    publicClient.readContract({ address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "progressOf", args: [BigInt(index)] }),
  ]);

  return {
    index,
    token: c[0], quote: c[1], creator: c[2], name: c[3], symbol: c[4],
    totalSupply: c[5], quoteDecimals: Number(c[6]),
    realTokenReserve: c[9], realQuoteReserve: c[10],
    graduationTarget: c[11], createdAt: c[12],
    graduated: c[13], pair: c[14],
    creatorFeeBps: c[15], creatorAccrued: c[16],
    price, mcap, progress,
  };
}

export async function fetchCoins() {
  if (!isDeployed()) return [];
  const { count } = await readLaunchpad();
  const n = Number(count);
  if (n === 0) return [];
  const ids = Array.from({ length: Math.min(n, 60) }, (_, i) => n - 1 - i);

  const coins = await Promise.all(ids.map(readCurve));

  // attach AMM reserve state for graduated coins
  return Promise.all(
    coins.map(async (c) => {
      if (c.graduated && c.pair && !/^0x0+$/.test(c.pair)) {
        try { c.state = await readPairState(c.pair); } catch { c.state = null; }
      } else {
        c.state = null;
      }
      return c;
    })
  );
}

export async function fetchCoin(index) {
  if (!isDeployed()) return null;
  const c = await readCurve(Number(index));
  if (c.graduated && c.pair && !/^0x0+$/.test(c.pair)) {
    try { c.state = await readPairState(c.pair); } catch { c.state = null; }
  }
  return c;
}

// ── curve quotes ────────────────────────────────────────────────────────────

export async function quoteBuy(index, quoteIn) {
  const r = await publicClient.readContract({
    address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "getBuyQuote",
    args: [BigInt(index), quoteIn],
  });
  return { tokenOut: r[0], fee: r[1] };
}

export async function quoteSell(index, tokenIn) {
  const r = await publicClient.readContract({
    address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "getSellQuote",
    args: [BigInt(index), tokenIn],
  });
  return { quoteOut: r[0], fee: r[1] };
}

export async function claimCreatorFees(index, account) {
  const wc = walletClient();
  return wc.writeContract({
    address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "claimFees",
    args: [BigInt(index)], account,
  });
}

// ── AMM quote (post-graduation) ─────────────────────────────────────────────

export function quoteOut(pairState, amountIn, tokenIn) {
  const { token0, token1, reserve0, reserve1 } = pairState;
  const zeroForOne = token0.toLowerCase() === tokenIn.toLowerCase();
  const reserveIn = zeroForOne ? reserve0 : reserve1;
  const reserveOut = zeroForOne ? reserve1 : reserve0;
  if (reserveIn === 0n || reserveOut === 0n) return 0n;
  const FEE = 30n;
  const amountInFee = (amountIn * (10000n - FEE)) / 10000n;
  return (amountInFee * reserveOut) / (reserveIn + amountInFee);
}

// ── generic erc20 reads ─────────────────────────────────────────────────────

export async function readBalance(tokenAddr, account) {
  if (!account || !tokenAddr) return 0n;
  try {
    return await publicClient.readContract({ address: tokenAddr, abi: erc20Abi, functionName: "balanceOf", args: [account] });
  } catch {
    return 0n;
  }
}

export async function readDecimals(tokenAddr) {
  try {
    return await publicClient.readContract({ address: tokenAddr, abi: erc20Abi, functionName: "decimals" });
  } catch {
    return 18;
  }
}

// default curve parameters per launch (pump.fun-style)
export function curveDefaults(quoteDecimals) {
  const seed = 1n * 10n ** BigInt(quoteDecimals); // 1 quote unit virtual seed
  const target = 100n * 10n ** BigInt(quoteDecimals); // graduate at 100 quote units
  return { seed, target };
}
