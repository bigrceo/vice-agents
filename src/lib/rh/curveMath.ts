/**
 * PonsV2BondingCurveMath mirrored in bigint (constant product over
 * phantomQuote + real quote vs tracked tokens). Exact for the deployed curve
 * outside the 3-second snipe-tax window (treasury and launcher are exempt).
 */
import { readClient } from "./rpc";
import { curveAbi } from "./abis";
import type { Hex } from "./config";

export interface CurveState {
  curve: Hex;
  quoteReserve: bigint; // phantom + real - fee balances
  tokenReserve: bigint; // trackedTokens
  reservedTokens: bigint;
  phantomQuote: bigint;
  graduationThreshold: bigint;
  realQuote: bigint;
  feeBps: bigint;
  creatorTaxBps: bigint;
  graduated: boolean;
}

export async function readCurve(curve: Hex): Promise<CurveState> {
  const c = { address: curve, abi: curveAbi } as const;
  const [res, reserved, phantom, threshold, real, fee, tax, grad] = await Promise.all([
    readClient.readContract({ ...c, functionName: "getReserves" }),
    readClient.readContract({ ...c, functionName: "reservedTokens" }),
    readClient.readContract({ ...c, functionName: "phantomQuote" }),
    readClient.readContract({ ...c, functionName: "graduationThreshold" }),
    readClient.readContract({ ...c, functionName: "realQuoteReserve" }),
    readClient.readContract({ ...c, functionName: "feeBps" }),
    readClient.readContract({ ...c, functionName: "creatorTaxBps" }),
    readClient.readContract({ ...c, functionName: "graduated" }),
  ]);
  return {
    curve,
    quoteReserve: res[0],
    tokenReserve: res[1],
    reservedTokens: reserved,
    phantomQuote: phantom,
    graduationThreshold: threshold,
    realQuote: real,
    feeBps: fee,
    creatorTaxBps: tax,
    graduated: grad,
  };
}

const amountOut = (amountIn: bigint, rIn: bigint, rOut: bigint) =>
  amountIn === 0n || rIn === 0n || rOut === 0n ? 0n : (amountIn * 10_000n * rOut) / (rIn * 10_000n + amountIn * 10_000n);

const amountIn = (out: bigint, rIn: bigint, rOut: bigint) => (out * rIn * 10_000n) / ((rOut - out) * 10_000n) + 1n;

/** Tokens out for `quoteIn` wei, with the cap at the sellable amount and the refund. */
export function quoteBuy(s: CurveState, quoteIn: bigint): { tokensOut: bigint; spent: bigint; refund: bigint; priceImpactPct: number } {
  const fee = (quoteIn * s.feeBps) / 10_000n;
  const tax = (quoteIn * s.creatorTaxBps) / 10_000n;
  let tokensOut = amountOut(quoteIn - fee - tax, s.quoteReserve, s.tokenReserve);
  const sellable = s.tokenReserve > s.reservedTokens ? s.tokenReserve - s.reservedTokens : 0n;
  let spent = quoteIn;
  if (sellable === 0n) return { tokensOut: 0n, spent: 0n, refund: quoteIn, priceImpactPct: 0 };
  if (tokensOut > sellable) {
    tokensOut = sellable;
    const net = amountIn(sellable, s.quoteReserve, s.tokenReserve);
    const denom = 10_000n - s.feeBps - s.creatorTaxBps;
    const gross = (net * 10_000n + denom - 1n) / denom;
    spent = gross < quoteIn ? gross : quoteIn;
  }
  return { tokensOut, spent, refund: quoteIn - spent, priceImpactPct: impact(s, spent, tokensOut, true) };
}

/** Wei out for selling `tokensIn` (net of fee and creator tax). */
export function quoteSell(s: CurveState, tokensIn: bigint): { quoteOut: bigint; priceImpactPct: number } {
  const gross = amountOut(tokensIn, s.tokenReserve, s.quoteReserve);
  const fee = (gross * s.feeBps) / 10_000n;
  const tax = (gross * s.creatorTaxBps) / 10_000n;
  const quoteOut = gross - fee - tax;
  return { quoteOut, priceImpactPct: impact(s, quoteOut, tokensIn, false) };
}

/** Execution price vs spot, in percent (fees included). */
function impact(s: CurveState, eth: bigint, tokens: bigint, buying: boolean): number {
  if (tokens === 0n || eth === 0n) return 0;
  const spot = Number(s.quoteReserve) / Number(s.tokenReserve);
  const exec = Number(eth) / Number(tokens);
  return buying ? (exec / spot - 1) * 100 : (1 - exec / spot) * 100;
}

export const spotPriceEth = (s: CurveState) => Number(s.quoteReserve) / Number(s.tokenReserve);
