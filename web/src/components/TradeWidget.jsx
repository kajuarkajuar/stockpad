import { useEffect, useMemo, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { CONTRACTS, isDeployed } from "../config/addresses";
import { STOCKS } from "../config/stocks";
import { publicClient, quoteBuy, quoteSell, quoteOut, readBalance, walletClient, waitForReceipt, MAX_UINT } from "../lib/client";
import { fmtBig } from "../lib/format";
import LaunchpadABI from "../abi/Launchpad.json";
import MemePadRouterABI from "../abi/MemePadRouter.json";

export default function TradeWidget({ coin, wallet }) {
  const { account, onRightChain, connect, switchChain } = wallet;
  const { index, token, quote, symbol, graduated, state } = coin;

  const stockTicker = Object.keys(STOCKS).find((t) => STOCKS[t].address.toLowerCase() === quote.toLowerCase()) || "QUOTE";

  const [side, setSide] = useState("buy"); // buy = quote -> coin
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(2);
  const [coinBal, setCoinBal] = useState(0n);
  const [quoteBal, setQuoteBal] = useState(0n);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!account) { setCoinBal(0n); setQuoteBal(0n); return; }
    readBalance(token, account).then(setCoinBal).catch(() => {});
    readBalance(quote, account).then(setQuoteBal).catch(() => {});
  }, [account, token, quote]);

  const inputToken = side === "buy" ? quote : token;
  const outputToken = side === "buy" ? token : quote;

  // live quote (async, debounced)
  const [quoteAmt, setQuoteAmt] = useState(null);
  useEffect(() => {
    let alive = true;
    let t;
    setQuoteAmt(null);
    if (!amount) return;
    t = setTimeout(async () => {
      try {
        const amt = parseUnits(amount, 18);
        if (amt <= 0n) return;
        let out = 0n;
        if (graduated && state) {
          out = quoteOut(state, amt, inputToken);
        } else if (side === "buy") {
          out = (await quoteBuy(index, amt)).tokenOut;
        } else {
          const r = await quoteSell(index, amt);
          out = r.quoteOut - r.fee;
        }
        if (alive) setQuoteAmt(out);
      } catch { if (alive) setQuoteAmt(null); }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [amount, side, index, inputToken, graduated, state]);

  const minOut = quoteAmt ? (quoteAmt * BigInt(Math.round((100 - slippage) * 100))) / 10000n : 0n;

  async function run() {
    setErr(""); setOk("");
    if (!account) { connect(); return; }
    if (!onRightChain) { switchChain(); return; }
    if (!isDeployed()) { setErr("Contracts not deployed yet"); return; }

    let amt;
    try { amt = parseUnits(amount, 18); } catch { setErr("Invalid amount"); return; }
    if (amt <= 0n || !quoteAmt || quoteAmt <= 0n) { setErr("Enter an amount"); return; }

    const wc = walletClient();
    setBusy(true);
    try {
      // approve input token
      const spender = graduated ? CONTRACTS.router : CONTRACTS.launchpad;
      const allowance = await publicClient.readContract({
        address: inputToken, abi: erc20Abi, functionName: "allowance", args: [account, spender],
      });
      if (allowance < amt) {
        setOk("Approve " + (side === "buy" ? stockTicker : symbol) + "…");
        const h = await wc.writeContract({
          address: inputToken, abi: erc20Abi, functionName: "approve", args: [spender, MAX_UINT], account,
        });
        await waitForReceipt(h);
      }

      setOk("Swapping…");
      let hash;
      if (graduated) {
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
        hash = await wc.writeContract({
          address: CONTRACTS.router, abi: MemePadRouterABI, functionName: "swapExactTokensForTokens",
          args: [amt, minOut, inputToken, outputToken, account, deadline], account,
        });
      } else if (side === "buy") {
        hash = await wc.writeContract({
          address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "buy",
          args: [BigInt(index), amt, minOut], account,
        });
      } else {
        hash = await wc.writeContract({
          address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "sell",
          args: [BigInt(index), amt, minOut], account,
        });
      }
      await waitForReceipt(hash);
      setOk("Swapped ✓");
      setAmount("");
      readBalance(token, account).then(setCoinBal).catch(() => {});
      readBalance(quote, account).then(setQuoteBal).catch(() => {});
    } catch (e) {
      setErr(e?.shortMessage || e?.message || "Swap failed");
      setOk("");
    } finally {
      setBusy(false);
    }
  }

  const max = side === "buy" ? quoteBal : coinBal;

  return (
    <div className="widget">
      {!graduated && (
        <div className="progress-box">
          <div className="field-row">
            <span className="label">Bonding curve progress</span>
            <span className="label">{Math.min(100, Number((coin.progress * 10000n) / 10n ** 18n) / 100)}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: Math.min(100, Number((coin.progress * 100n) / 10n ** 18n)) + "%" }}
            />
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Graduate at {fmtBig(coin.graduationTarget, 18, 0)} {stockTicker} collected → LP burns, trading moves to the AMM.
          </p>
        </div>
      )}

      <div className="seg">
        <button className={"seg-btn" + (side === "buy" ? " active" : "")} onClick={() => { setSide("buy"); setAmount(""); }}>Buy {symbol}</button>
        <button className={"seg-btn" + (side === "sell" ? " active" : "")} onClick={() => { setSide("sell"); setAmount(""); }}>Sell {symbol}</button>
      </div>

      <div className="field">
        <div className="field-row">
          <label>{side === "buy" ? `You pay (${stockTicker})` : `You pay (${symbol})`}</label>
          <button className="link-btn" onClick={() => setAmount(fmtBig(max, 18, 18))}>
            Max: {fmtBig(max, 18, 6)}
          </button>
        </div>
        <div className="input-suffix">
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0" inputMode="decimal" />
          <span className="suffix">{side === "buy" ? stockTicker : symbol}</span>
        </div>
      </div>

      <div className="field">
        <div className="field-row">
          <label>You receive (est.)</label>
          <span className="label">{graduated ? "0.30% fee" : "1% fee"}</span>
        </div>
        <div className="input-suffix readonly">
          <input readOnly value={quoteAmt != null ? fmtBig(quoteAmt, 18, 8) : "–"} />
          <span className="suffix">{side === "buy" ? symbol : stockTicker}</span>
        </div>
      </div>

      <div className="field">
        <div className="field-row">
          <label>Slippage tolerance</label>
          <span className="label">{slippage}%</span>
        </div>
        <input type="range" min="0.1" max="15" step="0.1" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} />
      </div>

      {err && <div className="alert error">{err}</div>}
      {ok && <div className="alert info">{ok}</div>}

      <button className="btn btn-primary btn-block" onClick={run} disabled={busy}>
        {busy ? "Working…" : account ? (side === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`) : "Connect wallet"}
      </button>
    </div>
  );
}
