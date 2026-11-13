import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { connection, SOL_MINT, SwapError, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, USDC_MINT } from "./solana";

const JUP = process.env.JUPITER_API_URL || "https://lite-api.jup.ag";
const headers = (): Record<string, string> => ({ "content-type": "application/json", ...(process.env.JUPITER_API_KEY ? { "x-api-key": process.env.JUPITER_API_KEY } : {}) });

export const DEFAULT_SLIPPAGE_BPS = 300; // 3%: room for memecoin volatility, still a hard on-chain floor
export const MAX_SLIPPAGE_BPS = 3000;
/** Priority fee cap per swap (lamports). Jupiter picks the level from recent fees, up to this. */
const MAX_PRIORITY_LAMPORTS = Number(process.env.MAX_PRIORITY_LAMPORTS ?? 2_000_000); // 0.002 SOL

export type JupQuote = {
  inputMint: string; outputMint: string; inAmount: string; outAmount: string; otherAmountThreshold: string;
  slippageBps: number; priceImpactPct: string; routePlan: { swapInfo: { label: string } }[]; platformFee: { amount: string; feeBps: number } | null;
  [k: string]: unknown;
};

/** SAY's cut, taken by Jupiter inside the swap. Only on SOL/USDC legs, so the fee is always paid in SOL or USDC. */
export function feeConfig(inputMint: string, outputMint: string): { bps: number; account: string } | null {
  const owner = process.env.FEE_WALLET;
  const bps = Number(process.env.FEE_BPS ?? 100);
  if (!owner || !bps) return null;
  const feeMint = [SOL_MINT, USDC_MINT].includes(inputMint) ? inputMint : [SOL_MINT, USDC_MINT].includes(outputMint) ? outputMint : null;
  if (!feeMint) return null;
  return { bps, account: getAssociatedTokenAddressSync(new PublicKey(feeMint), new PublicKey(owner), true, TOKEN_PROGRAM).toBase58() };
}

export async function jupQuote(inputMint: string, outputMint: string, amount: bigint, slippageBps: number): Promise<JupQuote> {
  const fee = feeConfig(inputMint, outputMint);
  const qs = new URLSearchParams({
    inputMint, outputMint, amount: amount.toString(), slippageBps: String(slippageBps), swapMode: "ExactIn",
    restrictIntermediateTokens: "true",
    ...(fee ? { platformFeeBps: String(fee.bps) } : {}),
  });
  const r = await fetch(`${JUP}/swap/v1/quote?${qs}`, { headers: headers(), signal: AbortSignal.timeout(10_000), cache: "no-store" });
  const j = (await r.json()) as JupQuote & { error?: string; errorCode?: string };
  if (!r.ok || j.error) throw new SwapError(j.errorCode === "COULD_NOT_FIND_ANY_ROUTE" || /route/i.test(j.error ?? "") ? "NO_ROUTE" : `Jupiter: ${j.error ?? r.status}`);
  return j;
}

/** Unsigned swap transaction for the user's wallet, with dynamic compute limit and automatic priority fee. */
export async function jupSwapTx(quote: JupQuote, owner: string): Promise<{ tx: Uint8Array; lastValidBlockHeight: number }> {
  const fee = feeConfig(quote.inputMint, quote.outputMint);
  const r = await fetch(`${JUP}/swap/v1/swap`, {
    method: "POST", headers: headers(), signal: AbortSignal.timeout(15_000), cache: "no-store",
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: owner,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: false,
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: MAX_PRIORITY_LAMPORTS, priorityLevel: "high" } },
      ...(fee ? { feeAccount: fee.account } : {}),
    }),
  });
  const j = (await r.json()) as { swapTransaction?: string; lastValidBlockHeight?: number; error?: string };
  if (!r.ok || !j.swapTransaction) throw new SwapError(`Jupiter couldn't build the swap: ${j.error ?? r.status}`);
  return { tx: Buffer.from(j.swapTransaction, "base64"), lastValidBlockHeight: j.lastValidBlockHeight ?? (await connection().getBlockHeight()) + 150 };
}

/** pump.fun fallback when Jupiter has no route (brand-new curve coins). PumpPortal builds the transaction; we sign it. */
export async function pumpPortalTx(p: { owner: string; mint: string; side: "buy" | "sell"; amount: string; denominatedInSol: boolean; slippagePct: number }) {
  const r = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      publicKey: p.owner, action: p.side, mint: p.mint, amount: p.amount, denominatedInSol: String(p.denominatedInSol),
      slippage: p.slippagePct, priorityFee: 0.0005, pool: "auto",
    }),
  });
  if (!r.ok) throw new SwapError(`PumpPortal: ${(await r.text()).slice(0, 120)}`);
  const tx = new Uint8Array(await r.arrayBuffer());
  VersionedTransaction.deserialize(tx); // throws if it isn't a transaction
  return { tx, lastValidBlockHeight: (await connection().getBlockHeight()) + 150 };
}

/** Is this mint a Token-2022 mint? (Its token accounts live under a different program.) */
export async function tokenProgramOf(mint: string): Promise<PublicKey> {
  const info = await connection().getAccountInfo(new PublicKey(mint));
  return info?.owner.equals(TOKEN_2022_PROGRAM) ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM;
}
