"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Trade } from "@/lib/types";
import { ago } from "@/lib/format";

export function LiveTrades({ initial, mint }: { initial: Trade[]; mint?: string }) {
  const [trades, setTrades] = useState(initial);
  const [, tick] = useState(0);
  const seen = useRef(new Set(initial.map((t) => t.sig)));
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const t = setInterval(async () => {
      tick((n) => n + 1);
      if (document.hidden) return;
      const r = await fetch(`/api/trades${mint ? `?mint=${mint}` : ""}`).then((r) => r.json()).catch(() => null);
      if (r?.trades) {
        const f = new Set<string>((r.trades as Trade[]).filter((t) => !seen.current.has(t.sig)).map((t) => t.sig));
        (r.trades as Trade[]).forEach((t) => seen.current.add(t.sig));
        setFresh(f); setTrades(r.trades);
      }
    }, 6000);
    return () => clearInterval(t);
  }, [mint]);
  return (
    <div className="overflow-hidden">
      {trades.length === 0 && <p className="py-2 text-sm text-haze">No trades yet. They show up here live.</p>}
      <ul className="flex gap-3 overflow-x-auto py-1 [scrollbar-width:none]">
        {trades.slice(0, 24).map((t) => (
          <li key={t.sig} className="shrink-0">
            <Link href={`/coin/${t.mint}`} className={`flex items-center gap-2 rounded-xl border border-line bg-deck px-2.5 py-1.5 text-sm transition-colors hover:border-coral ${fresh.has(t.sig) ? (t.side === "buy" ? "flash-buy" : "flash-sell") : ""}`}>
              <img src={`/api/coins/${t.mint}/still`} alt="" className="dither h-6 w-6 rounded-md object-cover" loading="lazy" />
              <span className="font-bold">${t.ticker}</span>
              <span className="text-haze">{t.side === "buy" ? "bought" : "sold"}</span>
              <span className={t.side === "buy" ? "text-up" : "text-down"}>{t.side === "buy" ? "+" : "−"}{t.eth.toFixed(4)} ETH</span>
              <span className="text-haze/70">{ago(t.at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
