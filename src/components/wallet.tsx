"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { VersionedTransaction } from "@solana/web3.js";

/** A Solana wallet injected in the page: Phantom (window.phantom.solana) or Solflare (window.solflare). Both speak the same API. */
type SolProvider = {
  publicKey?: { toBase58(): string } | null; isConnected?: boolean;
  connect(o?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toBase58(): string } } | void>;
  disconnect(): Promise<void>;
  signAndSendTransaction(tx: VersionedTransaction): Promise<{ signature: string } | string>;
  on?(ev: string, cb: (...a: any[]) => void): void;
};
export type WalletName = "phantom" | "solflare";
/** A transaction from the server: base64 unsigned versioned tx, plus what the user is signing. */
export type SolTx = { label: string; tx: string };
type Ctx = { address: string | null; connecting: boolean; available: boolean; wallets: WalletName[]; connect(w?: WalletName): Promise<string | null>; disconnect(): Promise<void>; send(tx: SolTx): Promise<string>; wait(sig: string): Promise<boolean> };
const WalletCtx = createContext<Ctx | null>(null);

const KEY = "va-sol-wallet";
function provider(name: WalletName | null): SolProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const p = { phantom: w.phantom?.solana?.isPhantom ? w.phantom.solana : null, solflare: w.solflare?.isSolflare ? w.solflare : null };
  return name ? p[name] : p.phantom ?? p.solflare;
}
const installed = (): WalletName[] => (["phantom", "solflare"] as const).filter((n) => provider(n));
const pk = (p: SolProvider, r?: any) => (r?.publicKey ?? p.publicKey)?.toBase58?.() ?? null;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [name, setName] = useState<WalletName | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [wallets, setWallets] = useState<WalletName[]>([]);
  useEffect(() => {
    // wallets inject a moment after load
    const look = () => setWallets(installed());
    look(); const t = setTimeout(look, 600);
    let last: WalletName | null = null; try { last = localStorage.getItem(KEY) as WalletName | null; } catch {}
    const p = last && provider(last);
    if (p) p.connect({ onlyIfTrusted: true }).then((r) => { setName(last); setAddress(pk(p, r)); }).catch(() => {});
    return () => clearTimeout(t);
  }, []);
  const connect = useCallback(async (want?: WalletName) => {
    const n = want ?? installed()[0];
    const p = n && provider(n);
    if (!p) { window.open("https://phantom.com/download", "_blank"); return null; }
    setConnecting(true);
    try {
      const r = await p.connect(); const a = pk(p, r);
      setName(n); setAddress(a); try { localStorage.setItem(KEY, n); } catch {}
      p.on?.("accountChanged", (k: any) => setAddress(k?.toBase58?.() ?? null));
      return a;
    } catch { return null; } finally { setConnecting(false); }
  }, []);
  const disconnect = useCallback(async () => { await provider(name)?.disconnect().catch(() => {}); setAddress(null); try { localStorage.removeItem(KEY); } catch {} }, [name]);
  const send = useCallback(async (t: SolTx) => {
    const p = provider(name); if (!p) throw new Error("No Solana wallet");
    const tx = VersionedTransaction.deserialize(Uint8Array.from(atob(t.tx), (c) => c.charCodeAt(0)));
    const r = await p.signAndSendTransaction(tx);
    return typeof r === "string" ? r : r.signature;
  }, [name]);
  const wait = useCallback(async (sig: string) => {
    for (let i = 0; i < 60; i++) {
      const r = await fetch(`/api/tx?sig=${encodeURIComponent(sig)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (r?.done) return !!r.ok;
      await new Promise((s) => setTimeout(s, 1500));
    }
    return false;
  }, []);
  return <WalletCtx.Provider value={{ address, connecting, available: wallets.length > 0, wallets, connect, disconnect, send, wait }}>{children}</WalletCtx.Provider>;
}
export function useWallet() {
  const c = useContext(WalletCtx);
  if (!c) throw new Error("WalletProvider missing");
  return c;
}
export { short } from "@/lib/format";
