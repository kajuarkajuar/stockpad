import { createPublicClient, createWalletClient, custom, http, erc20Abi } from "viem";
import { DEFAULT_CHAIN } from "../config/chain";
import { CONTRACTS, isDeployed } from "../config/addresses";

import LaunchpadABI from "../abi/Launchpad.json";
import StockPairABI from "../abi/StockPair.json";
import StockPadRouterABI from "../abi/StockPadRouter.json";

export const publicClient = createPublicClient({
  chain: DEFAULT_CHAIN,
  transport: http(DEFAULT_CHAIN.rpcUrls.default.http[0]),
});

export function walletClient() {
  return createWalletClient({ chain: DEFAULT_CHAIN, transport: custom(window.ethereum) });
}

export const MAX_UINT = 2n ** 256n - 1n;

export async function waitForReceipt(hash) {
  return publicClient.waitForTransactionReceipt({ hash });
}

// ── reads ───────────────────────────────────────────────────────────────────

export async function readLaunchpad() {
  return {
    fee: isDeployed()
      ? await publicClient.readContract({ address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "creationFee" })
      : 0n,
    count: isDeployed()
      ? await publicClient.readContract({ address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "coinCount" })
      : 0n,
  };
}

async function readPairState(pair) {
  const [token0, token1, reserves] = await Promise.all([
    publicClient.readContract({ address: pair, abi: StockPairABI, functionName: "token0" }),
    publicClient.readContract({ address: pair, abi: StockPairABI, functionName: "token1" }),
    publicClient.readContract({ address: pair, abi: StockPairABI, functionName: "getReserves" }),
  ]);
  return { token0, token1, reserve0: reserves[0], reserve1: reserves[1] };
}

export async function fetchCoins() {
  if (!isDeployed()) return [];
  const count = await readLaunchpad().then((l) => Number(l.count));
  if (count === 0) return [];
  const ids = Array.from({ length: Math.min(count, 60) }, (_, i) => count - 1 - i);

  const rows = await Promise.all(
    ids.map((i) =>
      publicClient.readContract({ address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "coins", args: [BigInt(i)] })
    )
  );

  return Promise.all(
    rows.map(async (r, idx) => {
      const id = ids[idx];
      const [token, pair, stockToken, creator, name, symbol, totalSupply, stockAmount, createdAt] = r;
      let state = null;
      try {
        state = await readPairState(pair);
      } catch {
        state = null;
      }
      return { id, token, pair, stockToken, creator, name, symbol, totalSupply, stockAmount, createdAt, state };
    })
  );
}

export async function fetchCoin(id) {
  if (!isDeployed()) return null;
  const r = await publicClient.readContract({ address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "coins", args: [BigInt(id)] });
  const [token, pair, stockToken, creator, name, symbol, totalSupply, stockAmount, createdAt] = r;
  const state = await readPairState(pair);
  return { id: Number(id), token, pair, stockToken, creator, name, symbol, totalSupply, stockAmount, createdAt, state };
}

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

export function quoteOut(pairState, amountIn, tokenIn) {
  // returns amountOut (BigInt) for a single-hop swap in the pair
  const { token0, token1, reserve0, reserve1 } = pairState;
  const zeroForOne = token0.toLowerCase() === tokenIn.toLowerCase();
  const reserveIn = zeroForOne ? reserve0 : reserve1;
  const reserveOut = zeroForOne ? reserve1 : reserve0;
  const FEE_BPS = 30n;
  const amountInFee = (amountIn * (10000n - FEE_BPS)) / 10000n; // simpler: apply fee to input
  if (reserveIn === 0n || reserveOut === 0n) return 0n;
  return (amountInFee * reserveOut) / (reserveIn + amountInFee);
}
