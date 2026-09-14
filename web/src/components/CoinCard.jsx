import { STOCKS } from "../config/stocks";
import { fmtBig, timeAgo, shortAddr } from "../lib/format";
import { trendOf } from "../lib/sparkline";
import Sparkline from "./Sparkline";

export default function CoinCard({ coin, onOpen }) {
  const { token, quote, creator, name, symbol, quoteDecimals, createdAt, graduated, price, mcap, progress } = coin;

  const stockTicker = Object.keys(STOCKS).find((t) => STOCKS[t].address.toLowerCase() === quote.toLowerCase()) || "QUOTE";
  const stockColor = STOCKS[stockTicker]?.color || "#888";

  const trend = trendOf(token);
  const isNew = Date.now() / 1000 - Number(createdAt) < 60 * 60 * 24; // < 24h
  const pct = Math.min(100, Number((progress * 100n) / 10n ** 18n));

  return (
    <div className="coin-card" onClick={() => onOpen(coin.index)}>
      <div className="coin-card-top">
        <div className="coin-ident">
          <div className="coin-logo" style={{ background: `linear-gradient(145deg, ${stockColor}, ${stockColor}cc)` }}>
            {symbol.slice(0, 1)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span className="coin-symbol">{symbol}</span>
              {graduated ? (
                <span className="badge-chip live">Graduated</span>
              ) : (
                <span className={"badge-chip " + (isNew ? "new" : "")}>{isNew ? "New" : "Live"}</span>
              )}
            </div>
            <div className="coin-name">{name}</div>
          </div>
        </div>
        <Sparkline address={token} width={92} height={38} />
      </div>

      <div className="coin-card-stats">
        <div className="cstat">
          <span className="label">Price</span>
          <div className="value">{graduated ? "—" : fmtBig(price, 18, 8)} <span className="unit">{stockTicker}</span></div>
        </div>
        <div className="cstat">
          <span className="label">FDV</span>
          <div className="value">{graduated ? "—" : fmtBig(mcap, quoteDecimals, 2)} <span className="unit">{stockTicker}</span></div>
        </div>
      </div>

      {!graduated && (
        <div className="mini-progress">
          <div className="mini-progress-bar">
            <div className="mini-progress-fill" style={{ width: pct + "%" }} />
          </div>
          <span className="mini-progress-label">{pct}%</span>
        </div>
      )}

      <div className="coin-card-foot">
        <span className="muted">
          {shortAddr(creator)} · {timeAgo(createdAt)}
        </span>
        <span className={"change-chip " + (trend.up ? "up" : "down")}>
          {trend.up ? "▲" : "▼"} {Math.abs(trend.pct)}%
        </span>
      </div>
    </div>
  );
}
