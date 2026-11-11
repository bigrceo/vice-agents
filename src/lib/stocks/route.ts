import { concatHex, encodeAbiParameters, encodeFunctionData, parseAbi, toHex, type Address, type Hex } from "viem";
import { client, ZERO } from "./chain";
import { V4 } from "./v4";
import data from "@/data/pools.json";

/**
 * Routing for Robinhood Chain's tokenized stocks (TSLA, NVDA, SPY…) through hookless Uniswap v4 pools.
 * An ETH trade goes either straight through an ETH/stock pool, or ETH → USDG → stock, because most stock
 * liquidity on this chain sits against USDG. Every candidate path is priced by the v4 Quoter on chain,
 * and the best one wins. Pool list: src/data/pools.json (the chain's hookless v4 pools, indexed from Initialize logs).
 */
export const USDG: Address = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const BASES = new Set([ZERO, USDG, "0x0bd7d308f8e1639fab988df18a8011f41eacad73", "0x0000000000000000000000000000000000000000"]);
const STABLES = new Set(["USDG", "USDC", "USDT", "WETH", "ETH", "cbBTC"]); // not stocks

type Pool = { c0: Address; c1: Address; fee: number; tickSpacing: number };
const POOLS: Pool[] = (data.pools as [string, string, number, number, string, string, number, number][]).map(([c0, c1, fee, tickSpacing]) => ({
  c0: c0.toLowerCase() as Address, c1: c1.toLowerCase() as Address, fee, tickSpacing,
}));

export type Stock = { symbol: string; address: Address; decimals: number };
const seen = new Map<string, Stock>();
for (const [c0, c1, , , s0, s1, d0, d1] of data.pools as [string, string, number, number, string, string, number, number][]) {
  for (const [a, s, d] of [[c0, s0, d0], [c1, s1, d1]] as [string, string, number][]) {
    if (!STABLES.has(s) && !BASES.has(a.toLowerCase())) seen.set(a.toLowerCase(), { symbol: s, address: a.toLowerCase() as Address, decimals: d });
  }
}
export const STOCKS: Stock[] = [...seen.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
export const stockBySymbol = (s: string) => STOCKS.find((x) => x.symbol.toLowerCase() === s.replace(/^\$/, "").trim().toLowerCase());
export const stockByAddress = (a: string) => seen.get(a.toLowerCase());

const between = (a: Address, b: Address) => POOLS.filter((p) => (p.c0 === a && p.c1 === b) || (p.c0 === b && p.c1 === a));

/** One hop of a path, as v4's PathKey: the currency you land on plus the pool's parameters. */
export type PathKey = { intermediateCurrency: Address; fee: number; tickSpacing: number; hooks: Address; hookData: Hex };
const hop = (p: Pool, to: Address): PathKey => ({ intermediateCurrency: to, fee: p.fee, tickSpacing: p.tickSpacing, hooks: ZERO, hookData: "0x" });

/** Every ETH↔stock path worth pricing: direct pools, then via USDG. `from`/`to` are lowercased addresses. */
export function paths(from: Address, to: Address): PathKey[][] {
  const out: PathKey[][] = between(from, to).map((p) => [hop(p, to)]);
  if (from !== USDG && to !== USDG) {
    for (const a of between(from, USDG)) for (const b of between(USDG, to)) out.push([hop(a, USDG), hop(b, to)]);
  }
  return out;
}

const pathKeyT = { type: "tuple[]", components: [
  { name: "intermediateCurrency", type: "address" }, { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" }, { name: "hookData", type: "bytes" },
] } as const;
const quoterAbi = parseAbi([
  "struct PathKey { address intermediateCurrency; uint24 fee; int24 tickSpacing; address hooks; bytes hookData; }",
  "struct QuoteExactParams { address exactCurrency; PathKey[] path; uint128 exactAmount; }",
  "function quoteExactInput(QuoteExactParams params) returns (uint256 amountOut, uint256 gasEstimate)",
]);

export type Route = { path: PathKey[]; out: bigint; label: string };

/** Best exact-in route from `from` to `to`, priced on chain. Null when no pool can fill it. */
export async function bestRoute(from: Address, to: Address, amountIn: bigint, symbols: Record<string, string>): Promise<Route | null> {
  const f = from.toLowerCase() as Address, t = to.toLowerCase() as Address;
  const cands = paths(f, t);
  const priced = await Promise.all(cands.map(async (path) => {
    try {
      const { result: [out] } = await client.simulateContract({
        address: V4.quoter, abi: quoterAbi, functionName: "quoteExactInput",
        args: [{ exactCurrency: f, path, exactAmount: amountIn }],
      });
      return { path, out };
    } catch { return null; }
  }));
  const best = priced.filter((x): x is { path: PathKey[]; out: bigint } => !!x && x.out > 0n).sort((a, b) => (b.out > a.out ? 1 : -1))[0];
  if (!best) return null;
  const name = (a: Address) => symbols[a.toLowerCase()] ?? (a === ZERO ? "ETH" : a === USDG ? "USDG" : a.slice(0, 6));
  return { ...best, label: [name(f), ...best.path.map((h) => `${name(h.intermediateCurrency)}`)].join(" → ") };
}

const CMD_V4_SWAP = 0x10;
const ACT_SWAP_EXACT_IN = 0x07;
const ACT_SETTLE_ALL = 0x0c;
const ACT_TAKE_ALL = 0x0f;
const routerAbi = parseAbi(["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"]);

/**
 * Universal Router calldata for a multi-hop exact-in v4 swap. The floor (`minOut`) is checked twice on chain:
 * by the swap itself and by TAKE_ALL. ETH in is paid from msg.value; an ERC-20 in is pulled through Permit2.
 */
export function pathSwapCalldata(from: Address, path: PathKey[], amountIn: bigint, minOut: bigint, deadline: bigint): { to: Address; data: Hex; value: bigint } {
  const out = path[path.length - 1].intermediateCurrency;
  const swap = encodeAbiParameters(
    // This chain's v4-periphery has the per-hop slippage array (empty = no per-hop check).
    [{ type: "tuple", components: [{ name: "currencyIn", type: "address" }, { name: "path", ...pathKeyT }, { name: "maxHopSlippage", type: "uint256[]" }, { name: "amountIn", type: "uint128" }, { name: "amountOutMinimum", type: "uint128" }] }],
    [{ currencyIn: from, path, maxHopSlippage: [], amountIn, amountOutMinimum: minOut }],
  );
  const settle = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [from, amountIn]);
  const take = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [out, minOut]);
  const actions = concatHex([toHex(ACT_SWAP_EXACT_IN, { size: 1 }), toHex(ACT_SETTLE_ALL, { size: 1 }), toHex(ACT_TAKE_ALL, { size: 1 })]);
  const input = encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], [actions, [swap, settle, take]]);
  return {
    to: V4.universalRouter,
    data: encodeFunctionData({ abi: routerAbi, functionName: "execute", args: [toHex(CMD_V4_SWAP, { size: 1 }), [input], deadline] }),
    value: from === ZERO ? amountIn : 0n,
  };
}
