import { isAddress, SOL_MINT, USDC_MINT } from "./solana";

const JUP = process.env.JUPITER_API_URL || "https://lite-api.jup.ag";
const headers = (): HeadersInit => (process.env.JUPITER_API_KEY ? { "x-api-key": process.env.JUPITER_API_KEY } : {});

/** Below this much pool liquidity a token gets a warning on every quote. */
export const LOW_LIQUIDITY_USD = 10_000;

export type Token = {
  mint: string; name: string; symbol: string; decimals: number; icon: string | null;
  priceUsd: number; mcapUsd: number; liquidityUsd: number; holders: number | null;
  createdAt: string | null; ageHours: number | null; verified: boolean; tokenProgram: string;
  launchpad: string | null; onBondingCurve: boolean;
  audit: { mintAuthorityDisabled: boolean | null; freezeAuthorityDisabled: boolean | null; topHoldersPct: number | null; devBalancePct: number | null };
  stats: Record<"h1" | "h6" | "h24", { priceChangePct: number; buys: number; sells: number; traders: number; buyVolumeUsd: number; sellVolumeUsd: number; holderChangePct: number } | null>;
  organicScore: number | null;
};

type JupToken = Record<string, unknown> & {
  id: string; name: string; symbol: string; decimals: number; icon?: string; usdPrice?: number; mcap?: number; liquidity?: number;
  holderCount?: number; createdAt?: string; firstPool?: { createdAt?: string }; isVerified?: boolean; tokenProgram: string;
  launchpad?: string; graduatedPool?: string | null; audit?: Record<string, number | boolean>; organicScore?: number;
};

const clean = (s: unknown, max: number) => String(s ?? "?").replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, max) || "?";

function toToken(t: JupToken): Token {
  const created = t.firstPool?.createdAt ?? t.createdAt ?? null;
  const stat = (k: string) => {
    const s = t[k] as Record<string, number> | undefined;
    return s ? {
      priceChangePct: s.priceChange ?? 0, buys: s.numBuys ?? 0, sells: s.numSells ?? 0, traders: s.numTraders ?? 0,
      buyVolumeUsd: s.buyVolume ?? 0, sellVolumeUsd: s.sellVolume ?? 0, holderChangePct: s.holderChange ?? 0,
    } : null;
  };
  return {
    mint: t.id, name: clean(t.name, 40), symbol: clean(t.symbol, 16).replace(/^\$/, "") || "?", decimals: t.decimals, icon: t.icon ?? null,
    priceUsd: t.usdPrice ?? 0, mcapUsd: t.mcap ?? 0, liquidityUsd: t.liquidity ?? 0, holders: t.holderCount ?? null,
    createdAt: created, ageHours: created ? Math.max(0, (Date.now() - Date.parse(created)) / 3.6e6) : null,
    verified: Boolean(t.isVerified), tokenProgram: t.tokenProgram,
    launchpad: t.launchpad ?? null, onBondingCurve: Boolean(t.launchpad && !t.graduatedPool && /pump/i.test(t.launchpad)),
    audit: {
      mintAuthorityDisabled: (t.audit?.mintAuthorityDisabled as boolean) ?? null,
      freezeAuthorityDisabled: (t.audit?.freezeAuthorityDisabled as boolean) ?? null,
      topHoldersPct: (t.audit?.topHoldersPercentage as number) ?? null,
      devBalancePct: (t.audit?.devBalancePercentage as number) ?? null,
    },
    stats: { h1: stat("stats1h"), h6: stat("stats6h"), h24: stat("stats24h") },
    organicScore: t.organicScore ?? null,
  };
}

async function jup<T>(path: string): Promise<T> {
  const r = await fetch(`${JUP}${path}`, { headers: headers(), signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!r.ok) throw new Error(`Jupiter ${r.status}`);
  return r.json() as Promise<T>;
}

export async function tokenByMint(mint: string): Promise<Token | null> {
  const list = await jup<JupToken[]>(`/tokens/v2/search?query=${encodeURIComponent(mint)}`);
  const t = list.find((x) => x.id === mint);
  return t ? toToken(t) : null;
}

export async function tokensByMint(mints: string[]): Promise<Map<string, Token>> {
  const out = new Map<string, Token>();
  for (let i = 0; i < mints.length; i += 100) {
    const list = await jup<JupToken[]>(`/tokens/v2/search?query=${mints.slice(i, i + 100).join(",")}`);
    for (const t of list) out.set(t.id, toToken(t));
  }
  return out;
}

export type Resolution =
  | { kind: "found"; token: Token }
  | { kind: "ambiguous"; candidates: Token[] }
  | { kind: "none"; query: string };

const ALIASES: Record<string, string> = { SOL: SOL_MINT, WSOL: SOL_MINT, USDC: USDC_MINT };

/**
 * Ticker, name or mint → one token, or candidates when it's not clear-cut. A ticker counts as
 * unambiguous only when one match dominates: verified, or 20× the liquidity of the runner-up.
 */
export async function resolveToken(query: string): Promise<Resolution> {
  const q = query.trim().replace(/^\$/, "");
  if (ALIASES[q.toUpperCase()]) {
    const t = await tokenByMint(ALIASES[q.toUpperCase()]);
    return t ? { kind: "found", token: t } : { kind: "none", query };
  }
  if (isAddress(q)) {
    const t = await tokenByMint(q);
    return t ? { kind: "found", token: t } : { kind: "none", query };
  }
  const list = (await jup<JupToken[]>(`/tokens/v2/search?query=${encodeURIComponent(q)}`)).map(toToken);
  const norm = (x: string) => x.replace(/^\$/, "").toLowerCase();
  const exact = list.filter((t) => norm(t.symbol) === norm(q) || norm(t.name) === norm(q));
  const pool = (exact.length ? exact : list).sort((a, b) => b.liquidityUsd - a.liquidityUsd);
  if (!pool.length) return { kind: "none", query };
  if (pool.length === 1) return { kind: "found", token: pool[0] };
  const [a, b] = pool;
  const verifiedOnly = pool.filter((t) => t.verified);
  if (verifiedOnly.length === 1 && exact.length) return { kind: "found", token: verifiedOnly[0] };
  if (exact.length && a.liquidityUsd > 20 * Math.max(b.liquidityUsd, 1)) return { kind: "found", token: a };
  return { kind: "ambiguous", candidates: pool.slice(0, 6) };
}

/** Top tokens by Jupiter's trending score (organic volume, traders, holders). */
export async function trendingTokens(window: "1h" | "6h" | "24h", limit: number): Promise<Token[]> {
  const list = await jup<JupToken[]>(`/tokens/v2/toptrending/${window}?limit=${Math.min(100, limit * 2)}`);
  return list.map(toToken).filter((t) => t.mint !== SOL_MINT && t.mint !== USDC_MINT).slice(0, limit);
}

export async function pricesUsd(mints: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (let i = 0; i < mints.length; i += 50) {
    const r = await jup<Record<string, { usdPrice: number } | null>>(`/price/v3?ids=${mints.slice(i, i + 50).join(",")}`);
    for (const [k, v] of Object.entries(r)) if (v?.usdPrice) out[k] = v.usdPrice;
  }
  return out;
}

export type Pair = { dex: string; url: string; pairAddress: string; liquidityUsd: number; volume24hUsd: number; txns24h: { buys: number; sells: number }; createdAt: string | null };

/** DexScreener pools for a mint (largest liquidity first). */
export async function dexPairs(mint: string): Promise<Pair[]> {
  const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!r.ok) return [];
  const list = (await r.json()) as Array<{ dexId: string; url: string; pairAddress: string; liquidity?: { usd?: number }; volume?: { h24?: number }; txns?: { h24?: { buys: number; sells: number } }; pairCreatedAt?: number }>;
  return list
    .map((p) => ({
      dex: p.dexId, url: p.url, pairAddress: p.pairAddress, liquidityUsd: p.liquidity?.usd ?? 0, volume24hUsd: p.volume?.h24 ?? 0,
      txns24h: p.txns?.h24 ?? { buys: 0, sells: 0 }, createdAt: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : null,
    }))
    .sort((a, b) => b.liquidityUsd - a.liquidityUsd);
}
