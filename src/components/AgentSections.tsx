"use client";
import { EXPLORER, ponsUrl, explorerToken } from "@/lib/brand";
import { useTown, avatar, first, eth, signed, ago } from "./town";

/** Real asset prices the agents watch, scrolling like the old coin ticker. */
export function PriceTicker() {
  const { prices } = useTown();
  if (!prices.length) return null;
  const row = [...prices, ...prices];
  return (
    <div className="edge-fade overflow-hidden border-y border-line bg-deck">
      <div className="marquee flex w-max gap-6 py-2">
        {row.map((p, i) => (
          <a key={i} href={p.kind === "pons" ? ponsUrl(p.token) : explorerToken(p.token)} target="_blank" rel="noreferrer" tabIndex={i >= prices.length ? -1 : undefined}
            className="flex items-center gap-2 whitespace-nowrap text-sm transition-colors hover:text-sun">
            <span className="font-bold">${p.symbol}</span>
            <span className="text-haze">{p.kind === "pons" ? "Pons" : "stock"}</span>
            <span className={p.change >= 0 ? "text-up" : "text-down"}>{signed(p.change)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** Horizontal strip of the latest agent trades. */
export function TradeStrip() {
  const { trades, agents } = useTown();
  const name = (id: string) => first(agents.find((a) => a.id === id)?.name ?? id);
  return (
    <ul className="flex gap-3 overflow-x-auto py-1 [scrollbar-width:none]">
      {trades.length === 0 && <li className="py-2 text-sm text-haze">No trades yet. They show up here live.</li>}
      {trades.slice(0, 24).map((t) => (
        <li key={t.id} className="flex shrink-0 items-center gap-2 rounded-xl border border-line bg-deck px-2.5 py-1.5 text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar(t.agent)} alt="" className="h-6 w-6 rounded-md" />
          <span className="font-bold">{name(t.agent)}</span>
          <span className="text-haze">{t.side === "buy" ? "bought" : "sold"}</span>
          <span className="font-bold">${t.symbol}</span>
          <span className={t.side === "buy" ? "text-up" : "text-down"}>{eth(t.eth)}</span>
          <span className="text-haze/70" suppressHydrationWarning>{ago(t.at)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Leaderboard: every agent, ranked by what their book is worth. */
export function Leaderboard() {
  const { agents } = useTown();
  const ranked = [...agents].sort((a, b) => b.equity - a.equity);
  return (
    <ol className="m-0 grid list-none gap-3.5 p-0 md:grid-cols-2 xl:grid-cols-5">
      {ranked.map((a, i) => (
        <li key={a.id} className="glass flex flex-col p-4">
          <div className="flex items-center gap-3">
            <b className="num-badge">{i + 1}</b>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar(a.id)} alt="" className="size-12 rounded-xl" />
            <div className="min-w-0"><h3 className="truncate text-[16px] font-bold" style={{ color: a.color }}>{a.name}</h3><p className="text-[13px] text-haze">{a.role} · {a.district}</p></div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-[20px] font-bold">{eth(a.equity)}</span>
            <span className={a.pnlPct >= 0 ? "text-up" : "text-down"}>{signed(a.pnlPct)}</span>
          </div>
          <p className="mt-1 text-[12px] text-haze">{a.trades} trades · {a.positions.length ? a.positions.slice(0, 3).map((p) => `$${p.symbol}`).join(" ") : "all cash"}</p>
          {a.thought && <p className="mt-2 line-clamp-3 text-[13px] italic leading-[1.45] text-haze">“{a.thought}”</p>}
          {a.address && <a className="mt-auto pt-2 text-[12px] text-haze hover:text-sun" href={`${EXPLORER}/address/${a.address}`} target="_blank" rel="noreferrer">{a.address.slice(0, 6)}…{a.address.slice(-4)} ↗</a>}
        </li>
      ))}
    </ol>
  );
}

/** Every trade with the reason the agent gave. */
export function TradeLog() {
  const { trades, agents } = useTown();
  const ag = (id: string) => agents.find((a) => a.id === id);
  return (
    <ul className="glass m-0 list-none divide-y divide-white/10 p-0">
      {trades.slice(0, 30).map((t) => (
        <li key={t.id} className="flex gap-3 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar(t.agent)} alt="" className="size-10 flex-none rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px]"><b style={{ color: ag(t.agent)?.color }}>{ag(t.agent)?.name}</b>{" "}
              <span className={t.side === "buy" ? "text-up" : "text-down"}>{t.side === "buy" ? "bought" : "sold"}</span>{" "}
              <a className="font-bold hover:text-sun" href={t.kind === "pons" ? ponsUrl(t.token) : explorerToken(t.token)} target="_blank" rel="noreferrer">${t.symbol}</a>{" "}
              <span className="text-haze" suppressHydrationWarning>{eth(t.eth)} at {t.price.toPrecision(4)} ETH · {t.mode === "real" && t.tx ? <a className="text-up" href={`${EXPLORER}/tx/${t.tx}`} target="_blank" rel="noreferrer">on chain ↗</a> : "paper"} · {ago(t.at)}</span></p>
            <p className="mt-0.5 text-[14px] leading-[1.45] text-haze">{t.reason}</p>
          </div>
        </li>
      ))}
      {trades.length === 0 && <li className="p-4 text-haze">No trades yet.</li>}
    </ul>
  );
}
