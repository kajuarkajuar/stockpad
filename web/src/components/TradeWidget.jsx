import { useEffect, useMemo, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { CONTRACTS, isDeployed } from "../config/addresses";
import { STOCKS } from "../config/stocks";
import { publicClient, quoteOut, readBalance, walletClient, waitForReceipt, MAX_UINT } from "../lib/client";
import { fmtBig } from "../lib/format";
import MemePadRouterABI from "../abi/MemePadRouter.json";

export default function TradeWidget({ coin, wallet }) {
  const { account, onRightChain, connect, switchChain } = wallet;
  const { token, pair, stockToken, symbol, state } = coin;

  const stockTicker = Object.keys(STOCKS).find((t) => STOCKS[t].address.toLowerCase() === stockToken.toLowerCase()) || "STOCK";

  const [side, setSide] = useState("buy"); // buy = stock -> coin
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [coinBal, setCoinBal] = useState(0n);
  const [stockBal, setStockBal] = useState(0n);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!account) { setCoinBal(0n); setStockBal(0n); return; }
    readBalance(token, account).then(setCoinBal).catch(() => {});
    readBalance(stockToken, account).then(setStockBal).catch(() => {});
  }, [account, token, stockToken]);

  const inputToken = side === "buy" ? stockToken : token;
  const outputToken = side === "buy" ? token : stockToken;

  const quote = useMemo(() => {
    try {
      const amt = parseUnits(amount || "0", 18);
      if (amt <= 0n || !state) return 0n;
      return quoteOut(state, amt, inputToken);
    } catch {
      return 0n;
    }
  }, [amount, state, inputToken]);

  const minOut = (quote * BigInt(Math.round((100 - slippage) * 100))) / 10000n;

  async function run() {
    setErr(""); setOk("");
    if (!account) { connect(); return; }
    if (!onRightChain) { switchChain(); return; }
    if (!isDeployed()) { setErr("Contracts not deployed yet"); return; }

    let amt;
    try { amt = parseUnits(amount, 18); } catch { setErr("Invalid amount"); return; }
    if (amt <= 0n || quote <= 0n) { setErr("Enter an amount"); return; }

    const wc = walletClient();
    setBusy(true);
    try {
      const allowance = await publicClient.readContract({
        address: inputToken, abi: erc20Abi, functionName: "allowance", args: [account, CONTRACTS.router],
      });
      if (allowance < amt) {
        setOk("Approve " + (side === "buy" ? stockTicker : symbol) + "…");
        const h = await wc.writeContract({
          address: inputToken, abi: erc20Abi, functionName: "approve", args: [CONTRACTS.router, MAX_UINT], account,
        });
        await waitForReceipt(h);
      }
      setOk("Swapping…");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      const hash = await wc.writeContract({
        address: CONTRACTS.router, abi: MemePadRouterABI, functionName: "swapExactTokensForTokens",
        args: [amt, minOut, inputToken, outputToken, account, deadline], account,
      });
      await waitForReceipt(hash);
      setOk("Swapped ✓");
      setAmount("");
      // refresh balances
      readBalance(token, account).then(setCoinBal).catch(() => {});
      readBalance(stockToken, account).then(setStockBal).catch(() => {});
    } catch (e) {
      setErr(e?.shortMessage || e?.message || "Swap failed");
      setOk("");
    } finally {
      setBusy(false);
    }
  }

  const max = side === "buy" ? stockBal : coinBal;
  const pricePerCoin = quote > 0n && side === "buy" ? null : null; // keep simple

  return (
    <div className="widget">
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
          <span className="label">0.30% fee</span>
        </div>
        <div className="input-suffix readonly">
          <input readOnly value={quote > 0n ? fmtBig(quote, 18, 8) : "–"} />
          <span className="suffix">{side === "buy" ? symbol : stockTicker}</span>
        </div>
      </div>

      <div className="field">
        <div className="field-row">
          <label>Slippage tolerance</label>
          <span className="label">{slippage}%</span>
        </div>
        <input type="range" min="0.1" max="10" step="0.1" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} />
      </div>

      {err && <div className="alert error">{err}</div>}
      {ok && <div className="alert info">{ok}</div>}

      <button className="btn btn-primary btn-block" onClick={run} disabled={busy}>
        {busy ? "Working…" : account ? (side === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`) : "Connect wallet"}
      </button>
    </div>
  );
}
