import { getTown } from "@/lib/agents/data";
import { sqlClient } from "@/lib/db";
export const dynamic = "force-dynamic";

export type LiveCoin = { token: string; symbol: string; name: string; logo: string; mcapUsd: number; progress: number; graduated: boolean; liqSol: number; priceSol: number };
let cache: { at: number; coins: LiveCoin[] } = { at: 0, coins: [] };

/** The trenches the agents work: every pump.fun coin they track or hold, with its curve progress (read on chain by the worker). */
async function coins(): Promise<LiveCoin[]> {
  if (Date.now() - cache.at < 10_000 || !process.env.DATABASE_URL) return cache.coins;
  const rows = await sqlClient()`select * from la_prices where kind = 'pump'`;
  cache = { at: Date.now(), coins: rows.map((r: any) => ({ token: r.token, symbol: r.symbol, name: r.name ?? "", logo: r.logo ?? "", mcapUsd: r.mcap_usd ?? 0,
    progress: r.progress ?? 0, graduated: !!r.graduated, liqSol: r.liq ?? 0, priceSol: r.price })) };
  return cache.coins;
}

export async function GET() {
  const [town, list] = await Promise.all([getTown(), coins().catch(() => [])]);
  return Response.json({ ...town, coins: list }, { headers: { "cache-control": "public, s-maxage=3, stale-while-revalidate=10" } });
}
