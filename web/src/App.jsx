import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./hooks/useWallet";
import { fetchCoins, fetchCoin, readLaunchpad } from "./lib/client";
import { isDeployed, CONTRACTS } from "./config/addresses";
import { STOCKS } from "./config/stocks";
import { fmtBig, priceOf, shortAddr, timeAgo, explorerUrl } from "./lib/format";
import { trendOf } from "./lib/sparkline";
import { DEFAULT_CHAIN } from "./config/chain";

import Header from "./components/Header";
import CoinCard from "./components/CoinCard";
import Sparkline from "./components/Sparkline";
import CreateCoin from "./components/CreateCoin";
import TradeWidget from "./components/TradeWidget";
import LiquidityWidget from "./components/LiquidityWidget";

function useRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const fn = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return hash;
}

export default function App() {
  const wallet = useWallet();
  const route = useRoute();

  const navigate = useCallback((h) => {
    window.location.hash = h;
  }, []);

  let view;
  if (route.startsWith("#/coin/")) {
    const id = route.split("/")[2];
    view = <CoinDetail id={id} wallet={wallet} navigate={navigate} />;
  } else if (route.startsWith("#/explore")) {
    view = <Explore wallet={wallet} navigate={navigate} />;
  } else {
    view = <Home wallet={wallet} navigate={navigate} />;
  }

  return (
    <div className="app">
      <Header wallet={wallet} onNavigate={navigate} />
      <main className="main">{view}</main>
      <footer className="footer">
        <div><b>MemePad</b> — launch coins paired with Robinhood Chain Stock Tokens. DYOR. Not financial advice.</div>
        <div>
          {isDeployed()
            ? `Launchpad ${shortAddr(CONTRACTS.launchpad)} · Robinhood Chain (4663)`
            : "Contracts not deployed yet — see web/src/config/addresses.js"}
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

const FEATURED_TICKS = ["NVDA", "AAPL", "TSLA", "MSFT", "SPY"];

function Home({ wallet, navigate }) {
  const [coins, setCoins] = useState(null);
  const [count, setCount] = useState(0n);

  useEffect(() => {
    fetchCoins().then(setCoins).catch(() => setCoins([]));
    readLaunchpad().then((l) => setCount(l.count)).catch(() => {});
  }, []);

  const featured = (coins || []).slice(0, 6);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="badge">
            <span className="chain-dot" /> Robinhood Chain · chainId 4663
          </span>
          <h1>
            Launch a coin.
            <br />
            Pair it with{" "}
            {FEATURED_TICKS.map((t, i) => (
              <span key={t} style={{ whiteSpace: "nowrap" }}>
                <span style={{ display: "inline-block", width: "0.14em", height: "0.14em", borderRadius: "50%", background: STOCKS[t].color, verticalAlign: "0.18em", marginRight: "0.06em" }} />
                {t}
                {i < FEATURED_TICKS.length - 1 ? " " : "."}
              </span>
            ))}
          </h1>
          <p className="hero-sub">
            Name your token, pick a Stock Token, and the entire supply is seeded into a
            liquidity pool in one transaction. 100% fair launch — you keep the LP.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary btn-lg" href="#/explore">Explore coins</a>
            <a className="btn btn-ghost btn-lg" href="#create">Launch a coin</a>
          </div>
          <div className="hero-tickers">
            {Object.keys(STOCKS).slice(0, 6).map((t) => (
              <span key={t} className="ticker-chip">
                <span className="stock-dot" style={{ background: STOCKS[t].color }} />
                {t} · {STOCKS[t].name.split(" ")[0]}
              </span>
            ))}
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-card-head">
            <span className="chain-dot" />
            Live market
          </div>
          <div className="hero-stats">
            <Stat label="Coins launched" value={coins ? String(coins.length) : "…"} />
            <Stat label="Stock tokens" value={Object.keys(STOCKS).length} />
            <Stat label="Swap fee" value="0.30%" />
            <Stat label="Block time" value="~0.1s" />
          </div>
          <div className="hero-card-foot">
            <span>Fair launch · no pre-sale</span>
            <span>⚡ Arbitrum Nitro L2</span>
          </div>
        </div>
      </section>

      <section id="create" className="section">
        <div className="section-grid">
          <CreateCoin wallet={wallet} onCreated={(id) => navigate("#/coin/" + id)} />
          <div className="why">
            <h2>How it works</h2>
            <ol className="steps">
              <li><b>Create</b> — deploy a fresh ERC-20 with your name &amp; supply.</li>
              <li><b>Seed</b> — it's paired with NVDA, AAPL, or any Stock Token you choose.</li>
              <li><b>Own</b> — 100% of supply goes into the pool; you receive the LP tokens.</li>
              <li><b>Trade</b> — anyone swaps the Stock Token ↔ your coin, 0.30% fee accrues to LP.</li>
            </ol>
            <p className="muted">
              Built with Solidity (Hardhat) + React/viem. Auditable AMM, no pre-sale, no team allocation.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Recently launched</h2>
          <button className="link-btn" onClick={() => navigate("#/explore")}>View all →</button>
        </div>
        {coins === null ? (
          <p className="muted">Loading on-chain data…</p>
        ) : featured.length === 0 ? (
          <div className="empty">
            <h3>No coins yet</h3>
            <p>Be the first to launch one — it takes seconds.</p>
          </div>
        ) : (
          <div className="grid">
            {featured.map((c) => (
              <CoinCard key={c.id} coin={c} onOpen={(id) => navigate("#/coin/" + id)} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Explore({ wallet, navigate }) {
  const [coins, setCoins] = useState(null);
  useEffect(() => {
    fetchCoins().then(setCoins).catch(() => setCoins([]));
  }, []);

  return (
    <section className="section" style={{ marginTop: 28 }}>
      <div className="section-head">
        <h2>All coins</h2>
        <span className="muted">{coins ? coins.length + " listed" : "loading…"}</span>
      </div>
      {coins === null ? (
        <p className="muted">Loading on-chain data…</p>
      ) : coins.length === 0 ? (
        <div className="empty">
          <h3>No coins launched yet</h3>
          <p>Head back home to launch the first one.</p>
        </div>
      ) : (
        <div className="grid">
          {coins.map((c) => (
            <CoinCard key={c.id} coin={c} onOpen={(id) => navigate("#/coin/" + id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function CoinDetail({ id, wallet, navigate }) {
  const [coin, setCoin] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("trade");

  useEffect(() => {
    setCoin(null);
    fetchCoin(id).then(setCoin).catch((e) => setErr(e?.message || "Failed to load coin"));
  }, [id]);

  if (err) return <section className="section"><div className="alert error">{err}</div></section>;
  if (!coin) return <section className="section"><p className="muted">Loading coin…</p></section>;

  const { token, pair, stockToken, creator, name, symbol, totalSupply, createdAt, state } = coin;
  const stockTicker = Object.keys(STOCKS).find((t) => STOCKS[t].address.toLowerCase() === stockToken.toLowerCase()) || "STOCK";
  const stockColor = STOCKS[stockTicker]?.color || "#888";

  let price = null, coinReserve = 0n, stockReserve = 0n;
  if (state) {
    const coinIs0 = state.token0.toLowerCase() === token.toLowerCase();
    coinReserve = coinIs0 ? state.reserve0 : state.reserve1;
    stockReserve = coinIs0 ? state.reserve1 : state.reserve0;
    price = priceOf(coinReserve, stockReserve);
  }
  const mcap = price ? (totalSupply * price) / 10n ** 18n : 0n;
  const trend = trendOf(token);

  return (
    <section className="section" style={{ marginTop: 24 }}>
      <button className="back-link" onClick={() => navigate("#/explore")}>← Back to explore</button>

      <div className="detail-head">
        <div className="coin-ident big">
          <div className="coin-logo lg" style={{ background: `linear-gradient(145deg, ${stockColor}, ${stockColor}cc)` }}>
            {symbol.slice(0, 1)}
          </div>
          <div>
            <div className="detail-symbol">{symbol} <span className="unit">/ {stockTicker}</span></div>
            <div className="coin-name">{name} · created by {shortAddr(creator)}</div>
          </div>
        </div>
        <div className="detail-price">
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <span className="big-price">{price == null ? "–" : fmtBig(price, 18, 10)}</span>
            <span className={"change-chip " + (trend.up ? "up" : "down")}>
              {trend.up ? "▲" : "▼"} {Math.abs(trend.pct)}%
            </span>
          </div>
          <span className="unit">{stockTicker} per {symbol}</span>
        </div>
      </div>

      <div className="detail-chart">
        <div className="detail-links" style={{ marginTop: 0, marginBottom: 14 }}>
          <a href={explorerUrl(DEFAULT_CHAIN, "address", token)} target="_blank" rel="noreferrer">Token ↗</a>
          <a href={explorerUrl(DEFAULT_CHAIN, "address", pair)} target="_blank" rel="noreferrer">Pool ↗</a>
          <span className="muted">Seeded {timeAgo(createdAt)}</span>
        </div>
        <Sparkline address={token} width={1000} height={170} />
      </div>

      <div className="detail-stats">
        <div className="dstat"><span className="label">Market cap</span><span className="value">{price == null ? "–" : fmtBig(mcap, 18, 2)} {stockTicker}</span></div>
        <div className="dstat"><span className="label">Total supply</span><span className="value">{fmtBig(totalSupply, 18, 2)} {symbol}</span></div>
        <div className="dstat"><span className="label">Pool {symbol}</span><span className="value">{fmtBig(coinReserve, 18, 2)}</span></div>
        <div className="dstat"><span className="label">Pool {stockTicker}</span><span className="value">{fmtBig(stockReserve, 18, 2)}</span></div>
      </div>

      <div className="detail-grid">
        <div className="seg">
          <button className={"seg-btn" + (tab === "trade" ? " active" : "")} onClick={() => setTab("trade")}>Trade</button>
          <button className={"seg-btn" + (tab === "lp" ? " active" : "")} onClick={() => setTab("lp")}>Liquidity</button>
        </div>
        {tab === "trade"
          ? <TradeWidget coin={coin} wallet={wallet} />
          : <LiquidityWidget coin={coin} wallet={wallet} />}
      </div>
    </section>
  );
}
