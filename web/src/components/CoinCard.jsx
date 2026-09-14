import { STOCKS } from "../config/stocks";
import { fmtBig, priceOf, timeAgo, shortAddr } from "../lib/format";
import Sparkline from "./Sparkline";

export default function CoinCard({ coin, onOpen }) {
  const { token, pair, stockToken, creator, name, symbol, totalSupply, stockAmount, createdAt, state } = coin;

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

  return (
    <div className="coin-card" onClick={() => onOpen(coin.id)}>
      <div className="coin-card-top">
        <div className="coin-ident">
          <div className="coin-logo" style={{ background: stockColor }}>{symbol.slice(0, 1)}</div>
          <div>
            <div className="coin-symbol">{symbol}</div>
            <div className="coin-name">{name}</div>
          </div>
        </div>
        <Sparkline address={token} up />
      </div>

      <div className="coin-card-row">
        <span className="label">Price</span>
        <span className="value">
          {price == null ? "–" : fmtBig(price, 18, 8)}{" "}
          <span className="unit">{stockTicker}</span>
        </span>
      </div>
      <div className="coin-card-row">
        <span className="label">Paired with</span>
        <span className="value" style={{ color: stockColor }}>{stockTicker}</span>
      </div>
      <div className="coin-card-row">
        <span className="label">Market cap</span>
        <span className="value">{price == null ? "–" : fmtBig(mcap, 18, 2)} <span className="unit">{stockTicker}</span></span>
      </div>

      <div className="coin-card-foot">
        <span className="muted">by {shortAddr(creator)}</span>
        <span className="muted">{timeAgo(createdAt)}</span>
      </div>
    </div>
  );
}
