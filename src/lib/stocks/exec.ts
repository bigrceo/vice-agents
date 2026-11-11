// Ported from ~/say-rh (PSST) src/server/trade.ts: real ETH↔stock and ETH↔Pons swap builders, used only when REAL_TRADING=1.
import { createHash, randomBytes } from "node:crypto";
import { encodeFunctionData, formatEther, formatUnits, getAddress, isAddress, parseAbi, parseEther, type Address, type Hex } from "viem";
import { client, curveAbi, launchedToken, ZERO, type Launched } from "./chain";
import { permit2Abi, poolKeyOf, quoterAbi, V4, v4SwapCalldata } from "./v4";
import { bestRoute, pathSwapCalldata, stockByAddress, stockBySymbol, STOCKS, USDG, type Stock } from "./route";
const GAS_RESERVE = parseEther("0.0003");
const MAX_UINT256 = (1n << 256n) - 1n;

const curveTradeAbi = parseAbi([
  "function buy(uint256 amountIn, uint256 minOut, address to) payable returns (uint256)",
  "function sell(uint256 tokensIn, uint256 minOut, address to) returns (uint256)",
  "function reservedTokens() view returns (uint256)",
  "function feeBps() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
  "function currentSnipeTaxBps(address) view returns (uint256)",
]);
const allowanceAbi = parseAbi(["function allowance(address, address) view returns (uint256)", "function approve(address, uint256) returns (bool)"]);

export class TradeError extends Error {}

type Step = { label: string; to: Address; data: Hex; value: bigint };
export type Quote = {
  id: string; side: "buy" | "sell"; kind: "stock" | "pons"; token: Address; symbol: string; name: string; venue: string;
  ethIn: string; tokensIn: string; expectedOut: string; minOut: string;
  usdIn: number; usdOut: number; priceImpactPct: number; slippagePct: number; expiresAt: string;
  verdict: string; warnings: string[];
  /** Never shown to the model: travels only in the card's _meta. */
  confirmCode: string;
};

/** A tradable asset: a tokenized stock (Uniswap v4, hookless pools) or a Pons coin (curve or v4 with the meme hook). */
export type Asset = { kind: "stock"; stock: Stock } | { kind: "pons"; lt: Launched };

/** Resolves a ticker (TSLA, $NVDA) or a 0x address. */
export async function resolveAsset(input: string): Promise<Asset> {
  const s = input.trim();
  if (isAddress(s)) {
    const st = stockByAddress(s);
    if (st) return { kind: "stock", stock: st };
    const lt = await launchedToken(getAddress(s));
    if (lt) return { kind: "pons", lt };
    throw new TradeError(`${s} isn't a tokenized stock or a Pons coin on Robinhood Chain.`);
  }
  const st = stockBySymbol(s);
  if (st) return { kind: "stock", stock: st };
  throw new TradeError(`"${s}" isn't a stock ticker PSST knows. Stocks: ${STOCKS.map((x) => x.symbol).join(", ")}. For a Pons coin, pass its contract address (0x…).`);
}

const symbolsMap = (st: Stock) => ({ [st.address]: st.symbol, [USDG]: "USDG" });

/** USD price of one share, from what the best on-chain route pays in USDG for it. */
export async function stockPriceUsd(st: Stock): Promise<number> {
  const one = 10n ** BigInt(st.decimals);
  const r = await bestRoute(st.address, USDG, one / 100n, symbolsMap(st)); // price 0.01 share: tiny impact
  return r ? (Number(formatUnits(r.out, 6)) * 100) : 0;
}

async function stockBuy(st: Stock, ethIn: bigint, slip: bigint) {
  const r = await bestRoute(ZERO, st.address, ethIn, symbolsMap(st));
  if (!r) throw new TradeError(`No pool on Robinhood Chain can fill this ${st.symbol} buy right now.`);
  const minOut = (r.out * (10_000n - slip)) / 10_000n;
  return { venue: `Uniswap v4 · ${r.label}`, out: r.out, minOut, steps: (min: bigint): Step[] => {
    const tx = pathSwapCalldata(ZERO, r.path, ethIn, min, BigInt(Math.floor(Date.now() / 1000) + 300));
    return [{ label: `buy ${st.symbol}`, ...tx }];
  } };
}

async function stockSell(st: Stock, owner: Address, amountIn: bigint, slip: bigint) {
  const r = await bestRoute(st.address, ZERO, amountIn, symbolsMap(st));
  if (!r) throw new TradeError(`No pool on Robinhood Chain can fill this ${st.symbol} sell right now.`);
  const minOut = (r.out * (10_000n - slip)) / 10_000n;
  const approvals = await permit2Approvals(st.address, owner, amountIn);
  return { venue: `Uniswap v4 · ${r.label}`, out: r.out, minOut, impact: 0, warnings: [] as string[], steps: (min: bigint): Step[] => {
    const tx = pathSwapCalldata(st.address, r.path, amountIn, min, BigInt(Math.floor(Date.now() / 1000) + 300));
    return [...approvals, { label: `sell ${st.symbol}`, ...tx }];
  } };
}

/** Exact, short-lived Permit2 grant to the Universal Router: no standing unlimited approval to the router. */
async function permit2Approvals(token: Address, owner: Address, amount: bigint): Promise<Step[]> {
  const [erc20Allow, [p2Amount, p2Exp]] = await Promise.all([
    client.readContract({ address: token, abi: allowanceAbi, functionName: "allowance", args: [owner, V4.permit2] }),
    client.readContract({ address: V4.permit2, abi: permit2Abi, functionName: "allowance", args: [owner, token, V4.universalRouter] }),
  ]);
  const now = Math.floor(Date.now() / 1000);
  return [
    ...(erc20Allow < amount ? [{ label: "approve Permit2", to: token, data: encodeFunctionData({ abi: allowanceAbi, functionName: "approve", args: [V4.permit2, MAX_UINT256] }), value: 0n }] : []),
    ...(p2Amount < amount || p2Exp < now + 60 ? [{ label: "allow the router for this sell", to: V4.permit2, data: encodeFunctionData({ abi: permit2Abi, functionName: "approve", args: [token, V4.universalRouter, amount, now + 600] }), value: 0n }] : []),
  ];
}

// ---------- limits ----------
export async function buildBuy(lt: Launched, owner: Address, ethSwap: bigint, slip: bigint) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  if (lt.phase === 0) {
    const [[q, t], reserved, feeBps, taxBps, snipeBps] = await Promise.all([
      client.readContract({ address: lt.curve, abi: curveAbi, functionName: "getReserves" }),
      client.readContract({ address: lt.curve, abi: curveTradeAbi, functionName: "reservedTokens" }),
      client.readContract({ address: lt.curve, abi: curveTradeAbi, functionName: "feeBps" }),
      client.readContract({ address: lt.curve, abi: curveTradeAbi, functionName: "creatorTaxBps" }),
      client.readContract({ address: lt.curve, abi: curveTradeAbi, functionName: "currentSnipeTaxBps", args: [owner] }).catch(() => 0n),
    ]);
    // Simulate the real call (with enough ETH granted to the wallet) for the exact output.
    const { result: out } = await client.simulateContract({
      address: lt.curve, abi: curveTradeAbi, functionName: "buy", args: [ethSwap, 0n, owner], value: ethSwap, account: owner,
      stateOverride: [{ address: owner, balance: ethSwap + parseEther("1") }],
    });
    const net = ethSwap - (ethSwap * (feeBps + taxBps + snipeBps)) / 10_000n;
    const ideal = t > reserved ? (net * t) / q : 0n;
    const impact = ideal > out ? Number(((ideal - out) * 10_000n) / ideal) / 100 : 0;
    const minOut = (out * (10_000n - slip)) / 10_000n;
    const warnings = snipeBps > 0n ? [`Snipe tax of ${Number(snipeBps) / 100}% applies right now (token just launched).`] : [];
    return { venue: "curve" as const, out, minOut, impact, warnings, steps: (min: bigint): Step[] => [
      { label: "buy on the bonding curve", to: lt.curve, data: encodeFunctionData({ abi: curveTradeAbi, functionName: "buy", args: [ethSwap, min, owner] }), value: ethSwap },
    ] };
  }
  const key = poolKeyOf(lt.token, lt.pairToken, lt.poolFee, lt.tickSpacing);
  const { result: [out] } = await client.simulateContract({
    address: V4.quoter, abi: quoterAbi, functionName: "quoteExactInputSingle",
    args: [{ poolKey: key, zeroForOne: true, exactAmount: ethSwap, hookData: "0x" }],
  });
  const minOut = (out * (10_000n - slip)) / 10_000n;
  return { venue: "uniswap-v4" as const, out, minOut, impact: 0, warnings: [] as string[], steps: (min: bigint): Step[] => {
    const { data, value } = v4SwapCalldata(key, ZERO, ethSwap, min, deadline);
    return [{ label: "swap on Uniswap v4", to: V4.universalRouter, data, value }];
  } };
}

export async function buildSell(lt: Launched, owner: Address, tokensIn: bigint, slip: bigint) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  if (lt.phase === 0) {
    const allowance = await client.readContract({ address: lt.token, abi: allowanceAbi, functionName: "allowance", args: [owner, lt.curve] });
    const approve: Step[] = allowance < tokensIn
      ? [{ label: "approve the curve for this sell", to: lt.token, data: encodeFunctionData({ abi: allowanceAbi, functionName: "approve", args: [lt.curve, tokensIn] }), value: 0n }]
      : [];
    const [q, t] = await client.readContract({ address: lt.curve, abi: curveAbi, functionName: "getReserves" });
    const gross = (tokensIn * q) / (t + tokensIn);
    const [feeBps, taxBps] = await Promise.all([
      client.readContract({ address: lt.curve, abi: curveTradeAbi, functionName: "feeBps" }),
      client.readContract({ address: lt.curve, abi: curveTradeAbi, functionName: "creatorTaxBps" }),
    ]);
    const out = gross - (gross * (feeBps + taxBps)) / 10_000n;
    const ideal = t ? (tokensIn * q) / t : 0n;
    const impact = ideal > gross ? Number(((ideal - gross) * 10_000n) / ideal) / 100 : 0;
    const minOut = (out * (10_000n - slip)) / 10_000n;
    return { venue: "curve" as const, out, minOut, impact, warnings: [] as string[], steps: (min: bigint): Step[] => [
      ...approve,
      { label: "sell on the bonding curve", to: lt.curve, data: encodeFunctionData({ abi: curveTradeAbi, functionName: "sell", args: [tokensIn, min, owner] }), value: 0n },
    ] };
  }
  const key = poolKeyOf(lt.token, lt.pairToken, lt.poolFee, lt.tickSpacing);
  const { result: [out] } = await client.simulateContract({
    address: V4.quoter, abi: quoterAbi, functionName: "quoteExactInputSingle",
    args: [{ poolKey: key, zeroForOne: false, exactAmount: tokensIn, hookData: "0x" }],
  });
  const approvals = await permit2Approvals(lt.token, owner, tokensIn);
  const minOut = (out * (10_000n - slip)) / 10_000n;
  return { venue: "uniswap-v4" as const, out, minOut, impact: 0, warnings: [] as string[], steps: (min: bigint): Step[] => {
    const { data } = v4SwapCalldata(key, lt.token, tokensIn, min, deadline);
    return [...approvals, { label: "swap on Uniswap v4", to: V4.universalRouter, data, value: 0n }];
  } };
}

const ethToUsd = (wei: bigint, usd: number) => Math.round(Number(formatEther(wei)) * usd * 100) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** One real trade, sent from an agent's own key. Returns the last tx hash. Stocks: ETH in / shares in. Pons: ETH in / tokens in. */
export async function realSwap(p: { kind: "stock" | "pons"; token: Address; side: "buy" | "sell"; amount: bigint; owner: Address;
  send: (s: { to: Address; data: Hex; value: bigint }) => Promise<Hex> }): Promise<Hex> {
  let steps: Step[];
  if (p.kind === "stock") {
    const st = stockByAddress(p.token); if (!st) throw new TradeError("unknown stock");
    const b = p.side === "buy" ? await stockBuy(st, p.amount, 150n) : await stockSell(st, p.owner, p.amount, 150n);
    steps = b.steps(b.minOut);
  } else {
    const lt = await launchedToken(p.token); if (!lt) throw new TradeError("not a Pons coin");
    const b = p.side === "buy" ? await buildBuy(lt, p.owner, p.amount, 500n) : await buildSell(lt, p.owner, p.amount, 500n);
    steps = b.steps(b.minOut);
  }
  let last: Hex = "0x";
  for (const s of steps) { last = await p.send(s); await client.waitForTransactionReceipt({ hash: last }); }
  return last;
}
void GAS_RESERVE; void stockBySymbol; void STOCKS; void USDG; void ZERO;
export type { Launched };
