import { SOL_MINT, isAddress } from "../sol/solana";
import { xstockByMint } from "../sol/market";

/**
 * A wallet's real Solana trading history, from Helius' parsed transactions (SWAP type): for each swap, the token the wallet
 * gained or lost and the SOL it really paid or received (native SOL + wSOL, fee included). Each fill is an xStock or a
 * pump.fun coin (pump.fun mints end in "pump"). Nothing is invented: a wallet with no such fill comes back with `active: false`.
 * Needs HELIUS_API_KEY (or a HELIUS_RPC_URL carrying ?api-key=).
 */
export type Fill = { token: string; kind: "stock" | "pump"; symbol: string; side: "buy" | "sell"; qty: number; sol: number; at: number; tx: string };
export type Bag = { token: string; kind: "stock" | "pump"; symbol: string; qty: number; spentSol: number; gotSol: number };
export type Stats = {
  trades: number; buys: number; sells: number; tokens: number; pumpShare: number;
  avgBuySol: number; maxBuySol: number; spentSol: number; gotSol: number; realizedPnlSol: number; realizedPnlPct: number | null;
  activeDays: number; tradesPerDay: number; firstAt: number; lastAt: number; fastFlips: number; holdHoursMedian: number | null; txCount: number;
};
export type History = { address: string; active: boolean; fills: Fill[]; bags: Bag[]; stats: Stats };

const apiKey = () => process.env.HELIUS_API_KEY || (process.env.HELIUS_RPC_URL ?? "").match(/api-key=([\w-]+)/)?.[1] || "";
type HTx = { signature: string; timestamp: number; tokenTransfers?: { fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number }[];
  accountData?: { account: string; nativeBalanceChange: number }[]; transactionError?: unknown };

async function swaps(address: string, pages = 5): Promise<HTx[]> {
  const key = apiKey(); if (!key) throw new Error("HELIUS_API_KEY missing");
  const out: HTx[] = []; let before = "";
  for (let i = 0; i < pages; i++) {
    const u = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${key}&type=SWAP&limit=100${before ? `&before=${before}` : ""}`;
    const r = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`helius ${r.status}`);
    const list = (await r.json()) as HTx[];
    out.push(...list);
    if (list.length < 100) break;
    before = list[list.length - 1].signature;
  }
  return out;
}

export async function readHistory(address: string, symbolOf: (mint: string) => Promise<string> = async (m) => m.slice(0, 4)): Promise<History> {
  if (!isAddress(address)) throw new Error("Not a Solana address.");
  const txs = (await swaps(address)).filter((t) => !t.transactionError);
  const fills: Fill[] = [];
  for (const t of txs) {
    const net = new Map<string, number>();
    for (const x of t.tokenTransfers ?? []) {
      const v = (x.toUserAccount === address ? 1 : 0) - (x.fromUserAccount === address ? 1 : 0);
      if (v) net.set(x.mint, (net.get(x.mint) ?? 0) + v * x.tokenAmount);
    }
    const sol = (t.accountData?.find((a) => a.account === address)?.nativeBalanceChange ?? 0) / 1e9 + (net.get(SOL_MINT) ?? 0);
    net.delete(SOL_MINT);
    const moved = [...net].filter(([, q]) => Math.abs(q) > 0);
    if (moved.length !== 1) continue;   // token-to-token or multi-leg swaps have no clean SOL price: skipped, not guessed
    const [mint, q] = moved[0];
    const st = xstockByMint(mint), kind = st ? "stock" : mint.endsWith("pump") ? "pump" : null;
    if (!kind) continue;
    const side = q > 0 ? "buy" : "sell";
    if ((side === "buy" && sol >= 0) || (side === "sell" && sol <= 0)) continue;   // a transfer or airdrop is not a trade
    fills.push({ token: mint, kind, symbol: st?.symbol ?? "", side, qty: Math.abs(q), sol: Math.abs(sol), at: t.timestamp * 1000, tx: t.signature });
  }
  fills.sort((a, b) => a.at - b.at);
  const names = new Map<string, string>();
  for (const m of new Set(fills.filter((f) => !f.symbol).map((f) => f.token))) names.set(m, await symbolOf(m).catch(() => m.slice(0, 4)));
  for (const f of fills) if (!f.symbol) f.symbol = (names.get(f.token) ?? "?").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

  const byToken = new Map<string, Bag>();
  for (const f of fills) {
    const b = byToken.get(f.token) ?? { token: f.token, kind: f.kind, symbol: f.symbol, qty: 0, spentSol: 0, gotSol: 0 };
    if (f.side === "buy") { b.qty += f.qty; b.spentSol += f.sol; } else { b.qty -= f.qty; b.gotSol += f.sol; }
    byToken.set(f.token, b);
  }
  const bags = [...byToken.values()];
  const buys = fills.filter((f) => f.side === "buy"), sells = fills.filter((f) => f.side === "sell");
  // realized result only on tokens the wallet has fully exited: what came back against what went in
  const boughtQty = (t: string) => buys.filter((f) => f.token === t).reduce((s, f) => s + f.qty, 0);
  const closed = bags.filter((b) => b.gotSol > 0 && b.spentSol > 0 && b.qty <= boughtQty(b.token) * 0.01);
  const cs = closed.reduce((s, b) => s + b.spentSol, 0), cg = closed.reduce((s, b) => s + b.gotSol, 0);
  const holds: number[] = [];
  let fastFlips = 0;
  for (const s of sells) {
    const b = buys.filter((x) => x.token === s.token && x.at <= s.at).pop(); if (!b) continue;
    const h = (s.at - b.at) / 3_600_000; holds.push(h); if (h < 1) fastFlips++;
  }
  holds.sort((a, b) => a - b);
  const first = fills[0]?.at ?? 0, last = fills[fills.length - 1]?.at ?? 0, spanDays = Math.max(1, (last - first) / 86_400_000);
  return {
    address, active: fills.length > 0, fills: fills.slice(-120), bags,
    stats: {
      trades: fills.length, buys: buys.length, sells: sells.length, tokens: bags.length,
      pumpShare: fills.length ? fills.filter((f) => f.kind === "pump").length / fills.length : 0,
      avgBuySol: buys.length ? buys.reduce((s, b) => s + b.sol, 0) / buys.length : 0, maxBuySol: buys.reduce((m, b) => Math.max(m, b.sol), 0),
      spentSol: buys.reduce((s, b) => s + b.sol, 0), gotSol: sells.reduce((s, b) => s + b.sol, 0),
      realizedPnlSol: cg - cs, realizedPnlPct: cs > 0 ? (cg / cs - 1) * 100 : null,
      activeDays: new Set(fills.map((f) => Math.floor(f.at / 86_400_000))).size, tradesPerDay: fills.length ? fills.length / spanDays : 0,
      firstAt: first, lastAt: last, fastFlips, holdHoursMedian: holds.length ? holds[Math.floor(holds.length / 2)] : null, txCount: txs.length,
    },
  };
}
