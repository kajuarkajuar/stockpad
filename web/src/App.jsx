import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./hooks/useWallet";
import { fetchCoins, fetchCoin, readLaunchpad, claimCreatorFees, waitForReceipt } from "./lib/client";
import { isDeployed, CONTRACTS } from "./config/addresses";
import { STOCKS } from "./config/stocks";
import { fmtBig, shortAddr, timeAgo, explorerUrl } from "./lib/format";
import { trendOf } from "./lib/sparkline";
import { DEFAULT_CHAIN } from "./config/chain";

import Header from "./components/Header";
import CoinCard from "./components/CoinCard";
import Sparkline from "./components/Sparkline";
import CreateCoin from "./components/CreateCoin";
import TradeWidget from "./components/TradeWidget";
import LiquidityWidget from "./components/LiquidityWidget";
import MemeFloat from "./components/MemeFloat";
import MemeTicker from "./components/MemeTicker";
import EmojiRain from "./components/EmojiRain";
import { randomMeme } from "./lib/memes";
import mascot from "./assets/mascot.png";

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

  // meme chaos
  const [toasts, setToasts] = useState([]);
  const [celebrate, setCelebrate] = useState(0);

  const addMemeToast = useCallback(() => {
    const t = { id: Date.now() + Math.random(), text: randomMeme() };
    setToasts((ts) => [...ts.slice(-2), t]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== t.id)), 4200);
  }, []);

  let view;
  if (route.startsWith("#/coin/")) {
    const id = route.split("/")[2];
    view = <CoinDetail id={id} wallet={wallet} navigate={navigate} />;
  } else if (route.startsWith("#/explore")) {
    view = <Explore wallet={wallet} navigate={navigate} />;
  } else {
    view = <Home wallet={wallet} navigate={navigate} onLaunch={() => setCelebrate((c) => c + 1)} />;
  }

  return (
    <div className="app">
      <MemeFloat />
      <EmojiRain trigger={celebrate} />
      <Header wallet={wallet} onNavigate={navigate} onMeme={addMemeToast} />
      <MemeTicker />
      <main className="main">{view}</main>

      <div className="meme-toasts">
        {toasts.map((t) => (
          <div key={t.id} className="meme-toast">{t.text}</div>
        ))}
      </div>

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

function Home({ wallet, navigate, onLaunch }) {
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
            Name your token, pick a Stock Token, and it launches onto a bonding curve —
            no liquidity needed. Price rises with every buy. Graduate and the LP burns forever.
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
            <img src={mascot} className="hero-card-cat" alt="MemePad cat mascot" />
            <div>
              <div style={{ fontWeight: 700, color: "var(--text)" }}>Meowket</div>
              <div className="muted" style={{ fontSize: 12 }}>Live meme market</div>
            </div>
            <span className="badge-chip live" style={{ marginLeft: "auto" }}>LFG</span>
          </div>
          <div className="hero-stats">
            <Stat label="Coins launched" value={coins ? String(coins.length) : "…"} />
            <Stat label="Stock tokens" value={Object.keys(STOCKS).length} />
            <Stat label="Trading fee" value="1%" />
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
          <CreateCoin
            wallet={wallet}
            onCreated={(id) => {
              onLaunch();
              navigate("#/coin/" + id);
            }}
          />
          <div className="why">
            <h2>How it works</h2>
            <ol className="steps">
              <li><b>Launch</b> — pay a flat 0.0005 ETH fee; 1B supply goes onto a bonding curve. No LP, no pre-sale.</li>
              <li><b>Earn</b> — you keep a share of every trade (1% fee split, set at launch).</li>
              <li><b>Ape in</b> — every buy pumps the price; sell anytime. Dev buy is optional.</li>
              <li><b>Graduate</b> — once the curve fills, trading moves to the AMM and the LP is burned.</li>
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
              <CoinCard key={c.index} coin={c} onOpen={(id) => navigate("#/coin/" + id)} />
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
            <CoinCard key={c.index} coin={c} onOpen={(id) => navigate("#/coin/" + id)} />
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
  const [claiming, setClaiming] = useState(false);

  const refresh = () => fetchCoin(id).then(setCoin).catch(() => {});

  useEffect(() => {
    setCoin(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function claimFees() {
    setErr("");
    setClaiming(true);
    try {
      const h = await claimCreatorFees(Number(id), wallet.account);
      await waitForReceipt(h);
      await refresh();
    } catch (e) {
      setErr(e?.shortMessage || e?.message || "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  if (err) return <section className="section"><div className="alert error">{err}</div></section>;
  if (!coin) return <section className="section"><p className="muted">Loading coin…</p></section>;

  const {
    token, pair, quote, creator, name, symbol, totalSupply, quoteDecimals,
    realTokenReserve, realQuoteReserve, graduationTarget, createdAt,
    graduated, price, mcap, progress, state,
    creatorFeeBps, creatorAccrued,
  } = coin;

  const stockTicker = Object.keys(STOCKS).find((t) => STOCKS[t].address.toLowerCase() === quote.toLowerCase()) || "QUOTE";
  const stockColor = STOCKS[stockTicker]?.color || "#888";
  const trend = trendOf(token);
  const pct = Math.min(100, Number((progress * 100n) / 10n ** 18n));
  const isCreator = wallet.account && creator.toLowerCase() === wallet.account.toLowerCase();

  // post-graduation price from AMM reserves
  let ammPrice = null, coinReserve = 0n, quoteReserve = 0n;
  if (graduated && state) {
    const coinIs0 = state.token0.toLowerCase() === token.toLowerCase();
    coinReserve = coinIs0 ? state.reserve0 : state.reserve1;
    quoteReserve = coinIs0 ? state.reserve1 : state.reserve0;
    if (coinReserve > 0n) ammPrice = (quoteReserve * 10n ** 18n) / coinReserve;
  }
  const shownPrice = graduated ? ammPrice : price;

  return (
    <section className="section" style={{ marginTop: 24 }}>
      <button className="back-link" onClick={() => navigate("#/explore")}>← Back to explore</button>

      <div className="detail-head">
        <div className="coin-ident big">
          <div className="coin-logo lg" style={{ background: `linear-gradient(145deg, ${stockColor}, ${stockColor}cc)` }}>
            {symbol.slice(0, 1)}
          </div>
          <div>
            <div className="detail-symbol">
              {symbol} <span className="unit">/ {stockTicker}</span>
              {graduated && <span className="badge-chip live">Graduated ✓</span>}
            </div>
            <div className="coin-name">{name} · created by {shortAddr(creator)}</div>
          </div>
        </div>
        <div className="detail-price">
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <span className="big-price">{shownPrice == null ? "–" : fmtBig(shownPrice, 18, 10)}</span>
            <span className={"change-chip " + (trend.up ? "up" : "down")}>
              {trend.up ? "▲" : "▼"} {Math.abs(trend.pct)}%
            </span>
          </div>
          <span className="unit">{stockTicker} per {symbol}</span>
        </div>
      </div>

      <div className="detail-chart">
        {!graduated && (
          <div className="progress-box" style={{ marginBottom: 14 }}>
            <div className="field-row">
              <span className="label">Bonding curve progress</span>
              <span className="label">{pct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: pct + "%" }} />
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
              {fmtBig(realQuoteReserve, quoteDecimals, 2)} / {fmtBig(graduationTarget, quoteDecimals, 0)} {stockTicker} collected → graduates to AMM, LP burned.
            </p>
          </div>
        )}
        <div className="detail-links" style={{ marginTop: 0, marginBottom: 14 }}>
          <a href={explorerUrl(DEFAULT_CHAIN, "address", token)} target="_blank" rel="noreferrer">Token ↗</a>
          {graduated && pair && !/^0x0+$/.test(pair) && (
            <a href={explorerUrl(DEFAULT_CHAIN, "address", pair)} target="_blank" rel="noreferrer">Pool ↗</a>
          )}
          <span className="muted">Launched {timeAgo(createdAt)}</span>
        </div>
        <Sparkline address={token} width={1000} height={170} />
      </div>

      <div className="detail-stats">
        <div className="dstat"><span className="label">FDV</span><span className="value">{graduated ? "—" : fmtBig(mcap, quoteDecimals, 2)} {stockTicker}</span></div>
        <div className="dstat"><span className="label">Total supply</span><span className="value">{fmtBig(totalSupply, 18, 0)} {symbol}</span></div>
        <div className="dstat"><span className="label">Creator fee share</span><span className="value">{Number(creatorFeeBps) / 100}% of fee</span></div>
        <div className="dstat"><span className="label">{graduated ? "Pool " + stockTicker : "Collected"}</span><span className="value">{graduated ? fmtBig(quoteReserve, 18, 2) : fmtBig(realQuoteReserve, quoteDecimals, 2)} {stockTicker}</span></div>
      </div>

      {isCreator && creatorAccrued > 0n && (
        <div className="claim-bar">
          <span className="muted">Earned: {fmtBig(creatorAccrued, quoteDecimals, 4)} {stockTicker}</span>
          <button className="btn btn-primary" onClick={claimFees} disabled={claiming}>
            {claiming ? "Claiming…" : "Claim fees"}
          </button>
        </div>
      )}

      <div className="detail-grid">
        <div className="seg">
          <button className={"seg-btn" + (tab === "trade" ? " active" : "")} onClick={() => setTab("trade")}>Trade</button>
          {graduated && (
            <button className={"seg-btn" + (tab === "lp" ? " active" : "")} onClick={() => setTab("lp")}>Liquidity</button>
          )}
        </div>
        {tab === "trade"
          ? <TradeWidget coin={coin} wallet={wallet} />
          : graduated
            ? <LiquidityWidget coin={coin} wallet={wallet} />
            : null}
      </div>
    </section>
  );
}
