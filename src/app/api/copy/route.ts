import { PublicKey } from "@solana/web3.js";
import { connection, isAddress, LAMPORTS, planSwap, tokenByMint } from "@/lib/sol/index";
import { jupQuote, jupSwapTx, pumpPortalTx } from "@/lib/sol/jupiter";
import { getTown } from "@/lib/agents/data";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";

/**
 * Copy-trade: mirror one agent trade in the caller's own Solana wallet (Phantom, Solflare). Buys spend the follower's chosen SOL size;
 * sells sell the same share of the follower's bag that the agent sold of its own. Returns one unsigned transaction, never sends,
 * never holds funds: the swap is a plain Jupiter route (PumpPortal for a fresh curve coin Jupiter can't route yet), no fee added.
 */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (typeof b.wallet !== "string" || !isAddress(b.wallet)) throw new Error("Connect a Solana wallet first.");
    const owner = b.wallet as string;
    const town = await getTown();
    const t = town.trades.find((x) => x.id === Number(b.trade));
    if (!t) throw new Error("That trade is too old to copy.");
    const token = await tokenByMint(t.token);
    if (!token) throw new Error(`No market data for $${t.symbol} right now.`);
    let raw: bigint;
    if (t.side === "buy") {
      const sol = Math.min(5, Math.max(0.005, Number(b.sol) || 0.05));
      const bal = await connection().getBalance(new PublicKey(owner));
      if (bal < sol * LAMPORTS + 0.003 * LAMPORTS) throw new Error(`Your wallet needs ${sol} SOL plus ~0.003 SOL for fees.`);
      raw = BigInt(Math.round(sol * LAMPORTS));
    } else {
      const left = town.agents.find((a) => a.id === t.agent)?.positions.find((p) => p.token === t.token)?.qty ?? 0;
      const share = t.qty / (t.qty + left);   // what part of its bag the agent just sold
      const accs = await connection().getParsedTokenAccountsByOwner(new PublicKey(owner), { mint: new PublicKey(t.token) });
      const bal = accs.value.reduce((s, x) => s + BigInt(x.account.data.parsed.info.tokenAmount.amount), 0n);
      if (bal === 0n) throw new Error(`You don't hold $${t.symbol}, nothing to sell.`);
      raw = share >= 0.999 ? bal : (bal * BigInt(Math.round(share * 10_000))) / 10_000n;
    }
    const plan = await planSwap({ side: t.side, token, quote: "SOL", amount: raw, slippageBps: t.kind === "pump" ? 500 : 150 });
    const built = plan.venue === "jupiter"
      ? await jupSwapTx(await jupQuote(plan.inputMint, plan.outputMint, raw, plan.slippageBps), owner)
      : await pumpPortalTx({ owner, mint: plan.mint, side: plan.side, amount: plan.side === "buy" ? (Number(raw) / LAMPORTS).toString() : (Number(raw) / 10 ** token.decimals).toString(), denominatedInSol: plan.side === "buy", slippagePct: plan.slippageBps / 100 });
    const label = `${t.side === "buy" ? "Buy" : "Sell"} $${t.symbol} via ${plan.route.join(" + ") || plan.venue}`;
    return ok({ symbol: t.symbol, side: t.side, txs: [{ label, tx: Buffer.from(built.tx).toString("base64") }] });
  } catch (e) { return fail(e); }
}
