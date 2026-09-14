import { useEffect, useMemo, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { CONTRACTS, isDeployed } from "../config/addresses";
import { STOCKS, STOCK_TICKERS } from "../config/stocks";
import { publicClient, readLaunchpad, walletClient, waitForReceipt, MAX_UINT } from "../lib/client";
import { fmtBig } from "../lib/format";
import LaunchpadABI from "../abi/Launchpad.json";

export default function CreateCoin({ wallet, onCreated }) {
  const { account, onRightChain, connect, switchChain } = wallet;

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [ticker, setTicker] = useState("NVDA");
  const [stockAmount, setStockAmount] = useState("1");
  const [fee, setFee] = useState(0n);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [err, setErr] = useState("");
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    readLaunchpad().then((l) => setFee(l.fee)).catch(() => {});
  }, []);

  const stock = STOCKS[ticker];

  const preview = useMemo(() => {
    let price = null;
    try {
      const total = parseUnits(supply || "0", 18);
      const stockAmt = parseUnits(stockAmount || "0", 18);
      if (total > 0n && stockAmt > 0n) price = (stockAmt * 10n ** 18n) / total;
    } catch {
      price = null;
    }
    return { price };
  }, [supply, stockAmount]);

  async function handleCreate() {
    setErr("");
    if (!account) { connect(); return; }
    if (!onRightChain) { switchChain(); return; }
    if (!isDeployed()) { setErr("Contracts not deployed yet — paste your addresses in src/config/addresses.js"); return; }

    let totalSupply, stockAmt;
    try {
      totalSupply = parseUnits(supply, 18);
      stockAmt = parseUnits(stockAmount, 18);
    } catch {
      setErr("Invalid amounts");
      return;
    }
    if (!name.trim() || !symbol.trim()) { setErr("Name and symbol are required"); return; }
    if (totalSupply <= 0n || stockAmt <= 0n) { setErr("Supply and stock amount must be > 0"); return; }

    const wc = walletClient();
    setBusy(true);
    try {
      // 1. approve the Stock Token to the launchpad
      setStep("Approving " + ticker + "…");
      const allowance = await publicClient.readContract({
        address: stock.address, abi: erc20Abi, functionName: "allowance", args: [account, CONTRACTS.launchpad],
      });
      if (allowance < stockAmt) {
        const h = await wc.writeContract({
          address: stock.address, abi: erc20Abi, functionName: "approve",
          args: [CONTRACTS.launchpad, MAX_UINT], account,
        });
        await waitForReceipt(h);
      }

      // 2. create the coin + seed LP
      setStep("Creating coin & seeding liquidity…");
      const hash = await wc.writeContract({
        address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "createCoin",
        args: [name.trim(), symbol.trim().toUpperCase(), totalSupply, stock.address, stockAmt],
        value: fee, account,
      });
      setTxHash(hash);
      const receipt = await waitForReceipt(hash);

      const countBefore = await readLaunchpad().then((l) => Number(l.count));
      // the new coin's id = index it was pushed at = count before this tx
      const newId = Math.max(0, countBefore - 1);
      setStep("Done!");
      onCreated(newId, receipt);
    } catch (e) {
      setErr(e?.shortMessage || e?.message || "Transaction failed");
      setStep("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="create-panel">
      <div className="panel-head">
        <h2>Launch a coin</h2>
        <p className="muted">Pick a stock token, name your coin, and the whole supply goes straight into a liquidity pool.</p>
      </div>

      <div className="field">
        <label>Coin name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nvidia Moon" maxLength={40} />
      </div>

      <div className="field">
        <label>Ticker</label>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          placeholder="NVM"
          maxLength={10}
        />
      </div>

      <div className="field">
        <label>Total supply</label>
        <input value={supply} onChange={(e) => setSupply(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" />
      </div>

      <div className="field">
        <label>Pair with (Stock Token)</label>
        <div className="stock-grid">
          {STOCK_TICKERS.map((t) => (
            <button
              key={t}
              className={"stock-chip" + (ticker === t ? " active" : "")}
              style={ticker === t ? { borderColor: STOCKS[t].color } : {}}
              onClick={() => setTicker(t)}
            >
              <span className="stock-dot" style={{ background: STOCKS[t].color }} />
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Stock tokens to seed LP</label>
        <div className="input-suffix">
          <input value={stockAmount} onChange={(e) => setStockAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" />
          <span className="suffix">{ticker}</span>
        </div>
      </div>

      <div className="preview-box">
        <div className="preview-row">
          <span className="label">Starting price</span>
          <span className="value">
            {preview.price == null ? "–" : fmtBig(preview.price, 18, 10)} <span className="unit">{ticker} / {symbol || "?"}</span>
          </span>
        </div>
        <div className="preview-row">
          <span className="label">Pool seeding</span>
          <span className="value">{supply || 0} {symbol || "?"} + {stockAmount || 0} {ticker}</span>
        </div>
        <div className="preview-row">
          <span className="label">You receive</span>
          <span className="value">100% of the LP tokens</span>
        </div>
        <div className="preview-row">
          <span className="label">Launch fee</span>
          <span className="value">{fmtBig(fee, 18, 6)} ETH</span>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {txHash && <div className="alert info">Tx: {txHash.slice(0, 14)}… — check Blockscout</div>}

      <button className="btn btn-primary btn-block" onClick={handleCreate} disabled={busy}>
        {busy ? (step || "Working…") : account ? "Create coin" : "Connect wallet to create"}
      </button>
    </div>
  );
}
