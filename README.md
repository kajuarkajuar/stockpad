# MemePad 🟢

Create your own coin and pair it with **stock tokens** (Robinhood Chain Stock Tokens)
like **NVDA, AAPL, TSLA, MSFT, SPY** in a single transaction — a full-stack dApp
on **Robinhood Chain** (Ethereum L2 on the Arbitrum Orbit/Nitro stack, chainId 4663, gas = ETH).

```
Pay a flat 0.0005 ETH fee → 1B supply mints onto a bonding curve → trades run on the
curve at 1% fee → at the target it graduates to an AMM and the LP is burned forever.
```

> pons.family-style economics: no pre-sale, no team allocation, no forced dev buy.
> The creator earns a configurable share of every trade (fee split fixed at launch).

---

## Project structure

```
memepad/
├── contracts/            # Solidity (Hardhat + OpenZeppelin)
│   ├── contracts/
│   │   ├── MemeToken.sol          # ERC-20 minted by the launchpad (owner = creator)
│   │   ├── TokenFactory.sol       # CREATE2 coin deployer (callable by the launchpad only)
│   │   ├── StockPair.sol          # Constant-product AMM (Uniswap V2 style, 0.30% fee)
│   │   ├── StockPairFactory.sol   # Deterministic pool deployer
│   │   ├── Launchpad.sol          # Bonding curve + graduation + ETH launch fee + creator fee share
│   │   ├── MemePadRouter.sol     # Swap / add / remove liquidity in one transaction
│   │   ├── SyntheticStock.sol     # (optional) Collateral-backed synthetic pegged to a Chainlink feed
│   │   └── mocks/                 # MockStockToken, MockUSDC, MockPriceFeed
│   ├── test/              # 8 tests, all passing (pair, launchpad, synthetic)
│   └── scripts/deploy.js
│
└── web/                  # Frontend (Vite + React + viem)
    └── src/
        ├── abi/          # ABIs generated from the contract artifacts
        ├── config/       # chain.js, addresses.js, stocks.js
        ├── lib/          # client (on-chain reads/writes), format, sparkline
        ├── hooks/useWallet.js
        └── components/   # Header, CreateCoin, TradeWidget, LiquidityWidget, CoinCard...
```

## Contract overview

| Contract | Purpose |
|---|---|
| `Launchpad` | `launch(name, symbol, quote, seed, target, creatorFeeBps)` — mints a 1B coin onto a bonding curve for a flat 0.0005 ETH fee; `buy`/`sell` at 1% fee (creator split); auto-graduates to the AMM and burns the LP |
| `MemeToken` | Plain ERC-20; owner = creator (can mint more, capped at 1B; can burn) |
| `StockPair` | The LP token is the pool itself; 0.30% fee accrues to LPs; reentrancy-guarded |
| `MemePadRouter` | `swapExactTokensForTokens`, `addLiquidity`, `removeLiquidity` (single-hop) |
| `SyntheticStock` | (optional) For tickers without a native on-chain Stock Token — a synthetic pegged to a Chainlink price, collateralized by USDC |

## Supported stock tokens (mainnet, chainId 4663)

| Ticker | Address |
|---|---|
| NVDA | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` |
| AAPL | `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` |
| TSLA | `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` |
| AMZN | `0x12f190a9F9d7D37a250758b26824B97CE941bF54` |
| MSFT | `0xe93237C50D904957Cf27E7B1133b510C669c2e74` |
| GOOGL | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` |
| META | `0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35` |
| SPY | `0x117cc2133c37B721F49dE2A7a74833232B3B4C0C` |

> Always verify against https://robinhoodchain.blockscout.com before using them in production.

## How to run (local)

**1. Test the contracts**
```bash
cd contracts
npm install
npx hardhat test        # 8 passing
```

**2. Deploy (testnet first, always)**
```bash
cd contracts
export PRIVATE_KEY=0x...
# testnet (chainId 46630)
npx hardhat run scripts/deploy.js --network robinhood-testnet
# mainnet (chainId 4663)
npx hardhat run scripts/deploy.js --network robinhood
```
Paste the printed addresses into `web/src/config/addresses.js`.

**3. Run the web app**
```bash
cd web
npm install
npm run dev             # http://localhost:5173
```

**4. Wallet setup** — add the network in MetaMask/Rabby/Robinhood Wallet:
- Network: `Robinhood Chain` · RPC: `https://rpc.mainnet.chain.robinhood.com` · Chain ID: `4663` · Symbol: `ETH` · Explorer: `https://robinhoodchain.blockscout.com`

## End-user flow

1. **Connect wallet** → switch to Robinhood Chain (one-click button).
2. **Fill the form** — name / ticker, pick a Stock Token (NVDA…), set your creator fee share, optional dev buy.
3. **Launch** → pay the 0.0005 ETH fee → the 1B coin starts trading on its bonding curve immediately.
4. The coin appears on the Explore page → anyone can trade (Stock Token ↔ coin) or add more liquidity.

## ⚠️ Before going to production

- **Audit** — these contracts have not been audited. Do not risk real funds without a third-party review.
- **RPC** — Robinhood's public RPC is rate-limited → use a paid provider (Alchemy/QuickNode/GetBlock) for production.
- **Compliance** — issuing a coin and pairing it with tokenized securities may trigger securities regulations in some jurisdictions. Consult legal counsel first.
- **SyntheticStock** is a simplified design (insolvency risk under sharp price moves) — for tickers without a native Stock Token, prefer the real on-chain Stock Tokens where possible.
- **Oracle** — real-world stock prices on-chain come from Robinhood itself; this system quotes prices from AMM reserves, not an external oracle.
- **Front-running / sandwich** — inherent to standard AMMs; use slippage tolerance and consider an auction-based launch if this matters.

## Suggested roadmap

- [ ] Subgraph/indexer for real price history & volume (replacing the mock sparkline)
- [ ] Basket/multipool pairing (pair a coin against several stocks, e.g. ⅓ AAPL + ⅓ MSFT + ⅓ NVDA)
- [ ] Fee-on-transfer / creator-tax options
- [ ] Migration + timelock + ownership-renounce tooling
