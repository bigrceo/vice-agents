"use client";
import type { Trade } from "@/lib/types";
import { usd } from "@/lib/format";

/** Market-cap line from trades (oldest → newest). */
export function Chart({ trades }: { trades: Trade[] }) {
  const pts = [...trades].reverse().map((t) => t.mcapUsd).filter((n) => n > 0);
  if (pts.length < 2) return <div className="flex h-56 items-center justify-center text-haze">No trades yet</div>;
  const min = Math.min(...pts), max = Math.max(...pts), W = 600, H = 220;
  const xy = pts.map((p, i) => [(i / (pts.length - 1)) * W, H - ((p - min) / (max - min || 1)) * (H - 20) - 10]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const up = pts[pts.length - 1] >= pts[0];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" preserveAspectRatio="none">
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={up ? "var(--color-up)" : "var(--color-down)"} stopOpacity=".3" /><stop offset="1" stopColor="transparent" /></linearGradient></defs>
        <path d={`${d}L${W},${H}L0,${H}Z`} fill="url(#g)" />
        <path d={d} fill="none" stroke={up ? "var(--color-up)" : "var(--color-down)"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="label absolute right-2 top-1">{usd(max)}</span><span className="label absolute bottom-1 right-2">{usd(min)}</span>
    </div>
  );
}
