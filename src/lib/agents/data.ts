import "server-only";
import { sqlClient } from "@/lib/db";
import { CAST } from "./cast";

export type AgentView = {
  id: string; name: string; role: string; color: string; bio: string; style: string; address: string;
  u: number; v: number; district: string; thought: string; mode: "paper" | "real";
  cash: number; equity: number; pnlPct: number; trades: number;
  positions: { symbol: string; kind: string; token: string; qty: number; cost: number; value: number; pnlPct: number }[];
};
export type TownEvent = { id: number; agent: string; kind: "thought" | "say" | "move" | "trade"; text: string; to: string | null; district: string; at: string };
export type AgentTrade = { id: number; agent: string; side: "buy" | "sell"; symbol: string; kind: string; token: string; qty: number; price: number; eth: number; reason: string; mode: string; tx: string | null; at: string };
export type Town = { agents: AgentView[]; events: TownEvent[]; trades: AgentTrade[]; ethUsd: number; prices: { symbol: string; kind: string; token: string; price: number; change: number; mcapUsd: number }[] };

export const START_ETH = 0.05;
export const MIN_REAL_ETH = 0.01;

const EMPTY: Town = { agents: CAST.map((a) => ({ id: a.id, name: a.name, role: a.role, color: a.color, bio: a.bio, style: a.style, address: "", u: 0.6, v: 0.55, district: a.home, thought: "", mode: "paper", cash: START_ETH, equity: START_ETH, pnlPct: 0, trades: 0, positions: [] })), events: [], trades: [], ethUsd: 0, prices: [] };

let cache: { at: number; p: Promise<Town> } | null = null;
export function getTown(): Promise<Town> {
  if (cache && Date.now() - cache.at < 2500) return cache.p;
  const p = load().catch((e) => { console.error("town", e); return EMPTY; });
  cache = { at: Date.now(), p };
  return p;
}

async function load(): Promise<Town> {
  if (!process.env.DATABASE_URL) return EMPTY;
  const sql = sqlClient();
  const [rows, pos, prices, events, trades, counts, meta] = await Promise.all([
    sql`select * from la_agents`, sql`select * from la_positions where qty > 1e-12`, sql`select * from la_prices`,
    sql`select * from la_events order by id desc limit 80`, sql`select * from la_trades order by id desc limit 60`,
    sql`select agent_id, count(*)::int as n from la_trades group by agent_id`, sql`select v from la_meta where k = 'eth_usd'`,
  ]);
  const px = new Map(prices.map((p: any) => [p.symbol, p]));
  const n = new Map(counts.map((c: any) => [c.agent_id, c.n]));
  const agents: AgentView[] = CAST.map((a) => {
    const r = rows.find((x: any) => x.id === a.id) ?? {};
    const ps = pos.filter((p: any) => p.agent_id === a.id).map((p: any) => {
      const value = p.qty * (px.get(p.symbol)?.price ?? 0);
      return { symbol: p.symbol, kind: p.kind, token: p.token, qty: p.qty, cost: p.cost, value, pnlPct: p.cost > 0 ? (value / p.cost - 1) * 100 : 0 };
    });
    const equity = (r.cash ?? START_ETH) + ps.reduce((s: number, p: any) => s + p.value, 0);
    return { id: a.id, name: a.name, role: a.role, color: a.color, bio: a.bio, style: a.style, address: r.address ?? "", u: r.u, v: r.v, district: r.district ?? a.home,
      thought: r.thought ?? "", mode: r.mode ?? "paper", cash: r.cash ?? START_ETH, equity, pnlPct: (equity / START_ETH - 1) * 100, trades: n.get(a.id) ?? 0, positions: ps.sort((x: any, y: any) => y.value - x.value) };
  });
  return {
    agents, ethUsd: Number(meta[0]?.v ?? 0),
    prices: prices.map((p: any) => ({ symbol: p.symbol, kind: p.kind, token: p.token, price: p.price, change: p.open ? (p.price / p.open - 1) * 100 : 0, mcapUsd: p.mcap_usd })),
    events: events.map((e: any) => ({ id: Number(e.id), agent: e.agent_id, kind: e.kind, text: e.text, to: e.to_agent, district: e.district, at: new Date(e.at).toISOString() })),
    trades: trades.map((t: any) => ({ id: Number(t.id), agent: t.agent_id, side: t.side, symbol: t.symbol, kind: t.kind, token: t.token, qty: t.qty, price: t.price, eth: t.eth, reason: t.reason, mode: t.mode, tx: t.tx, at: new Date(t.at).toISOString() })),
  };
}
