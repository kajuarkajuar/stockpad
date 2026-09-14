import { useCallback, useEffect, useState } from "react";
import { DEFAULT_CHAIN } from "../config/chain";

function eth() {
  return typeof window !== "undefined" ? window.ethereum : null;
}

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const e = eth();
    if (e) {
      setInstalled(true);
      e.request({ method: "eth_accounts" }).then((accs) => setAccount(accs[0] ?? null)).catch(() => {});
      e.request({ method: "eth_chainId" }).then((c) => setChainId(Number(c))).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const e = eth();
    if (!e) return;
    const onAccounts = (accs) => setAccount(accs[0] ?? null);
    const onChain = (cid) => setChainId(Number(cid));
    e.on("accountsChanged", onAccounts);
    e.on("chainChanged", onChain);
    return () => {
      e.removeListener("accountsChanged", onAccounts);
      e.removeListener("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const e = eth();
    if (!e) {
      setError("No wallet found. Install MetaMask, Rabby, or the Robinhood Wallet.");
      return;
    }
    setError(null);
    try {
      const accounts = await e.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0] ?? null);
      const cid = await e.request({ method: "eth_chainId" });
      setChainId(Number(cid));
    } catch (err) {
      setError(err?.message || "Connect failed");
    }
  }, []);

  const switchChain = useCallback(async (chain = DEFAULT_CHAIN) => {
    const e = eth();
    if (!e) return;
    setError(null);
    const hex = "0x" + chain.id.toString(16);
    try {
      await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (err) {
      if (err?.code === 4902 || err?.data?.originalError?.code === 4902) {
        try {
          await e.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hex,
                chainName: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: chain.rpcUrls.default.http,
                blockExplorerUrls: [chain.blockExplorers.default.url],
              },
            ],
          });
        } catch (err2) {
          setError("Could not add Robinhood Chain: " + (err2?.message || ""));
          return;
        }
      } else {
        setError("Switch network failed: " + (err?.message || ""));
        return;
      }
    }
    setChainId(chain.id);
  }, []);

  return { account, chainId, installed, error, connect, switchChain, onRightChain: chainId === DEFAULT_CHAIN.id };
}
