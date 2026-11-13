import "server-only";
/**
 * Weekly Take-Two reward. Anyone picks one of the ten agents with a wallet address (no signature, no purchase).
 * The agent with the best P&L over the week (Monday 00:00 UTC to the next) wins; its pickers share the TTWO the
 * reward wallet holds (bought with creator fees), sent on chain by the worker. Holders of the official coin count double.
 * Scores are equity snapshots taken at each week boundary, so a week's result never changes once it is over.
 */
import { PublicKey } from "@solana/web3.js";
import { sqlClient } from "@/lib/db";
import { CAST } from "@/lib/agents/cast";
import { getTown } from "@/lib/agents/data";
import { connection, isAddress } from "@/lib/sol/solana";

/** Take-Two Interactive as a Solana token (Backpack Securities, Token-2022, 6 decimals). */
export const TTWO = "TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo";
export const REWARD_WALLET = process.env.REWARD_WALLET || "";
const JUP = process.env.JUPITER_API_URL || "https://lite-api.jup.ag";
const DAY = 86_400_000;

export const weekStart = (t = Date.now()) => { const d = new Date(t); const day = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY; };
export const weekId = (t = Date.now()) => new Date(weekStart(t)).toISOString().slice(0, 10);

let ready = false;
async function init() {
  if (ready) return; const sql = sqlClient();
  await sql`create table if not exists la_picks (week text, address text, agent text, at timestamptz default now(), primary key (week, address))`;
  await sql`create table if not exists la_rewards (week text primary key, winner text, pot double precision, pickers int, per double precision, status text, txs jsonb, at timestamptz default now())`;
  ready = true;
}

async function equities() {
  const town = await getTown();
  return Object.fromEntries(town.agents.filter((a) => CAST.some((c) => c.id === a.id)).map((a) => [a.id, a.equity]));
}
/** Equity of every agent at the start of `week`; the first visit of a week records it. */
async function snapshot(week: string, now?: Record<string, number>) {
  const sql = sqlClient();
  const [r] = await sql`select v from la_meta where k = ${`wk:${week}`}`;
  if (r) return JSON.parse(r.v) as Record<string, number>;
  if (!now || week !== weekId()) return null;
  await sql`insert into la_meta (k, v) values (${`wk:${week}`}, ${JSON.stringify(now)}) on conflict (k) do nothing`;
  return now;
}

export async function standings(week = weekId()) {
  await init();
  const now = await equities();
  const start = (await snapshot(week, now)) ?? now;
  const next = weekId(Date.parse(week) + 7 * DAY + 1000);
  const end = (await snapshot(next, week === weekId() ? undefined : now)) ?? now;
  return CAST.map((c) => ({ id: c.id, name: c.name, color: c.color, pct: start[c.id] ? (end[c.id] / start[c.id] - 1) * 100 : 0 })).sort((a, b) => b.pct - a.pct);
}

/** TTWO held by the reward wallet (all its token accounts for that mint). */
export async function pot() {
  if (!REWARD_WALLET) return 0;
  const r = await connection().getParsedTokenAccountsByOwner(new PublicKey(REWARD_WALLET), { mint: new PublicKey(TTWO) }).catch(() => null);
  return r?.value.reduce((s, a) => s + (Number(a.account.data.parsed.info.tokenAmount.uiAmount) || 0), 0) ?? 0;
}

let px: { at: number; usd: number } = { at: 0, usd: 0 };
/** Take-Two's share price in USD, from Jupiter (cached 10 min). */
async function ttwoUsd() {
  if (Date.now() - px.at < 600_000) return px.usd;
  const h: Record<string, string> = process.env.JUPITER_API_KEY ? { "x-api-key": process.env.JUPITER_API_KEY } : {};
  const r = await fetch(`${JUP}/price/v3?ids=${TTWO}`, { headers: h, cache: "no-store", signal: AbortSignal.timeout(6000) }).then((r) => r.json()).catch(() => null);
  px = { at: Date.now(), usd: Number(r?.[TTWO]?.usdPrice) || px.usd }; return px.usd;
}

export async function rewardState() {
  await init(); const sql = sqlClient(), week = weekId();
  const [table, picks, shares, past, usd] = await Promise.all([
    standings(week),
    sql`select agent, count(*)::int as n from la_picks where week = ${week} group by agent`,
    pot(),
    sql`select week, winner, pot, pickers, per, status, txs from la_rewards order by week desc limit 6`,
    ttwoUsd(),
  ]);
  return { week, endsAt: weekStart() + 7 * DAY, standings: table, picks: Object.fromEntries(picks.map((p) => [p.agent, p.n])), pot: shares, usd, wallet: REWARD_WALLET, token: TTWO, past };
}

/** Solana addresses are case-sensitive base58: stored exactly as typed (trimmed), never lowercased. */
export async function pick(address: string, agent: string) {
  await init();
  if (!isAddress(address)) throw new Error("That is not a Solana wallet address.");
  if (!CAST.some((c) => c.id === agent)) throw new Error("Unknown agent.");
  const sql = sqlClient(), week = weekId(), a = new PublicKey(address).toBase58();
  await sql`insert into la_picks (week, address, agent) values (${week}, ${a}, ${agent}) on conflict (week, address) do update set agent = excluded.agent, at = now()`;
  return { week, agent };
}
export async function myPick(address: string) {
  await init(); if (!isAddress(address)) return null;
  const [r] = await sqlClient()`select agent from la_picks where week = ${weekId()} and address = ${address}`;
  return r?.agent ?? null;
}
