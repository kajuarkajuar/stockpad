import { DEFAULT_CHAIN } from "../config/chain";
import { shortAddr } from "../lib/format";

export default function Header({ wallet, onNavigate }) {
  const { account, chainId, installed, connect, switchChain, onRightChain } = wallet;

  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand" onClick={() => onNavigate("#/")}>
          <span className="brand-mark">⬡</span>
          <span className="brand-name">
            Meme<span className="accent">Pad</span>
          </span>
        </div>

        <nav className="nav">
          <button className="nav-link" onClick={() => onNavigate("#/")}>Launch</button>
          <button className="nav-link" onClick={() => onNavigate("#/explore")}>Explore</button>
          <a
            className="nav-link"
            href="https://robinhoodchain.blockscout.com"
            target="_blank"
            rel="noreferrer"
          >
            Explorer ↗
          </a>
        </nav>

        <div className="header-right">
          {!account ? (
            <button className="btn btn-primary" onClick={connect} disabled={!installed}>
              {installed ? "Connect Wallet" : "Install Wallet"}
            </button>
          ) : !onRightChain ? (
            <button className="btn btn-warn" onClick={() => switchChain(DEFAULT_CHAIN)}>
              Switch Network
            </button>
          ) : (
            <div className="account-pill">
              <span className="chain-dot" />
              <span>Robinhood Chain</span>
              <span className="addr">{shortAddr(account)}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
