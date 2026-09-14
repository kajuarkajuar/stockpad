import { STOCKS } from "../config/stocks";
import { fmtBig, priceOf, timeAgo, shortAddr } from "../lib/format";
import { trendOf } from "../lib/sparkline";
import Sparkline from "./Sparkline";

export default function CoinCard({ coin, onOpen }) {
  const { token, pair, stockToken, creator, name, symbol, totalSupply, createdAt, state } = coin;

  const stockTicker = Object.keys(STOCKS).find((t) => STOCKS[t].address.toLowerCase() === stockToken.toLowerCase()) || "STOCK";
  const stockColor = STOCKS[stockTicker]?.color || "#888";

  let price = null;
  let coinReserve = 0n;
  let stockReserve = 0n;
  if (state) {
    const coinIs0 = state.token0.toLowerCase() === token.toLowerCase();
    coinReserve = coinIs0 ? state.reserve0 : state.reserve1;
    stockReserve = coinIs0 ? state.reserve1 : state.reserve0;
    price = priceOf(coinReserve, stockReserve);
  }

  const mcap = price ? (totalSupply * price) / 10n ** 18n : 0n;
  const trend = trendOf(token);
  const isNew = Date.now() / 1000 - Number(createdAt) < 60 * 60 * 24; // < 24h

  return (
    <div className="coin-card" onClick={() => onOpen(coin.id)}>
      <div className="coin-card-top">
        <div className="coin-ident">
          <div className="coin-logo" style={{ background: `linear-gradient(145deg, ${stockColor}, ${stockColor}cc)` }}>
            {symbol.slice(0, 1)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span className="coin-symbol">{symbol}</span>
              <span className={"badge-chip " + (isNew ? "new" : "live")}>{isNew ? "New" : "Live"}</span>
            </div>
            <div className="coin-name">{name}</div>
          </div>
        </div>
        <Sparkline address={token} width={92} height={38} />
      </div>

      <div className="coin-card-stats">
        <div className="cstat">
          <span className="label">Price</span>
          <div className="value">{price == null ? "–" : fmtBig(price, 18, 8)} <span className="unit">{stockTicker}</span></div>
        </div>
        <div className="cstat">
          <span className="label">Market cap</span>
          <div className="value">{price == null ? "–" : fmtBig(mcap, 18, 2)} <span className="unit">{stockTicker}</span></div>
        </div>
      </div>

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
