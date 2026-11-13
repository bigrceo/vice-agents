"use client";
import { AssetLogo } from "./AssetLogo";
import { EXPLORER } from "@/lib/brand";
import { useTown, portrait, eth, signed, ago } from "./town";

/** Leonida-style drawer: opens next to the rail when an agent's pin or a rail row is selected. */
export function AgentDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { agents, trades } = useTown();
  const a = agents.find((x) => x.id === id); if (!a) return null;
  const mine = trades.filter((t) => t.agent === id).slice(0, 4);
  return (
    <div data-pin-obstacle className="glass absolute z-30 w-[340px] max-h-[calc(100%-170px)] overflow-y-auto p-[18px] md:right-[340px] md:top-[96px] max-md:inset-x-0 max-md:bottom-0 max-md:w-auto max-md:rounded-b-none max-md:fixed max-md:max-h-[72svh]" role="dialog" aria-label={a.name}>
      <button type="button" onClick={onClose} className="absolute right-3 top-2.5 text-[26px] leading-none opacity-80 hover:opacity-100" aria-label="Close">×</button>
      <div className="relative -mx-[18px] -mt-[18px] mb-1 h-[230px] overflow-hidden rounded-t-[inherit]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={a.id} src={portrait(a.id)} alt={a.name} className="agent-hero size-full object-cover object-[50%_22%]" />
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(16,8,36,.96))" }} />
        <div className="absolute inset-x-[18px] bottom-3">
          <span className="wave">{a.district}</span>
          <h3 className="mt-1.5 font-sign text-[30px] font-normal uppercase leading-none" style={{ textShadow: `0 0 18px ${a.color}` }}>{a.name}</h3>
          <p className="mt-1" style={{ color: a.color }}>{a.role}</p>
        </div>
      </div>
      <p className="mt-3 leading-[1.5] text-haze">{a.bio}</p>
      {a.thought && <p className="mt-2 italic leading-[1.5]">“{a.thought}”</p>}
      <dl className="my-3 grid grid-cols-3 gap-2">
        {[["Worth", eth(a.equity)], ["PnL", signed(a.pnlPct)], ["Cash", eth(a.cash)], ["Trades", String(a.trades)], ["Style", a.style], ["Mode", a.mode === "real" ? "Real" : "Paper"]].map(([k, v]) => (
          <div key={k} className="rounded-[10px] bg-white/5 p-2"><dt className="text-[10px] uppercase tracking-[1px] text-haze">{k}</dt><dd className={`mt-0.5 text-[14px] font-semibold ${k === "PnL" ? (a.pnlPct >= 0 ? "text-up" : "text-down") : ""}`}>{v}</dd></div>
        ))}
      </dl>
      {a.positions.length > 0 && <div className="mb-3"><p className="label mb-1.5">Holding</p>
        <ul className="space-y-1 text-[13px]">{a.positions.map((p) => <li key={p.symbol} className="flex justify-between"><span><AssetLogo a={p} size={20} className="asset-logo-sm" /><b>${p.symbol}</b> <span className="text-haze">{p.kind === "pump" ? "pump.fun" : "xStock"}</span></span><span>{eth(p.value)} <span className={p.pnlPct >= 0 ? "text-up" : "text-down"}>{signed(p.pnlPct)}</span></span></li>)}</ul></div>}
      {mine.length > 0 && <div className="mb-3"><p className="label mb-1.5">Last trades</p>
        <ul className="space-y-2 text-[13px]">{mine.map((t) => <li key={t.id}><b className={t.side === "buy" ? "text-up" : "text-down"}>{t.side === "buy" ? "Bought" : "Sold"} <AssetLogo a={t} size={18} className="asset-logo-sm" />${t.symbol}</b> <span className="text-haze">{eth(t.eth)} · {ago(t.at)}</span><span className="block text-haze">{t.reason}</span></li>)}</ul></div>}
      {a.address && <a href={`${EXPLORER}/address/${a.address}`} target="_blank" rel="noreferrer" className="btn btn-ghost w-full">Wallet {a.address.slice(0, 6)}…{a.address.slice(-4)}</a>}
    </div>
  );
}
