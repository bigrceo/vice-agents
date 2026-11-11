import "server-only";
import { encodeFunctionData, type Hex } from "viem";
import { curveAbi, erc20Abi } from "./rh/abis";
import { quoteBuy, quoteSell, readCurve } from "./rh/curveMath";
import { getLaunch } from "./rh/pons";
import { readClient } from "./rh/rpc";

type Tx = { to: Hex; data: Hex; value: string };
/**
 * Bonding-curve trade for the user's own wallet: buy = curve.buy{value}, sell = approve (if needed) + curve.sell.
 * The user signs and pays gas; we never hold funds. Graduated coins trade on Pons.
 */
export async function buildTrade(r: { mint: string; wallet: string; side: "buy" | "sell"; amount: number; slippagePct?: number }) {
  const token = r.mint as Hex, user = r.wallet as Hex;
  const l = await getLaunch(token);
  if (!l.exists) throw new Error("Not a Pons coin.");
  if (l.phase !== "curve") return { graduated: true, txs: [] as Tx[], expected: "" };
  const s = await readCurve(l.curve);
  const slip = BigInt(Math.round(Math.min(50, Math.max(0.5, r.slippagePct ?? 5)) * 100));
  const txs: Tx[] = [];
  if (r.side === "buy") {
    const wei = BigInt(Math.round(r.amount * 1e9)) * 10n ** 9n;
    const q = quoteBuy(s, wei);
    const min = (q.tokensOut * (10_000n - slip)) / 10_000n;
    txs.push({ to: l.curve, data: encodeFunctionData({ abi: curveAbi, functionName: "buy", args: [wei, min, user] }), value: wei.toString() });
    return { graduated: false, txs, expected: (Number(q.tokensOut) / 1e18).toFixed(0) };
  }
  const amt = BigInt(Math.round(r.amount)) * 10n ** 18n;
  const q = quoteSell(s, amt);
  const allowance = await readClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [user, l.curve] });
  if (allowance < amt) txs.push({ to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [l.curve, amt] }), value: "0" });
  txs.push({ to: l.curve, data: encodeFunctionData({ abi: curveAbi, functionName: "sell", args: [amt, (q.quoteOut * (10_000n - slip)) / 10_000n, user] }), value: "0" });
  return { graduated: false, txs, expected: (Number(q.quoteOut) / 1e18).toFixed(5) };
}
