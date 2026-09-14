# MemePad 🟢

Create your own coin and pair it with **stock tokens** (Robinhood Chain Stock Tokens)
like **NVDA, AAPL, TSLA, MSFT, SPY** in a single transaction — a full-stack dApp
on **Robinhood Chain** (Ethereum L2 on the Arbitrum Orbit/Nitro stack, chainId 4663, gas = ETH).

```
Create coin → 100% of supply goes straight into the pool → creator receives the LP tokens
```

> No pre-sale, no team allocation — a truly fair launch.

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
│   │   ├── Launchpad.sol          # Orchestrates: create coin + seed LP + return LP to creator
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
| `Launchpad` | `createCoin(name, symbol, totalSupply, stockToken, stockAmount)` — deploys the coin, creates the pool, seeds liquidity, and mints LP to the creator |
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
2. **Fill the form** — name / ticker / supply + pick a stock (NVDA…) + the stock amount to seed.
3. **Create coin** → approve the stock token → coin + LP are created in a single transaction.
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
