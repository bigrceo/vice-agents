/**
 * Market data of a Pons V2 coin: curve reserves before graduation, the v4 pool
 * after. ETH/USD comes only from on-chain ETH/USDG v4 pools and fails closed.
 */
import { readClient } from "./rpc";
import { curveAbi, erc20Abi, poolManagerAbi } from "./abis";
import { ADDR, type Hex } from "./config";
import { readCurve, spotPriceEth } from "./curveMath";
import { getLaunch, graduatedPoolId, type Phase } from "./pons";
import { blockAtTime, getLogsChunked, price0in1, readPool, virtualReserves } from "./util";

/** ETH/USDG v4 pools (currency0 = ETH, currency1 = USDG 6 decimals), deepest first. */
const ETH_USD_POOLS: Hex[] = [
  "0x54f7883914619af9105355bf83ed678bcf9f63560218ac61c9963b9503d0ba32", // fee 460 / ts 9
  "0x24107d152f14a76d292123265ae3f3c71f863fc2f4ef7ba49d64e78d28ea379e", // fee 100 / ts 1
];
const MAX_DISAGREEMENT = 0.015;
let ethUsdCache: { price: number; at: number } | null = null;

/**
 * ETH price in USD from the two on-chain ETH/USDG pools. Returns null (never a
 * guess) when a pool is empty, when they disagree by more than 1.5 %, or when
 * the value is outside sane bounds. Cached 30 s.
 */
export async function ethUsd(): Promise<{ price: number; at: number } | null> {
  if (ethUsdCache && Date.now() - ethUsdCache.at < 30_000) return ethUsdCache;
  try {
    const pools = await Promise.all(ETH_USD_POOLS.map(readPool));
    const prices = pools.filter((p) => p.liquidity > 0n && p.sqrtPriceX96 > 0n).map((p) => price0in1(p.sqrtPriceX96) * 1e12);
    if (prices.length < 2) return null;
    const [a, b] = prices;
    if (Math.abs(a - b) / Math.min(a, b) > MAX_DISAGREEMENT) return null;
    const price = a; // deepest pool
    if (!(price > 100 && price < 100_000)) return null;
    ethUsdCache = { price, at: Date.now() };
    return ethUsdCache;
  } catch {
    return null;
  }
}

export interface Market {
  token: Hex;
  phase: Phase;
  graduated: boolean;
  priceEth: number;
  priceUsd: number | null;
  mcapUsd: number | null;
  mcapEth: number;
  curveProgressPct: number;
  graduationUsd: number | null;
  graduationEth: number;
  liquidityUsd: number | null;
  liquidityEth: number;
  totalSupply: bigint;
  /** Opening price of the fresh curve (phantomQuote / supply). */
  openPriceEth: number;
  ethUsd: number | null;
  name?: string;
  symbol?: string;
}

export async function getMarket(token: Hex): Promise<Market> {
  const [l, eu, supply, name, symbol] = await Promise.all([
    getLaunch(token),
    ethUsd(),
    readClient.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }),
    readClient.readContract({ address: token, abi: erc20Abi, functionName: "name" }).catch(() => undefined),
    readClient.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }).catch(() => undefined),
  ]);
  if (!l.exists) throw new Error("Not a Pons V2 launch");
  const s = await readCurve(l.curve);
  const supplyF = Number(supply) / 1e18;
  const gradPriceEth = Number(s.phantomQuote + s.graduationThreshold) / Number(s.reservedTokens);
  const graduationEth = gradPriceEth * supplyF;

  let priceEth: number;
  let liquidityEth: number;
  let progress: number;
  if (l.phase === "pool") {
    const p = await readPool(graduatedPoolId(l));
    const ethIs0 = l.pairToken.toLowerCase() < token.toLowerCase();
    const p01 = price0in1(p.sqrtPriceX96); // currency1 per currency0
    priceEth = ethIs0 ? 1 / p01 : p01;
    const { r0, r1 } = virtualReserves(p.sqrtPriceX96, p.liquidity);
    liquidityEth = (2 * Number(ethIs0 ? r0 : r1)) / 1e18;
    progress = 100;
  } else {
    priceEth = spotPriceEth(s);
    liquidityEth = Number(s.realQuote) / 1e18;
    progress = l.phase === "curve" ? Math.min(100, (Number(s.realQuote) / Number(s.graduationThreshold)) * 100) : 100;
  }
  const usd = eu?.price ?? null;
  const mcapEth = priceEth * supplyF;
  return {
    token,
    phase: l.phase,
    graduated: l.phase !== "curve" || s.graduated,
    priceEth,
    priceUsd: usd === null ? null : priceEth * usd,
    mcapUsd: usd === null ? null : mcapEth * usd,
    mcapEth,
    curveProgressPct: progress,
    graduationUsd: usd === null ? null : graduationEth * usd,
    graduationEth,
    liquidityUsd: usd === null ? null : liquidityEth * usd,
    liquidityEth,
    totalSupply: supply,
    openPriceEth: Number(s.phantomQuote) / Number(supply),
    ethUsd: usd,
    name,
    symbol,
  };
}

export interface Trade {
  side: "buy" | "sell";
  ethWei: bigint;
  tokens: bigint;
  trader: Hex;
  block: bigint;
  tx: Hex;
  venue: "curve" | "pool";
}

/** Curve buys/sells and graduated-pool swaps since `fromBlock` (default: last hour). */
export async function trades(token: Hex, fromBlock?: bigint): Promise<Trade[]> {
  const l = await getLaunch(token);
  const to = await readClient.getBlockNumber();
  const from = fromBlock ?? (await blockAtTime(Math.floor(Date.now() / 1000) - 3600));
  const ev = (n: string) => curveAbi.find((x) => x.type === "event" && x.name === n) as Extract<(typeof curveAbi)[number], { type: "event"; name: "CurveBuy" | "CurveSell" }>;
  const [buys, sells] = await Promise.all([
    getLogsChunked({ address: l.curve, event: ev("CurveBuy") as never, fromBlock: from, toBlock: to }),
    getLogsChunked({ address: l.curve, event: ev("CurveSell") as never, fromBlock: from, toBlock: to }),
  ]);
  const out: Trade[] = [];
  for (const x of buys as unknown as { args: { recipient: Hex; quoteIn: bigint; tokensOut: bigint }; blockNumber: bigint; transactionHash: Hex }[])
    out.push({ side: "buy", ethWei: x.args.quoteIn, tokens: x.args.tokensOut, trader: x.args.recipient, block: x.blockNumber, tx: x.transactionHash, venue: "curve" });
  for (const x of sells as unknown as { args: { seller: Hex; quoteOut: bigint; tokensIn: bigint }; blockNumber: bigint; transactionHash: Hex }[])
    out.push({ side: "sell", ethWei: x.args.quoteOut, tokens: x.args.tokensIn, trader: x.args.seller, block: x.blockNumber, tx: x.transactionHash, venue: "curve" });

  if (l.phase === "pool") {
    const swapEv = poolManagerAbi.find((x) => x.type === "event" && x.name === "Swap")!;
    const id = graduatedPoolId(l);
    const swaps = (await getLogsChunked({ address: ADDR.poolManager, event: swapEv as never, args: { id }, fromBlock: from, toBlock: to })) as unknown as {
      args: { sender: Hex; amount0: bigint; amount1: bigint };
      blockNumber: bigint;
      transactionHash: Hex;
    }[];
    const ethIs0 = l.pairToken.toLowerCase() < token.toLowerCase();
    for (const s of swaps) {
      const eth = ethIs0 ? s.args.amount0 : s.args.amount1;
      const tok = ethIs0 ? s.args.amount1 : s.args.amount0;
      // v4 deltas are from the swapper's side: negative ETH = ETH paid in = buy.
      out.push({
        side: eth < 0n ? "buy" : "sell",
        ethWei: eth < 0n ? -eth : eth,
        tokens: tok < 0n ? -tok : tok,
        trader: s.args.sender,
        block: s.blockNumber,
        tx: s.transactionHash,
        venue: "pool",
      });
    }
  }
  return out.sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));
}

export async function vol1h(token: Hex): Promise<{ wei: bigint; trades: number; usd: number | null }> {
  const t = await trades(token);
  const wei = t.reduce((s, x) => s + x.ethWei, 0n);
  const eu = await ethUsd();
  return { wei, trades: t.length, usd: eu ? (Number(wei) / 1e18) * eu.price : null };
}
