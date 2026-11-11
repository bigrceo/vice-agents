"use client";
import Link from "next/link";
import type { Coin } from "@/lib/types";
import { ago, pct, usd } from "@/lib/format";

/** Leonida-style drawer: opens next to the rail when a beacon or a rail row is selected. */
export function CoinDrawer({ coin: c, district, onClose }: { coin: Coin; district: string; onClose: () => void }) {
  return (
    <div data-pin-obstacle className="glass absolute z-30 w-[340px] max-h-[calc(100%-170px)] overflow-y-auto p-[18px] md:right-[340px] md:top-6 max-md:inset-x-0 max-md:bottom-0 max-md:w-auto max-md:rounded-b-none max-md:fixed max-md:max-h-[72svh]" role="dialog" aria-label={`$${c.ticker}`}>
      <button type="button" onClick={onClose} className="absolute right-3 top-2.5 text-[26px] leading-none opacity-80 hover:opacity-100" aria-label="Close">×</button>
      <div className="flex items-center gap-3.5">
        <img src={c.still} alt="" className="size-[92px] rounded-2xl border-2 border-pink object-cover" />
        <div>
          <span className="wave">{c.official ? "State token" : district}</span>
          <h3 className="mt-1.5 font-sign text-[30px] font-normal uppercase leading-none">{c.name}</h3>
          <p className="mt-1 text-sun">${c.ticker} <em className="ml-1.5 rounded-md border border-dashed border-[#ffe17a] px-1.5 text-[11px] not-italic text-[#ffe17a]">{c.migrated ? "graduated" : `${c.bondingPct.toFixed(0)}% bonded`}</em></p>
        </div>
      </div>
      {c.description && <p className="mt-3 leading-[1.5] text-haze">{c.description}</p>}
      <dl className="my-3 grid grid-cols-3 gap-2">
        {[["Market cap", usd(c.mcapUsd)], ["Since launch", pct(c.change24h)], ["Bonding", c.migrated ? "Graduated" : `${c.bondingPct.toFixed(0)}%`], ["Chain", "Robinhood"], ["Venue", "Pons"], ["Age", ago(c.createdAt)]].map(([k, v]) => (
          <div key={k} className="rounded-[10px] bg-white/5 p-2"><dt className="text-[10px] uppercase tracking-[1px] text-haze">{k}</dt><dd className={`mt-0.5 text-[14px] font-semibold ${k === "Since launch" ? (c.change24h >= 0 ? "text-up" : "text-down") : ""}`}>{v}</dd></div>
        ))}
      </dl>
      <div className="flex gap-2.5">
        <Link href={`/coin/${c.mint}`} className="btn btn-hot flex-1">Trade ${c.ticker}</Link>
        <a href={`https://pons.fun/token/${c.mint}`} target="_blank" rel="noreferrer" className="btn btn-ghost flex-1">Pons</a>
      </div>
    </div>
  );
}
