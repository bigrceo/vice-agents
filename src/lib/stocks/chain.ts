import { createPublicClient, defineChain, encodeAbiParameters, http, keccak256, parseAbi, parseAbiItem, type Address, type Hex } from "viem";

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export const client = createPublicClient({ chain: robinhood, transport: http(undefined, { retryCount: 4, timeout: 20_000 }) });
/** Heavy unfiltered eth_getLogs (the trade index) can go to a second provider, e.g. https://robinhood.drpc.org. */
export const logsClient = process.env.LOGS_RPC_URL
  ? createPublicClient({ chain: robinhood, transport: http(process.env.LOGS_RPC_URL, { retryCount: 4, timeout: 20_000 }) })
  : client;

/** Blocks are ~0.1 s on Robinhood Chain. Measured, refined at runtime from real timestamps. */
export const BLOCKS_PER_SEC = 10;

// Pons V2 deployment (cross-checked against the verified factory and ponsmcp/pons-mcp, MIT).
export const PONS = {
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  poolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  memeHook: "0xe5e702641ea86f4ae6cc3cdaed2b886f976be044",
} as const satisfies Record<string, Address>;

export const ZERO: Address = "0x0000000000000000000000000000000000000000";
export const DEAD: Address = "0x000000000000000000000000000000000000dEaD";

export const factoryAbi = parseAbi([
  "function getLaunchedToken(address) view returns ((address token, address curve, address deployer, address creatorFeeRecipient, address pairToken, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, uint16 creatorTaxBps, bool buybackEnabled, uint8 phase, uint256 sweptQuote, uint256 sweptTokens, uint64 sweptAt, bool exists))",
]);
export const curveAbi = parseAbi([
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
  "function realQuoteReserve() view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function graduated() view returns (bool)",
  "function token() view returns (address)",
  "function launchedAt() view returns (uint256)",
]);
export const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);
export const stateViewAbi = parseAbi(["function getSlot0(bytes32) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"]);

export const EV = {
  launched: parseAbiItem("event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)"),
  graduated: parseAbiItem("event PoolGraduated(address indexed token, uint256 positionId, uint256 tokenAmount, uint256 pairTokenAmount)"),
  // buy: (spent, tokensOut, fee incl. snipe tax, tax) · sell: (tokensIn, quoteOut, fee, tax)
  curveBuy: parseAbiItem("event CurveBuy(address indexed buyer, address indexed recipient, uint256 spent, uint256 tokensOut, uint256 fee, uint256 tax)"),
  curveSell: parseAbiItem("event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)"),
  swap: parseAbiItem("event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)"),
  transfer: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)"),
};

export const PHASES = ["curve", "swept", "graduated", "rescued"] as const;

export type Launched = {
  token: Address; curve: Address; deployer: Address; pairToken: Address;
  graduationThreshold: bigint; poolFee: number; tickSpacing: number; creatorTaxBps: number; phase: number; exists: boolean;
};

export async function launchedToken(token: Address): Promise<Launched | null> {
  // Transport errors propagate: only a successful read with exists=false means "not a Pons token".
  const t = await client.readContract({ address: PONS.factory, abi: factoryAbi, functionName: "getLaunchedToken", args: [token] });
  return t.exists ? (t as Launched) : null;
}

/** Uniswap v4 pool id of a graduated Pons token (native ETH pair, meme hook). */
export function v4PoolId(token: Address, pair: Address, fee: number, tickSpacing: number): Hex {
  const [c0, c1] = token.toLowerCase() < pair.toLowerCase() ? [token, pair] : [pair, token];
  return keccak256(encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }],
    [c0, c1, fee, tickSpacing, PONS.memeHook],
  ));
}

/** ETH price of one token (both 18 decimals). */
export async function tokenPriceEth(lt: Launched): Promise<number> {
  if (lt.phase === 0) {
    const [q, t] = await client.readContract({ address: lt.curve, abi: curveAbi, functionName: "getReserves" });
    return t ? Number(q) / Number(t) : 0;
  }
  const id = v4PoolId(lt.token, lt.pairToken, lt.poolFee, lt.tickSpacing);
  const [sqrt] = await client.readContract({ address: PONS.stateView, abi: stateViewAbi, functionName: "getSlot0", args: [id] });
  const p = (Number(sqrt) / 2 ** 96) ** 2; // currency1 per currency0
  const tokenIs0 = lt.token.toLowerCase() < lt.pairToken.toLowerCase();
  return p === 0 ? 0 : tokenIs0 ? p : 1 / p;
}

let eth: { usd: number; at: number } | undefined;
/** ETH/USD from Coinbase's public spot price, cached for a minute. */
export async function ethUsd(strict = false): Promise<number> {
  if (eth && Date.now() - eth.at < 60_000) return eth.usd;
  try {
    const r = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", { cache: "no-store", signal: AbortSignal.timeout(4000) });
    const usd = Number((await r.json()).data.amount);
    if (usd > 0) eth = { usd, at: Date.now() };
  } catch {}
  // Display can fall back to a recent/rough price; trade sizing never does (a wrong price would break the user's caps).
  if (eth && (!strict || Date.now() - eth.at < 5 * 60_000)) return eth.usd;
  if (strict) throw new Error("ETH price unavailable");
  return Number(process.env.ETH_USD_FALLBACK ?? 4000);
}

// The public RPC rate-limits hard: keep at most 2 getLogs in flight (raise LOGS_CONCURRENCY on a paid RPC).
const MAX_INFLIGHT = Number(process.env.LOGS_CONCURRENCY ?? 2);
let inflight = 0;
const waiters: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  while (inflight >= MAX_INFLIGHT) await new Promise<void>((r) => waiters.push(r));
  inflight++;
  try { return await fn(); } finally { inflight--; waiters.shift()?.(); }
}

/** eth_getLogs over a range, splitting it whenever the node refuses (span or result-count limits). */
export async function getLogsSplit<T>(fetch: (from: bigint, to: bigint) => Promise<T[]>, from: bigint, to: bigint, maxSpan = 29_000n): Promise<T[]> {
  if (to < from) return [];
  if (to - from + 1n > maxSpan) {
    const out: T[] = [];
    const chunks: [bigint, bigint][] = [];
    for (let a = from; a <= to; a += maxSpan) chunks.push([a, a + maxSpan - 1n > to ? to : a + maxSpan - 1n]);
    for (let i = 0; i < chunks.length; i += 3) {
      const part = await Promise.all(chunks.slice(i, i + 3).map(([a, b]) => getLogsSplit(fetch, a, b, maxSpan)));
      for (const p of part) out.push(...p);
    }
    return out;
  }
  for (let attempt = 0; ; attempt++) {
    try {
      return await slot(() => fetch(from, to));
    } catch (e) {
      const msg = String((e as { details?: string }).details ?? (e as Error).message);
      if (/too many requests|429|timeout|timed out|temporarily/i.test(msg) && attempt < 5) { await new Promise((r) => setTimeout(r, 1000 * 2 ** Math.min(attempt, 5))); continue; }
      if (to === from || !/exceeds limit|are allowed for this request|query spans|ranges over|not supported on free plan|timeout|timed out/i.test(msg)) throw e;
      const mid = (from + to) / 2n;
      return [...(await getLogsSplit(fetch, from, mid, maxSpan)), ...(await getLogsSplit(fetch, mid + 1n, to, maxSpan))];
    }
  }
}
