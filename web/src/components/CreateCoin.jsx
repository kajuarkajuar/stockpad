import { useEffect, useMemo, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { CONTRACTS, isDeployed } from "../config/addresses";
import { STOCKS, STOCK_TICKERS } from "../config/stocks";
import { publicClient, readLaunchpad, readDecimals, curveDefaults, walletClient, waitForReceipt, MAX_UINT, TOTAL_SUPPLY, FEE_BPS } from "../lib/client";
import { fmtBig } from "../lib/format";
import LaunchpadABI from "../abi/Launchpad.json";

export default function CreateCoin({ wallet, onCreated }) {
  const { account, onRightChain, connect, switchChain } = wallet;

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [ticker, setTicker] = useState("NVDA");
  const [devBuy, setDevBuy] = useState("");
  const [creatorShare, setCreatorShare] = useState(50); // % of the 1% fee
  const [fee, setFee] = useState(0n);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [err, setErr] = useState("");
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    readLaunchpad().then((l) => setFee(l.fee)).catch(() => {});
  }, []);

  const stock = STOCKS[ticker];
  const seed = 1n * 10n ** 18n; // stock tokens are 18 decimals
  const target = 100n * 10n ** 18n; // graduate at 100 [ticker]

  const devBuyRaw = useMemo(() => {
    try { return parseUnits(devBuy || "0", 18); } catch { return 0n; }
  }, [devBuy]);

  const creatorFeeBps = BigInt(Math.round(creatorShare * 100)); // % → bps of the fee

  async function handleCreate() {
    setErr("");
    if (!account) { connect(); return; }
    if (!onRightChain) { switchChain(); return; }
    if (!isDeployed()) { setErr("Contracts not deployed yet — paste your addresses in src/config/addresses.js"); return; }
    if (!name.trim() || !symbol.trim()) { setErr("Name and symbol are required"); return; }

    const wc = walletClient();
    setBusy(true);
    try {
      // 1. launch the coin onto its bonding curve (flat ETH fee, pons-style)
      setStep("Launching on the curve…");
      const hash = await wc.writeContract({
        address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "launch",
        args: [name.trim(), symbol.trim().toUpperCase(), stock.address, seed, target, creatorFeeBps],
        value: fee, account,
      });
      setTxHash(hash);
      const receipt = await waitForReceipt(hash);

      const countBefore = await readLaunchpad().then((l) => Number(l.count));
      const newIndex = Math.max(0, countBefore - 1);

      // 2. optional dev buy (same as pons — buy in before anyone else)
      if (devBuyRaw > 0n) {
        setStep("Dev buy: " + ticker + "…");
        const allowance = await publicClient.readContract({
          address: stock.address, abi: erc20Abi, functionName: "allowance", args: [account, CONTRACTS.launchpad],
        });
        if (allowance < devBuyRaw) {
          const h = await wc.writeContract({
            address: stock.address, abi: erc20Abi, functionName: "approve", args: [CONTRACTS.launchpad, MAX_UINT], account,
          });
          await waitForReceipt(h);
        }
        const b = await wc.writeContract({
          address: CONTRACTS.launchpad, abi: LaunchpadABI, functionName: "buy",
          args: [BigInt(newIndex), devBuyRaw, 0n], account,
        });
        await waitForReceipt(b);
      }

      setStep("Done!");
      onCreated(newIndex, receipt);
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
        <p className="muted">No liquidity needed. Pay a flat ETH fee, launch onto the curve — and you earn a share of every trade.</p>
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
        <label>Quote token (Stock Token)</label>
        <div className="stock-grid">
          {STOCK_TICKERS.map((t) => (
            <button
              key={t}
              className={"stock-chip" + (ticker === t ? " active" : "")}
              onClick={() => setTicker(t)}
            >
              <span className="stock-dot" style={{ background: STOCKS[t].color }} />
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="field-row">
          <label>Creator fee share</label>
          <span className="label">{creatorShare}% of the 1% fee</span>
        </div>
        <input type="range" min="0" max="100" step="5" value={creatorShare} onChange={(e) => setCreatorShare(Number(e.target.value))} />
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          You earn this cut of every buy &amp; sell. Locked at launch.
        </p>
      </div>

      <div className="field">
        <div className="field-row">
          <label>Dev buy (optional)</label>
          <span className="label">buy in before others</span>
        </div>
        <div className="input-suffix">
          <input value={devBuy} onChange={(e) => setDevBuy(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" inputMode="decimal" />
          <span className="suffix">{ticker}</span>
        </div>
      </div>

      <div className="preview-box">
        <div className="preview-row">
          <span className="label">Total supply</span>
          <span className="value">{fmtBig(TOTAL_SUPPLY, 18, 0)}</span>
        </div>
        <div className="preview-row">
          <span className="label">Trading fee</span>
          <span className="value">1% buy &amp; sell</span>
        </div>
        <div className="preview-row">
          <span className="label">Graduation</span>
          <span className="value">{fmtBig(target, 18, 0)} {ticker} collected</span>
        </div>
        <div className="preview-row">
          <span className="label">LP at graduation</span>
          <span className="value">🔥 burned (locked forever)</span>
        </div>
        <div className="preview-row">
          <span className="label">Launch fee</span>
          <span className="value">{fmtBig(fee, 18, 4)} ETH</span>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {txHash && <div className="alert info">Tx: {txHash.slice(0, 14)}… — check Blockscout</div>}

      <button className="btn btn-primary btn-block" onClick={handleCreate} disabled={busy}>
        {busy ? (step || "Working…") : account ? "Launch coin" : "Connect wallet to launch"}
      </button>
    </div>
  );
}
