export function shortAddr(a) {
  if (!a) return "";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

export function fmtBig(value, decimals = 18, maxDec = 6) {
  if (value == null) return "–";
  let v;
  try {
    v = Number(value) / 10 ** decimals;
  } catch {
    return "–";
  }
  if (!isFinite(v)) return "–";
  if (v === 0) return "0";
  if (v > 0 && v < 0.000001) return "<0.000001";
  if (v < 1) return v.toFixed(Math.min(maxDec, 6)).replace(/\.?0+$/, "");
  if (v >= 1e9) return (v / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(2).replace(/\.?0+$/, "") + "K";
  return v.toLocaleString(undefined, { maximumFractionDigits: maxDec });
}

// price in "stock units per coin", both 18-decimal: stockReserve / coinReserve
export function priceOf(coinReserve, stockReserve) {
  if (!coinReserve || !stockReserve) return null;
  return (stockReserve * 10n ** 18n) / coinReserve; // 18-dec value
}

export function timeAgo(ts) {
  const s = Math.floor(Date.now() / 1000) - Number(ts);
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

export function explorerUrl(chain, type, value) {
  const base = chain?.blockExplorers?.default?.url || "https://robinhoodchain.blockscout.com";
  return `${base}/${type}/${value}`;
}

export function socialHref(kind, v) {
  if (!v) return null;
  v = v.trim();
  if (!v) return null;
  if (kind === "website") return /^https?:\/\//i.test(v) ? v : "https://" + v;
  if (kind === "twitter") return /^https?:\/\//i.test(v) ? v : "https://x.com/" + v.replace(/^@/, "");
  if (kind === "telegram") return /^https?:\/\//i.test(v) ? v : "https://t.me/" + v.replace(/^@/, "");
  return null;
}

export function ipfsHttp(uri) {
  if (!uri) return null;
  const s = uri.trim();
  if (s.startsWith("ipfs://")) return "https://ipfs.io/ipfs/" + s.slice(7);
  return s;
}
