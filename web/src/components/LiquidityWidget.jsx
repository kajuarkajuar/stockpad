import { useEffect, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { CONTRACTS, isDeployed } from "../config/addresses";
import { STOCKS } from "../config/stocks";
import { publicClient, readBalance, walletClient, waitForReceipt, MAX_UINT } from "../lib/client";
import { fmtBig } from "../lib/format";
import StockPadRouterABI from "../abi/StockPadRouter.json";

export default function LiquidityWidget({ coin, wallet }) {
  const { account, onRightChain, connect, switchChain } = wallet;
  const { token, pair, stockToken, symbol } = coin;

  const stockTicker = Object.keys(STOCKS).find((t) => STOCKS[t].address.toLowerCase() === stockToken.toLowerCase()) || "STOCK";

  const [tab, setTab] = useState("add");
  const [amountA, setAmountA] = useState(""); // coin
  const [amountB, setAmountB] = useState(""); // stock
  const [lpBal, setLpBal] = useState(0n);
  const [coinBal, setCoinBal] = useState(0n);
  const [stockBal, setStockBal] = useState(0n);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!account) return;
    readBalance(pair, account).then(setLpBal).catch(() => {});
    readBalance(token, account).then(setCoinBal).catch(() => {});
    readBalance(stockToken, account).then(setStockBal).catch(() => {});
  }, [account, pair, token, stockToken]);

  const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 600);

  async function approve(tokenAddr, spender, amount) {
    const allowance = await publicClient.readContract({ address: tokenAddr, abi: erc20Abi, functionName: "allowance", args: [account, spender] });
    if (allowance >= amount) return;
    const wc = walletClient();
    const h = await wc.writeContract({ address: tokenAddr, abi: erc20Abi, functionName: "approve", args: [spender, MAX_UINT], account });
    await waitForReceipt(h);
  }

  async function add() {
    setErr(""); setOk("");
    if (!account) { connect(); return; }
    if (!onRightChain) { switchChain(); return; }
    if (!isDeployed()) { setErr("Contracts not deployed yet"); return; }
    let a, b;
    try { a = parseUnits(amountA, 18); b = parseUnits(amountB, 18); } catch { setErr("Invalid amounts"); return; }
    if (a <= 0n || b <= 0n) { setErr("Enter both amounts"); return; }

    const wc = walletClient();
    setBusy(true);
    try {
      await approve(token, CONTRACTS.router, a);
      await approve(stockToken, CONTRACTS.router, b);
      setOk("Adding liquidity…");
      const hash = await wc.writeContract({
        address: CONTRACTS.router, abi: StockPadRouterABI, functionName: "addLiquidity",
        args: [token, stockToken, a, b, (a * 95n) / 100n, (b * 95n) / 100n, account, deadline()], account,
      });
      await waitForReceipt(hash);
      setOk("Liquidity added ✓");
      setAmountA(""); setAmountB("");
      readBalance(pair, account).then(setLpBal).catch(() => {});
    } catch (e) {
      setErr(e?.shortMessage || e?.message || "Add liquidity failed"); setOk("");
    } finally { setBusy(false); }
  }

  async function remove() {
    setErr(""); setOk("");
    if (!account) { connect(); return; }
    if (!onRightChain) { switchChain(); return; }
    if (!isDeployed()) { setErr("Contracts not deployed yet"); return; }
    let liq;
    try { liq = parseUnits(amountA, 18); } catch { setErr("Invalid amount"); return; }
    if (liq <= 0n) { setErr("Enter LP amount"); return; }

    const wc = walletClient();
    setBusy(true);
    try {
      await approve(pair, CONTRACTS.router, liq);
      setOk("Removing liquidity…");
      const hash = await wc.writeContract({
        address: CONTRACTS.router, abi: StockPadRouterABI, functionName: "removeLiquidity",
        args: [token, stockToken, liq, 0n, 0n, account, deadline()], account,
      });
      await waitForReceipt(hash);
      setOk("Liquidity removed ✓");
      setAmountA("");
      readBalance(pair, account).then(setLpBal).catch(() => {});
    } catch (e) {
      setErr(e?.shortMessage || e?.message || "Remove liquidity failed"); setOk("");
    } finally { setBusy(false); }
  }

  return (
    <div className="widget">
      <div className="seg">
        <button className={"seg-btn" + (tab === "add" ? " active" : "")} onClick={() => setTab("add")}>Add LP</button>
        <button className={"seg-btn" + (tab === "remove" ? " active" : "")} onClick={() => setTab("remove")}>Remove LP</button>
      </div>

      {tab === "add" ? (
        <>
          <div className="field">
            <div className="field-row"><label>{symbol}</label><button className="link-btn" onClick={() => setAmountA(fmtBig(coinBal, 18, 18))}>Max {fmtBig(coinBal, 18, 6)}</button></div>
            <div className="input-suffix"><input value={amountA} onChange={(e) => setAmountA(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0" /><span className="suffix">{symbol}</span></div>
          </div>
          <div className="field">
            <div className="field-row"><label>{stockTicker}</label><button className="link-btn" onClick={() => setAmountB(fmtBig(stockBal, 18, 18))}>Max {fmtBig(stockBal, 18, 6)}</button></div>
            <div className="input-suffix"><input value={amountB} onChange={(e) => setAmountB(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0" /><span className="suffix">{stockTicker}</span></div>
          </div>
          {err && <div className="alert error">{err}</div>}
          {ok && <div className="alert info">{ok}</div>}
          <button className="btn btn-primary btn-block" onClick={add} disabled={busy}>{busy ? "Working…" : "Add liquidity"}</button>
        </>
      ) : (
        <>
          <div className="field">
            <div className="field-row"><label>LP tokens</label><button className="link-btn" onClick={() => setAmountA(fmtBig(lpBal, 18, 18))}>Max {fmtBig(lpBal, 18, 6)}</button></div>
            <div className="input-suffix"><input value={amountA} onChange={(e) => setAmountA(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.0" /><span className="suffix">LP</span></div>
          </div>
          <p className="muted">You'll receive {symbol} + {stockTicker} back at the current pool ratio.</p>
          {err && <div className="alert error">{err}</div>}
          {ok && <div className="alert info">{ok}</div>}
          <button className="btn btn-primary btn-block" onClick={remove} disabled={busy}>{busy ? "Working…" : "Remove liquidity"}</button>
        </>
      )}
    </div>
  );
}
