import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { parseAbiItem } from "viem";
import { db, schema } from "./db";
import { MOCK_COINS, mockHolders, mockTrades } from "./mock";
import { getMarket, trades as chainTrades, type Market } from "./rh/market";
import { readClient } from "./rh/rpc";
import { getLogsChunked } from "./rh/util";
import type { Hex } from "./rh/config";
import type { Coin, Holder, Sort, Trade } from "./types";

type Row = typeof schema.coins.$inferSelect;

/** Short-lived memo so a page render never asks the chain twice for the same thing. */
function memo<T>(ttl: number) {
  const m = new Map<string, { at: number; p: Promise<T> }>();
  return (key: string, f: () => Promise<T>) => {
    const hit = m.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.p;
    const p = f(); m.set(key, { at: Date.now(), p }); p.catch(() => m.delete(key));
    return p;
  };
}
const marketMemo = memo<Market | null>(20_000);
const tradesMemo = memo<Trade[]>(10_000);
const holdersMemo = memo<Holder[]>(30_000);
const market = (t: string) => marketMemo(t, () => getMarket(t as Hex).catch(() => null));

/** DB row (identity, media, map plot) + live Pons numbers (price, mcap, curve). */
function toCoin(r: Row, m: Market | null): Coin {
  return {
    mint: r.mint, curve: r.curve, name: r.name, ticker: r.ticker, description: r.description, sourceUrl: r.sourceUrl,
    still: `/api/coins/${r.mint}/still`, loop: r.loop ? `/api/coins/${r.mint}/loop.mp4` : null,
    creator: r.creator, tx: r.tx, block: r.block, createdAt: r.createdAt.toISOString(),
    mcapUsd: m?.mcapUsd ?? 0, bondingPct: m?.curveProgressPct ?? 0, migrated: m?.graduated ?? false,
    change24h: m && m.openPriceEth > 0 ? Math.round((m.priceEth / m.openPriceEth - 1) * 1000) / 10 : 0,
    volumeEth: 0, holders: 0, mapU: r.mapU, mapV: r.mapV,
  };
}

function sortMock(list: Coin[], sort: Sort) {
  const l = [...list];
  if (sort === "new") return l.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  if (sort === "mcap") return l.sort((a, b) => b.mcapUsd - a.mcapUsd);
  if (sort === "graduating") return l.filter((c) => !c.migrated).sort((a, b) => b.bondingPct - a.bondingPct);
  return l.sort((a, b) => Number(b.official) - Number(a.official) || b.volumeEth - a.volumeEth);
}

export async function listCoins(sort: Sort = "hot", limit = 120, q = ""): Promise<Coin[]> {
  const d = db();
  if (!d) {
    const s = q.toLowerCase();
    return sortMock(MOCK_COINS.filter((c) => !s || c.name.toLowerCase().includes(s) || c.ticker.toLowerCase().includes(s)), sort).slice(0, limit);
  }
  const c = schema.coins;
  const where = and(eq(c.hidden, false), q ? sql`(${c.name} ilike ${"%" + q + "%"} or ${c.ticker} ilike ${"%" + q + "%"})` : undefined);
  const rows = await d.select().from(c).where(where).orderBy(desc(c.createdAt)).limit(300);
  const coins = await Promise.all(rows.map(async (r) => toCoin(r, await market(r.mint))));
  const age = (x: Coin) => (Date.now() - +new Date(x.createdAt)) / 3_600_000;
  if (sort === "new") return coins.slice(0, limit);
  if (sort === "mcap") return coins.sort((a, b) => b.mcapUsd - a.mcapUsd).slice(0, limit);
  if (sort === "graduating") return coins.filter((x) => !x.migrated).sort((a, b) => b.bondingPct - a.bondingPct).slice(0, limit);
  return coins.sort((a, b) => b.mcapUsd / Math.pow(age(b) + 2, 1.2) - a.mcapUsd / Math.pow(age(a) + 2, 1.2)).slice(0, limit);
}

export async function getRawCoin(mint: string): Promise<Row | null> {
  const d = db();
  if (!d) return null;
  const [r] = await d.select().from(schema.coins).where(sql`lower(${schema.coins.mint}) = ${mint.toLowerCase()}`).limit(1);
  return r ?? null;
}

export async function getCoin(mint: string): Promise<Coin | null> {
  if (!db()) return MOCK_COINS.find((c) => c.mint === mint) ?? null;
  const r = await getRawCoin(mint);
  return r ? toCoin(r, await market(r.mint)) : null;
}

async function coinTrades(r: Row): Promise<Trade[]> {
  return tradesMemo(r.mint, async () => {
    const [list, m] = await Promise.all([chainTrades(r.mint as Hex, r.block ? BigInt(r.block) : undefined), market(r.mint)]);
    const blocks = [...new Set(list.slice(-60).map((t) => t.block))];
    const times = new Map(await Promise.all(blocks.map(async (b) => [b, Number((await readClient.getBlock({ blockNumber: b })).timestamp)] as const)));
    const supply = m ? Number(m.totalSupply) / 1e18 : 1e9;
    return list.slice(-60).reverse().map((t) => {
      const eth = Number(t.ethWei) / 1e18, tok = Number(t.tokens) / 1e18;
      return { sig: t.tx + t.side, mint: r.mint, ticker: r.ticker, wallet: t.trader, side: t.side, eth, tokens: tok,
        mcapUsd: tok > 0 && m?.ethUsd ? (eth / tok) * supply * m.ethUsd : 0, at: new Date((times.get(t.block) ?? 0) * 1000).toISOString() };
    });
  }).catch(() => []);
}

export async function listTrades(mint?: string, limit = 40): Promise<Trade[]> {
  const d = db();
  if (!d) return mockTrades(mint, limit);
  if (mint) { const r = await getRawCoin(mint); return r ? (await coinTrades(r)).slice(0, limit) : []; }
  const recent = await d.select().from(schema.coins).where(eq(schema.coins.hidden, false)).orderBy(desc(schema.coins.createdAt)).limit(8);
  const all = (await Promise.all(recent.map(coinTrades))).flat();
  return all.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, limit);
}

const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
export async function listHolders(coin: Coin): Promise<Holder[]> {
  if (!db()) return mockHolders(coin);
  return holdersMemo(coin.mint, async () => {
    const to = await readClient.getBlockNumber();
    const logs = await getLogsChunked({ address: coin.mint as Hex, event: transfer, fromBlock: coin.block ? BigInt(coin.block) : to - 2_000_000n, toBlock: to });
    const bal = new Map<string, bigint>();
    for (const l of logs as any[]) {
      const { from, to: dst, value } = l.args as { from: string; to: string; value: bigint };
      bal.set(from, (bal.get(from) ?? 0n) - value); bal.set(dst, (bal.get(dst) ?? 0n) + value);
    }
    const zero = "0x0000000000000000000000000000000000000000";
    const live = [...bal.entries()].filter(([a, v]) => a !== zero && v > 0n);
    const total = live.reduce((s, [, v]) => s + v, 0n) || 1n;
    return live.sort((a, b) => (b[1] > a[1] ? 1 : -1)).slice(0, 50)
      .map(([wallet, v]) => ({ wallet, amount: Number(v) / 1e18, pct: Number((v * 10_000n) / total) / 100,
        curve: wallet.toLowerCase() === coin.curve.toLowerCase(), dev: wallet.toLowerCase() === coin.creator.toLowerCase() }));
  }).catch(() => []);
}

export async function creatorCoins(address: string): Promise<Coin[]> {
  const d = db();
  if (!d) return MOCK_COINS.filter((c) => c.creator.toLowerCase() === address.toLowerCase());
  const rows = await d.select().from(schema.coins).where(sql`lower(${schema.coins.creator}) = ${address.toLowerCase()}`).orderBy(desc(schema.coins.createdAt));
  return Promise.all(rows.map(async (r) => toCoin(r, await market(r.mint))));
}
