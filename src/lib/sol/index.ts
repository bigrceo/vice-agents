import { PublicKey } from "@solana/web3.js";
import { DEFAULT_SLIPPAGE_BPS, jupQuote, jupSwapTx, MAX_SLIPPAGE_BPS, pumpPortalTx, type JupQuote } from "./jupiter";
import { connection, LAMPORTS, sendSigned, SOL_MINT, SwapError, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, USDC_MINT } from "./solana";
import { pricesUsd, type Token } from "./tokens";

/**
 * SAY swap engine: plan (quote) → execute (rebuild, sign, send, read the result).
 * Pure Solana + HTTP, signer injected: reusable as-is by another MCP (Just Ask "launch + trade").
 */
export * from "./solana";
export * from "./tokens";
export { DEFAULT_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS } from "./jupiter";

export type Quote = "SOL" | "USDC";
export const QUOTE_MINT: Record<Quote, string> = { SOL: SOL_MINT, USDC: USDC_MINT };
const QUOTE_DECIMALS: Record<Quote, number> = { SOL: 9, USDC: 6 };

export type Plan = {
  side: "buy" | "sell"; mint: string; quote: Quote; venue: "jupiter" | "pumpportal";
  inputMint: string; outputMint: string; inAmount: string; expectedOut: string; minOut: string;
  inDecimals: number; outDecimals: number; slippageBps: number; priceImpactPct: number; route: string[]; feeRaw: string;
};

export type Signer = (unsignedTx: Uint8Array) => Promise<Uint8Array>;

const toRaw = (amount: number, decimals: number) => BigInt(Math.round(amount * 10 ** Math.min(decimals, 9))) * 10n ** BigInt(Math.max(0, decimals - 9));

export function clampSlippage(bps?: number) {
  return Math.max(10, Math.min(MAX_SLIPPAGE_BPS, Math.round(bps ?? DEFAULT_SLIPPAGE_BPS)));
}

/** Price a buy (spend `amount` SOL/USDC) or a sell (`amount` raw tokens) of `token`. Nothing is signed here. */
export async function planSwap(p: { side: "buy" | "sell"; token: Token; quote: Quote; amount: number | bigint; slippageBps?: number }): Promise<Plan> {
  const slippageBps = clampSlippage(p.slippageBps);
  const qMint = QUOTE_MINT[p.quote], qDec = QUOTE_DECIMALS[p.quote];
  const [inputMint, outputMint] = p.side === "buy" ? [qMint, p.token.mint] : [p.token.mint, qMint];
  const inDecimals = p.side === "buy" ? qDec : p.token.decimals, outDecimals = p.side === "buy" ? p.token.decimals : qDec;
  const inAmount = typeof p.amount === "bigint" ? p.amount : toRaw(p.amount, inDecimals);
  if (inAmount <= 0n) throw new SwapError("Amount must be above zero.");
  try {
    const q = await jupQuote(inputMint, outputMint, inAmount, slippageBps);
    return fromJup(p.side, p.token.mint, p.quote, q, inDecimals, outDecimals);
  } catch (e) {
    // Fresh pump.fun curve coins Jupiter can't route yet: PumpPortal, SOL only.
    if ((e as Error).message !== "NO_ROUTE" || !p.token.onBondingCurve || p.quote !== "SOL") {
      throw (e as Error).message === "NO_ROUTE" ? new SwapError(`No route to ${p.side} $${p.token.symbol} right now (no liquidity on any DEX Jupiter covers).`) : e;
    }
    const price = p.token.priceUsd;
    const sol = (await pricesUsd([SOL_MINT]))[SOL_MINT] ?? 0;
    const expected = price && sol
      ? p.side === "buy" ? (Number(inAmount) / LAMPORTS) * sol / price * 10 ** outDecimals : (Number(inAmount) / 10 ** inDecimals) * price / sol * LAMPORTS
      : 0;
    const exp = BigInt(Math.floor(expected));
    return {
      side: p.side, mint: p.token.mint, quote: "SOL", venue: "pumpportal", inputMint, outputMint, inAmount: inAmount.toString(),
      expectedOut: exp.toString(), minOut: ((exp * BigInt(10_000 - slippageBps)) / 10_000n).toString(), inDecimals, outDecimals,
      slippageBps, priceImpactPct: 0, route: ["pump.fun (PumpPortal)"], feeRaw: "0",
    };
  }
}

function fromJup(side: "buy" | "sell", mint: string, quote: Quote, q: JupQuote, inDecimals: number, outDecimals: number): Plan {
  return {
    side, mint, quote, venue: "jupiter", inputMint: q.inputMint, outputMint: q.outputMint, inAmount: q.inAmount,
    expectedOut: q.outAmount, minOut: q.otherAmountThreshold, inDecimals, outDecimals, slippageBps: q.slippageBps,
    priceImpactPct: Math.abs(Number(q.priceImpactPct) * 100), route: [...new Set(q.routePlan.map((r) => r.swapInfo.label))],
    feeRaw: q.platformFee?.amount ?? "0",
  };
}

/**
 * Executes a plan the user approved. Re-quotes first: if the market moved so the user would get
 * less than the floor they saw (`plan.minOut`), it aborts before signing anything. The fresh quote's
 * own floor is enforced on chain by Jupiter (or by the pump.fun program's slippage check).
 */
export async function executePlan(plan: Plan, owner: string, sign: Signer): Promise<{ signature: string; received: bigint; spent: bigint }> {
  let built: { tx: Uint8Array; lastValidBlockHeight: number };
  if (plan.venue === "jupiter") {
    const q = await jupQuote(plan.inputMint, plan.outputMint, BigInt(plan.inAmount), plan.slippageBps);
    const floor = BigInt(plan.minOut);
    // The user approved "at least plan.minOut". Refuse if the market no longer gets there; otherwise
    // pin the on-chain floor to exactly what the user approved (never lower).
    if (BigInt(q.outAmount) < floor) throw new SwapError("The price moved past your slippage since the quote. Nothing was sent. Ask for a new quote.");
    if (BigInt(q.otherAmountThreshold) < floor) {
      q.otherAmountThreshold = floor.toString();
      q.slippageBps = Math.max(0, Math.floor(Number(((BigInt(q.outAmount) - floor) * 10_000n) / BigInt(q.outAmount))));
    }
    built = await jupSwapTx(q, owner);
  } else {
    const amount = plan.side === "buy" ? (Number(plan.inAmount) / LAMPORTS).toString() : (Number(plan.inAmount) / 10 ** plan.inDecimals).toString();
    built = await pumpPortalTx({ owner, mint: plan.mint, side: plan.side, amount, denominatedInSol: plan.side === "buy", slippagePct: plan.slippageBps / 100 });
  }
  const signed = await sign(built.tx);
  const signature = await sendSigned(signed, built.lastValidBlockHeight);
  const { received, spent } = await settled(signature, owner, plan);
  return { signature, received, spent };
}

/** What actually moved, read from the confirmed transaction's balance changes. */
async function settled(signature: string, owner: string, plan: Plan) {
  const c = connection();
  let tx = null;
  for (let i = 0; i < 6 && !tx; i++) {
    tx = await c.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }).catch(() => null);
    if (!tx) await new Promise((r) => setTimeout(r, 800));
  }
  if (!tx?.meta) return { received: 0n, spent: 0n };
  const delta = (mint: string) => {
    if (mint === SOL_MINT) {
      const keys = tx!.transaction.message.getAccountKeys({ accountKeysFromLookups: tx!.meta!.loadedAddresses ?? undefined });
      const i = keys.staticAccountKeys.findIndex((k) => k.toBase58() === owner);
      const lamports = i >= 0 ? BigInt(tx!.meta!.postBalances[i]) - BigInt(tx!.meta!.preBalances[i]) : 0n;
      // Native SOL moves through a temporary wSOL account; count both plus the fee the user paid.
      return lamports + (i === 0 ? BigInt(tx!.meta!.fee) : 0n);
    }
    const sum = (arr: typeof tx.meta.preTokenBalances) =>
      (arr ?? []).filter((b) => b.mint === mint && b.owner === owner).reduce((a, b) => a + BigInt(b.uiTokenAmount.amount), 0n);
    return sum(tx!.meta!.postTokenBalances) - sum(tx!.meta!.preTokenBalances);
  };
  const outD = delta(plan.outputMint), inD = delta(plan.inputMint);
  return { received: outD > 0n ? outD : 0n, spent: inD < 0n ? -inD : 0n };
}

// ---------- balances ----------

export type Holding = { mint: string; raw: bigint; decimals: number; amount: number };

/** SOL + every SPL / Token-2022 balance of a wallet. */
export async function balances(owner: string): Promise<{ sol: number; tokens: Holding[] }> {
  const c = connection();
  const pk = new PublicKey(owner);
  const [lamports, a, b] = await Promise.all([
    c.getBalance(pk),
    c.getParsedTokenAccountsByOwner(pk, { programId: TOKEN_PROGRAM }),
    c.getParsedTokenAccountsByOwner(pk, { programId: TOKEN_2022_PROGRAM }),
  ]);
  const tokens = new Map<string, Holding>();
  for (const acc of [...a.value, ...b.value]) {
    const info = acc.account.data.parsed.info as { mint: string; tokenAmount: { amount: string; decimals: number } };
    const raw = BigInt(info.tokenAmount.amount);
    if (raw === 0n) continue;
    const prev = tokens.get(info.mint);
    const total = (prev?.raw ?? 0n) + raw;
    tokens.set(info.mint, { mint: info.mint, raw: total, decimals: info.tokenAmount.decimals, amount: Number(total) / 10 ** info.tokenAmount.decimals });
  }
  return { sol: lamports / LAMPORTS, tokens: [...tokens.values()] };
}
