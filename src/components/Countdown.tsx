"use client";
import { useEffect, useState } from "react";

const pad = (n: number) => String(Math.max(0, n)).padStart(2, "0");

export function Countdown({ to, compact = false }: { to: string; compact?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, new Date(to).getTime() - (now ?? new Date(to).getTime()));
  const d = Math.floor(left / 86_400_000), h = Math.floor(left / 3_600_000) % 24, m = Math.floor(left / 60_000) % 60, s = Math.floor(left / 1000) % 60;
  const parts: [string, string][] = [[pad(d), "d"], [pad(h), "h"], [pad(m), "m"], [pad(s), "s"]];
  return (
    <div className={`cd flex gap-2 ${compact ? "cd-compact" : ""}`} aria-live="off">
      {parts.map(([v, l]) => <span key={l}><b style={compact ? { fontSize: 18 } : undefined}>{now ? v : "--"}</b><i>{l}</i></span>)}
    </div>
  );
}
