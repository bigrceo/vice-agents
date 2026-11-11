"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<any>; on?(ev: string, cb: (...a: any[]) => void): void };
export type EvmTx = { to: string; data: string; value: string };
type Ctx = { address: string | null; connecting: boolean; available: boolean; connect(): Promise<string | null>; disconnect(): Promise<void>; send(tx: EvmTx): Promise<string>; wait(hash: string): Promise<boolean> };
const WalletCtx = createContext<Ctx | null>(null);

const CHAIN_ID = 4663;
const CHAIN_HEX = "0x" + CHAIN_ID.toString(16);
const RPC = process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const provider = (): Eip1193 | null => (typeof window === "undefined" ? null : (window as any).ethereum ?? null);

async function ensureChain(p: Eip1193) {
  const id = await p.request({ method: "eth_chainId" });
  if (parseInt(id, 16) === CHAIN_ID) return;
  try { await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] }); }
  catch (e: any) {
    if (e?.code !== 4902 && !/unrecognized|not added/i.test(String(e?.message))) throw e;
    await p.request({ method: "wallet_addEthereumChain", params: [{ chainId: CHAIN_HEX, chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"], blockExplorerUrls: ["https://robinhoodchain.blockscout.com"] }] });
  }
}

/** Injected EVM wallet (MetaMask, Rabby, Coinbase, Phantom EVM…) on Robinhood Chain. */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const p = provider(); setAvailable(Boolean(p));
    p?.request({ method: "eth_accounts" }).then((a: string[]) => setAddress(a?.[0] ?? null)).catch(() => {});
    p?.on?.("accountsChanged", (a: string[]) => setAddress(a?.[0] ?? null));
  }, []);
  const connect = useCallback(async () => {
    const p = provider();
    if (!p) { window.open("https://metamask.io/download", "_blank"); return null; }
    setConnecting(true);
    try { const [a] = await p.request({ method: "eth_requestAccounts" }); await ensureChain(p); setAddress(a); return a as string; }
    catch { return null; } finally { setConnecting(false); }
  }, []);
  const disconnect = useCallback(async () => setAddress(null), []);
  const send = useCallback(async (tx: EvmTx) => {
    const p = provider(); if (!p) throw new Error("No wallet");
    const from = address ?? (await p.request({ method: "eth_requestAccounts" }))[0];
    await ensureChain(p);
    return p.request({ method: "eth_sendTransaction", params: [{ from, to: tx.to, data: tx.data, value: "0x" + BigInt(tx.value).toString(16) }] });
  }, [address]);
  const wait = useCallback(async (hash: string) => {
    for (let i = 0; i < 60; i++) {
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [hash] }) }).then((r) => r.json()).catch(() => null);
      if (r?.result) return r.result.status === "0x1";
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  }, []);
  return <WalletCtx.Provider value={{ address, connecting, available, connect, disconnect, send, wait }}>{children}</WalletCtx.Provider>;
}
export function useWallet() {
  const c = useContext(WalletCtx);
  if (!c) throw new Error("WalletProvider missing");
  return c;
}
export { short } from "@/lib/format";
