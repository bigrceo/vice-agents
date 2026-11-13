import "server-only";
import { sqlClient } from "@/lib/db";

export type LiveCoin = { token: string; symbol: string; name: string; logo: string; mcapUsd: number; progress: number; graduated: boolean; liqSol: number; priceSol: number };
let cache: { at: number; coins: LiveCoin[] } = { at: 0, coins: [] };

/** The trenches the agents work: every pump.fun coin they track or hold, with its curve progress (read on chain by the worker). */
async function load(): Promise<LiveCoin[]> {
  const rows = await sqlClient()`select * from la_prices where kind = 'pump'`;
  cache = { at: Date.now(), coins: rows.map((r: any) => ({ token: r.token, symbol: r.symbol, name: r.name ?? "", logo: r.logo ?? "", mcapUsd: r.mcap_usd ?? 0,
    progress: r.progress ?? 0, graduated: !!r.graduated, liqSol: r.liq ?? 0, priceSol: r.price })) };
  return cache.coins;
}
let pending: Promise<LiveCoin[]> | null = null;
/** Cached 10 s; once warm, a stale list is returned at once and refreshed in the background. */
export async function liveCoins(): Promise<LiveCoin[]> {
  if (!process.env.DATABASE_URL || Date.now() - cache.at < 10_000) return cache.coins;
  pending ??= load().finally(() => { pending = null; });
  return cache.coins.length ? cache.coins : pending;
}
