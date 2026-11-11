export const usd = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;
export const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n) >= 100 ? Math.abs(n).toFixed(0) : Math.abs(n).toFixed(1)}%`;
export function ago(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - +new Date(iso)) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
}
export const short = (a: string, n = 4) => `${a.slice(0, n)}…${a.slice(-n)}`;
