import Link from "next/link";
import type { Coin } from "@/lib/types";
import { pct, usd } from "@/lib/format";

export function Ticker({ coins }: { coins: Coin[] }) {
  const row = [...coins, ...coins];
  return (
    <div className="edge-fade overflow-hidden border-y border-line bg-deck">
      <div className="marquee flex w-max gap-6 py-2">
        {row.map((c, i) => (
          <Link key={i} tabIndex={i >= coins.length ? -1 : undefined} aria-hidden={i >= coins.length || undefined} href={`/coin/${c.mint}`} className="flex items-center gap-2 whitespace-nowrap text-sm transition-colors hover:text-sun">
            <img src={c.still} alt="" className="h-6 w-6 object-cover" loading="lazy" />
            <span className="font-bold">${c.ticker}</span>
            <span className={c.change24h >= 0 ? "text-up" : "text-down"}>{pct(c.change24h)}</span>
            <span className="text-haze">{usd(c.mcapUsd)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
