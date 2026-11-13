"use client";
/** Watch live: the trenches in three columns (fresh launches, final stretch, migrated) plus the stocks desk, lit up by the
 *  trades of the agent you put the camera on. Every trade can be copied into your own wallet. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentTrade, Town } from "@/lib/agents/data";
import { CAST } from "@/lib/agents/cast";
import { avatar, portrait, first, ago } from "./town";
import { useWallet } from "./wallet";
import { AssetLogo } from "./AssetLogo";

type LiveCoin = { token: string; symbol: string; name: string; logo: string; mcapUsd: number; progress: number; graduated: boolean; liqSol: number; priceSol: number };
type Live = Town & { coins: LiveCoin[] };
const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`);
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;
const FRESH = (c: LiveCoin) => !c.graduated && c.progress < 25, STRETCH = (c: LiveCoin) => !c.graduated && c.progress >= 25;

export function LiveBoard({ initial, agent = "dez" }: { initial: Live; agent?: string }) {
  const [live, setLive] = useState(initial);
  const [cam, setCam] = useState<string | null>(agent);   // land on one agent, so the Follow button is the first thing you see
  useEffect(() => {
    const pull = async () => { if (document.hidden) return; const r = await fetch("/api/live", { cache: "no-store" }).then((r) => r.json()).catch(() => null); if (r?.agents) setLive(r); };
    void pull(); const t = setInterval(pull, 4000);
    return () => clearInterval(t);
  }, []);
  const trades = useMemo(() => live.trades.filter((t) => !cam || t.agent === cam), [live.trades, cam]);
  const lastBy = useMemo(() => { const m = new Map<string, AgentTrade>(); for (const t of trades) if (!m.has(t.token.toLowerCase())) m.set(t.token.toLowerCase(), t); return m; }, [trades]);
  const holders = (token: string) => live.agents.filter((a) => a.positions.some((p) => p.token.toLowerCase() === token.toLowerCase()));
  const best = [...live.agents].sort((a, b) => b.pnlPct - a.pnlPct)[0];
  const sel = cam ? live.agents.find((a) => a.id === cam) : null;
  const touched = new Set(trades.map((t) => t.token.toLowerCase()));
  const order = (l: LiveCoin[]) => [...l].sort((a, b) => Number(touched.has(b.token)) - Number(touched.has(a.token)) || b.mcapUsd - a.mcapUsd);
  const stocks = useMemo(() => { const seen = new Map<string, AgentTrade>(); for (const t of trades) if (t.kind === "stock" && !seen.has(t.symbol)) seen.set(t.symbol, t); return [...seen.values()]; }, [trades]);
  const px = (sym: string) => live.prices.find((p) => p.symbol === sym);

  return (
    <div className="live-page mx-auto max-w-[1500px] px-4 pb-20 pt-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat k="Trades on the tape" v={String(live.agents.reduce((s, a) => s + a.trades, 0))} s="every one with a reason" />
        <Stat k="Best local" v={best ? pct(best.pnlPct) : "—"} s={best ? `${first(best.name)} · ${best.role}` : ""} hot />
        <Stat k="Coins in the trenches" v={String(live.coins.length)} s={`${live.coins.filter(STRETCH).length} in the final stretch · ${live.coins.filter((c) => c.graduated).length} migrated`} />
        <Stat k="Wallets" v={live.agents.some((a) => a.mode === "real") ? "Real" : "Paper"} s={live.agents.some((a) => a.mode === "real") ? "trading from their own Solana wallets" : "real once the creator fees fund them"} />
      </div>

      <div className="live-cams mt-6" role="tablist" aria-label="Camera on">
        <button role="tab" aria-selected={!cam} onClick={() => setCam(null)} className={`cam ${!cam ? "is-on" : ""}`}><span className="cam-all">ALL</span><b>Whole city</b></button>
        {CAST.map((c) => { const a = live.agents.find((x) => x.id === c.id); return (
          <button key={c.id} role="tab" aria-selected={cam === c.id} onClick={() => setCam(c.id)} className={`cam ${cam === c.id ? "is-on" : ""}`} style={{ "--ring": c.color } as React.CSSProperties}>
            <img src={avatar(c.id)} alt="" /><b>{first(c.name)}</b><i className={(a?.pnlPct ?? 0) >= 0 ? "text-up" : "text-down"}>{pct(a?.pnlPct ?? 0)}</i>
          </button>); })}
      </div>

      <section className="live-stage mt-4">
        <div className="live-stage-head">
          <div className="flex items-end gap-4">
            {sel && <img className="live-face" src={portrait(sel.id)} alt="" style={{ "--ring": sel.color } as React.CSSProperties} />}
            <div>
            <p className="script !text-[26px]">{sel ? "Camera on" : "Live from"}</p>
            <h1 className="live-title">{sel ? first(sel.name) : "Leonida"}</h1>
            <p className="text-sm text-haze">{sel ? sel.bio : ""}</p>
            <p className="label mt-1">{sel ? `${sel.role} · ${sel.style} · ${sel.trades} trades · ${sel.positions.length} bags held · in ${sel.district}` : "Ten agents, one tape. Pick a local to follow their trades."}</p>
            </div>
          </div>
          {sel && <Follow agent={sel.id} />}
        </div>
        <div className="live-cols">
          <Col title="Fresh launches" sub="on the curve" coins={order(live.coins.filter(FRESH))} lastBy={lastBy} holders={holders} />
          <Col title="Final stretch" sub="25%+ of the curve" coins={order(live.coins.filter(STRETCH))} lastBy={lastBy} holders={holders} />
          <Col title="Migrated" sub="trading in the pool" coins={order(live.coins.filter((c) => c.graduated))} lastBy={lastBy} holders={holders} />
          <div className="live-col">
            <h2 className="live-col-title">Stock desk <span>tokenized stocks</span></h2>
            <div className="live-col-body">
              {stocks.length === 0 && <p className="live-empty">No stock trades{sel ? ` from ${first(sel.name)}` : ""} yet.</p>}
              {stocks.map((t) => { const p = px(t.symbol); return (
                <article key={t.symbol} className={`coin-card is-${t.side}`}>
                  <AssetLogo a={t} />
                  <div className="min-w-0 flex-1"><b>${t.symbol}</b><small>{p ? `${pct(p.change)} since tracked` : "stock token"}</small></div>
                  <Tag t={t} />
                </article>); })}
            </div>
          </div>
        </div>
      </section>

      <Tape trades={trades.slice(0, 30)} camName={sel ? first(sel.name) : null} />
    </div>
  );
}

function Stat({ k, v, s, hot }: { k: string; v: string; s: string; hot?: boolean }) {
  return <div className="live-stat"><span className="label">{k}</span><b className={hot ? "text-up" : ""}>{v}</b><small>{s}</small></div>;
}

function Tag({ t }: { t: AgentTrade }) {
  return <span className={`coin-tag is-${t.side}`} title={t.reason}><img src={avatar(t.agent)} alt="" />{t.side === "buy" ? "BUY" : "SELL"} · {ago(t.at)}</span>;
}


function Col({ title, sub, coins, lastBy, holders }: { title: string; sub: string; coins: LiveCoin[]; lastBy: Map<string, AgentTrade>; holders: (t: string) => { id: string }[] }) {
  return (
    <div className="live-col">
      <h2 className="live-col-title">{title} <span>{sub}</span></h2>
      <div className="live-col-body">
        {coins.length === 0 && <p className="live-empty">Nothing here right now.</p>}
        {coins.map((c) => { const t = lastBy.get(c.token); const h = holders(c.token); return (
          <a key={c.token} href={`https://pump.fun/coin/${c.token}`} target="_blank" rel="noreferrer" className={`coin-card ${t ? `is-${t.side}` : "is-idle"}`}>
            <AssetLogo a={{ symbol: c.symbol, kind: "pump", token: c.token, logo: c.logo }} />
            <div className="min-w-0 flex-1">
              <b>${c.symbol}</b><small className="truncate">{c.name}</small>
              <div className="coin-meta"><span>MC {usd(c.mcapUsd)}</span>{!c.graduated && <span className="coin-bar"><i style={{ width: `${Math.min(100, c.progress)}%` }} /></span>}{!c.graduated && <span>{c.progress.toFixed(0)}%</span>}</div>
            </div>
            <div className="coin-side">
              {t ? <Tag t={t} /> : null}
              {h.length > 0 && <span className="coin-holders">{h.slice(0, 4).map((a) => <img key={a.id} src={avatar(a.id)} alt="" />)}</span>}
            </div>
          </a>); })}
      </div>
    </div>
  );
}

// ---- copy-trade: mirrored in your own wallet, you sign every trade ----
const KEY = "va-follow";
type Follow = { agent: string; sol: number; auto: boolean };
const readFollow = (): Follow | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; } };
const writeFollow = (f: Follow | null) => { try { f ? localStorage.setItem(KEY, JSON.stringify(f)) : localStorage.removeItem(KEY); } catch {} };

function Follow({ agent }: { agent: string }) {
  const [f, setF] = useState<Follow | null>(null);
  const w = useWallet();
  const [sol, setSol] = useState("0.05");
  useEffect(() => { const x = readFollow(); setF(x); if (x?.sol) setSol(String(x.sol)); }, []);
  const on = f?.agent === agent;
  const set = (x: Follow | null) => { writeFollow(x); setF(x); dispatchEvent(new Event("va-follow")); };
  return (
    <div className="follow">
      <span className="label">Copy-trade</span>
      <div className="flex items-center gap-2">
        <input className="field !h-10 w-24" inputMode="decimal" value={sol} onChange={(e) => setSol(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="SOL per buy" />
        <span className="text-sm text-haze">SOL per buy</span>
      </div>
      <button className={`btn ${on ? "btn-ghost" : "btn-hot"}`} onClick={() => set(on ? null : { agent, sol: Number(sol) || 0.05, auto: true })}>{on ? `Following ${first(CAST.find((c) => c.id === agent)!.name)} · stop` : `Follow ${first(CAST.find((c) => c.id === agent)!.name)}`}</button>
      {!w.address && w.wallets.length > 1 && <div className="flex gap-2">{w.wallets.map((n) => <button key={n} className="btn btn-ghost !h-9" onClick={() => w.connect(n)}>{n === "phantom" ? "Phantom" : "Solflare"}</button>)}</div>}
      {w.address && <small className="text-haze">Wallet {w.address.slice(0, 4)}…{w.address.slice(-4)} · <button className="underline" onClick={() => w.disconnect()}>disconnect</button></small>}
      <small className="text-haze">Phantom or Solflare. Each new trade opens in your wallet to sign. Sells mirror the share of the bag the agent sold.</small>
    </div>
  );
}

function Tape({ trades, camName }: { trades: AgentTrade[]; camName: string | null }) {
  const w = useWallet();
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<Record<number, string>>({});
  const seen = useRef<Set<number> | null>(null);
  async function copy(t: AgentTrade) {
    const f = readFollow();
    const a = w.address ?? (await w.connect()); if (!a) return;
    setBusy(t.id); setMsg((m) => ({ ...m, [t.id]: "Building…" }));
    try {
      const q = await fetch("/api/copy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trade: t.id, wallet: a, sol: f?.sol ?? 0.05 }) }).then((r) => r.json());
      if (q.error) throw new Error(q.error);
      for (const tx of q.txs) { setMsg((m) => ({ ...m, [t.id]: `Sign: ${tx.label}` })); const h = await w.send(tx); if (!(await w.wait(h))) throw new Error("Failed on chain"); }
      setMsg((m) => ({ ...m, [t.id]: "Copied ✓" }));
    } catch (e) { setMsg((m) => ({ ...m, [t.id]: e instanceof Error ? e.message.split("\n")[0].slice(0, 90) : "Failed" })); }
    finally { setBusy(null); }
  }
  // following: a new trade from that agent pops the wallet by itself
  useEffect(() => {
    if (!seen.current) { seen.current = new Set(trades.map((t) => t.id)); return; }
    const f = readFollow();
    for (const t of trades) if (!seen.current.has(t.id)) { seen.current.add(t.id); if (f?.auto && f.agent === t.agent && w.address) void copy(t); }
  }, [trades]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="mt-8">
      <h2 className="font-sign text-[34px] uppercase leading-none">The tape <span className="script !text-[22px] align-middle">{camName ?? "everyone"}</span></h2>
      <div className="mt-3 grid gap-2">
        {trades.length === 0 && <p className="live-empty">No trades yet.</p>}
        {trades.map((t) => (
          <div key={t.id} className={`tape-row is-${t.side}`}>
            <img src={avatar(t.agent)} alt="" />
            <div className="min-w-0 flex-1">
              <p><b>{first(CAST.find((c) => c.id === t.agent)?.name ?? t.agent)}</b> <span className={t.side === "buy" ? "text-up" : "text-down"}>{t.side === "buy" ? "bought" : "sold"}</span> {t.eth.toFixed(3)} SOL of <AssetLogo a={t} size={20} className="asset-logo-sm" /><b>${t.symbol}</b> <span className="text-haze">· {ago(t.at)} · {t.mode}</span></p>
              <p className="text-sm text-haze">{t.reason}</p>
            </div>
            <button className="btn btn-ghost !h-9 shrink-0" disabled={busy === t.id} onClick={() => copy(t)}>{msg[t.id] ?? "Copy"}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
