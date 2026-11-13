/**
 * The Solana market the agents trade: xStocks (tokenized stocks, Backed / xStocks, SPL mints starting with "Xs") and pump.fun coins.
 * Prices come from Jupiter (price + token API); pump.fun curve progress is read on chain from the bonding-curve account.
 * Plain fetch + web3.js: usable from the worker and from the site.
 */
import { PublicKey } from "@solana/web3.js";
import { connection, SOL_MINT } from "./solana";

const JUP = process.env.JUPITER_API_URL || "https://lite-api.jup.ag";
const headers = (): Record<string, string> => (process.env.JUPITER_API_KEY ? { "x-api-key": process.env.JUPITER_API_KEY } : {});

/** Verified xStocks mints (checked on Jupiter 2026-11-13, all 8 decimals). Symbol = the stock ticker, the token is `${symbol}x`. */
export const XSTOCKS: { symbol: string; mint: string }[] = [
  { symbol: "SPY", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W" },
  { symbol: "QQQ", mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ" },
  { symbol: "VTI", mint: "XsssYEQjzxBCFgvYFFNuhJFBeHNdLWYeUSP8F45cDr9" },
  { symbol: "TQQQ", mint: "XsjQP3iMAaQ3kQScQKthQpx9ALRbjKAjQtHg6TFomoc" },
  { symbol: "AAPL", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp" },
  { symbol: "MSFT", mint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX" },
  { symbol: "NVDA", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh" },
  { symbol: "GOOGL", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN" },
  { symbol: "AMZN", mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg" },
  { symbol: "META", mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu" },
  { symbol: "TSLA", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB" },
  { symbol: "AVGO", mint: "XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo" },
  { symbol: "AMD", mint: "XsXcJ6GZ9kVnjqGsjBnktRcuwMBmvKWh8S93RefZ1rF" },
  { symbol: "INTC", mint: "XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM" },
  { symbol: "ORCL", mint: "XsjFwUPiLofddX5cWFHW35GCbXcSu1BCUGfxoQAQjeL" },
  { symbol: "NFLX", mint: "XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL" },
  { symbol: "PLTR", mint: "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4" },
  { symbol: "COIN", mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu" },
  { symbol: "HOOD", mint: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg" },
  { symbol: "MSTR", mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ" },
  { symbol: "CRCL", mint: "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1" },
  { symbol: "GLD", mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re" },
  { symbol: "XOM", mint: "XsaHND8sHyfMfsWPj6kSdd5VwvCayZvjYgKmmcNL5qh" },
  { symbol: "LLY", mint: "Xsnuv4omNoHozR6EEW5mXkw8Nrny5rB3jVfLqi6gKMH" },
  { symbol: "UNH", mint: "XszvaiXGPwvk2nwb3o9C1CX4K6zH8sez11E6uyup6fe" },
  { symbol: "JPM", mint: "XsMAqkcKsUewDrzVkait4e5u4y8REgtyS7jWgCpLV2C" },
  { symbol: "MCD", mint: "XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2" },
  { symbol: "KO", mint: "XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ" },
];
export const xstockByMint = (m: string) => XSTOCKS.find((x) => x.mint === m);
export const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

type JupToken = { id: string; name: string; symbol: string; decimals: number; icon?: string; usdPrice?: number; mcap?: number; liquidity?: number;
  launchpad?: string; graduatedPool?: string | null; createdAt?: string; firstPool?: { createdAt?: string }; isVerified?: boolean; organicScore?: number };

async function jup<T>(path: string, tries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    const r = await fetch(`${JUP}${path}`, { headers: headers(), signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (r.ok) return r.json() as Promise<T>;
    if (r.status !== 429 || i >= tries) throw new Error(`Jupiter ${r.status} ${path.split("?")[0]}`);
    await new Promise((s) => setTimeout(s, 1500 * (i + 1)));   // the free lite API rate-limits bursts
  }
}

/** A market row: price and pool in SOL, so a paper fill can move the price like the real pool would. */
export type Mkt = { symbol: string; kind: "stock" | "pump"; mint: string; name: string; logo: string; decimals: number;
  priceSol: number; priceUsd: number; mcapUsd: number; liqSol: number; graduated: boolean; createdAt: string | null };

export async function solUsd(): Promise<number> {
  const r = await jup<Record<string, { usdPrice: number } | null>>(`/price/v3?ids=${SOL_MINT}`);
  return r[SOL_MINT]?.usdPrice ?? 0;
}

const toMkt = (t: JupToken, kind: "stock" | "pump", sol: number, symbol?: string): Mkt => ({
  symbol: symbol ?? String(t.symbol).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10), kind, mint: t.id, name: String(t.name ?? "").slice(0, 48),
  logo: t.icon ?? "", decimals: t.decimals, priceUsd: t.usdPrice ?? 0, priceSol: sol ? (t.usdPrice ?? 0) / sol : 0, mcapUsd: t.mcap ?? 0,
  liqSol: sol ? (t.liquidity ?? 0) / 2 / sol : 0,   // Jupiter's liquidity is both sides in USD: the SOL side is half
  graduated: Boolean(t.graduatedPool), createdAt: t.firstPool?.createdAt ?? t.createdAt ?? null,
});

/** Every xStock with a live Jupiter price. */
export async function stocks(sol: number): Promise<Mkt[]> {
  const list = await jup<JupToken[]>(`/tokens/v2/search?query=${XSTOCKS.map((x) => x.mint).join(",")}`);
  return XSTOCKS.flatMap((x) => { const t = list.find((y) => y.id === x.mint); return t?.usdPrice ? [{ ...toMkt(t, "stock", sol, x.symbol), liqSol: Math.max(toMkt(t, "stock", sol).liqSol, 1) }] : []; });
}

/** The trenches: the pump.fun coins trending on Jupiter (organic volume) and the freshest launches that already have a real pool. */
export async function pumpCoins(sol: number): Promise<(Mkt & { fresh: boolean })[]> {
  const [trend, recent] = await Promise.all([
    jup<JupToken[]>(`/tokens/v2/toptrending/1h?limit=100`),
    jup<JupToken[]>(`/tokens/v2/recent?limit=100`).catch(() => [] as JupToken[]),
  ]);
  const pump = (t: JupToken) => /pump/i.test(t.launchpad ?? "") && (t.usdPrice ?? 0) > 0;
  const top = trend.filter((t) => pump(t) && (t.liquidity ?? 0) > 15_000).slice(0, 12).map((t) => ({ ...toMkt(t, "pump", sol), fresh: false }));
  const fresh = recent.filter((t) => pump(t) && !t.graduatedPool && (t.liquidity ?? 0) > 4_000 && !top.some((x) => x.mint === t.id))
    .sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0)).slice(0, 8).map((t) => ({ ...toMkt(t, "pump", sol), fresh: true }));
  return uniq([...top, ...fresh]);
}

/** Current market for mints already held (a bag stays priced after its coin leaves the trending list). */
export async function byMints(mints: string[], sol: number): Promise<Mkt[]> {
  if (!mints.length) return [];
  const list = await jup<JupToken[]>(`/tokens/v2/search?query=${mints.slice(0, 100).join(",")}`);
  return list.filter((t) => mints.includes(t.id)).map((t) => { const x = xstockByMint(t.id); return toMkt(t, x ? "stock" : "pump", sol, x?.symbol); });
}

/** Two coins can share a ticker: the symbol becomes unique by mint, so a bag is always priced by its own token. */
function uniq<T extends Mkt>(l: T[]): T[] {
  return l.map((x) => l.some((y) => y.symbol === x.symbol && y.mint !== x.mint) ? { ...x, symbol: `${x.symbol}${x.mint.slice(0, 3).toUpperCase()}` } : x);
}

/**
 * pump.fun bonding-curve progress, read from the curve account: 0% at launch, 100% when every curve token is sold (it then migrates).
 * Layout: 8-byte discriminator, then u64 virtualToken, virtualSol, realToken, realSol, totalSupply, then bool complete.
 */
const INITIAL_REAL_TOKENS = 793_100_000_000_000n;
export async function curveProgress(mints: string[]): Promise<Map<string, { progress: number; complete: boolean }>> {
  const out = new Map<string, { progress: number; complete: boolean }>();
  const pdas = mints.map((m) => PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), new PublicKey(m).toBuffer()], PUMP_PROGRAM)[0]);
  for (let i = 0; i < pdas.length; i += 100) {
    const infos = await connection().getMultipleAccountsInfo(pdas.slice(i, i + 100));
    infos.forEach((acc, j) => {
      if (!acc || acc.data.length < 49) return;
      const realToken = acc.data.readBigUInt64LE(24), complete = acc.data[48] === 1;
      out.set(mints[i + j], { progress: complete ? 100 : Math.max(0, Math.min(100, Number((INITIAL_REAL_TOKENS - realToken) * 10_000n / INITIAL_REAL_TOKENS) / 100)), complete });
    });
  }
  return out;
}

export const pumpUrl = (mint: string) => `https://pump.fun/coin/${mint}`;
