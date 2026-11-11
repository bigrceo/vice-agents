/** Reads of a Pons V2 launch record, and its graduated pool key. */
import { readClient } from "./rpc";
import { factoryAbi } from "./abis";
import { ADDR, type Hex } from "./config";
import { poolId, type PoolKey } from "./util";

export const PHASE = ["curve", "swept", "pool", "rescued"] as const;
export type Phase = (typeof PHASE)[number];

export interface Launch {
  token: Hex;
  curve: Hex;
  deployer: Hex;
  creatorFeeRecipient: Hex;
  pairToken: Hex;
  graduationThreshold: bigint;
  poolFee: number;
  tickSpacing: number;
  creatorTaxBps: number;
  buybackEnabled: boolean;
  phase: Phase;
  exists: boolean;
}

export async function getLaunch(token: Hex, blockNumber?: bigint): Promise<Launch> {
  const r = await readClient.readContract({
    address: ADDR.factory,
    abi: factoryAbi,
    functionName: "getLaunchedToken",
    args: [token],
    ...(blockNumber ? { blockNumber } : {}),
  });
  return {
    token: r.token,
    curve: r.curve,
    deployer: r.deployer,
    creatorFeeRecipient: r.creatorFeeRecipient,
    pairToken: r.pairToken,
    graduationThreshold: r.graduationThreshold,
    poolFee: r.poolFee,
    tickSpacing: r.tickSpacing,
    creatorTaxBps: r.creatorTaxBps,
    buybackEnabled: r.buybackEnabled,
    phase: PHASE[r.phase] ?? "curve",
    exists: r.exists,
  };
}

/** The Uniswap v4 pool a launch graduates into (factory._poolIdFor). */
export function graduatedPoolKey(l: Pick<Launch, "token" | "pairToken" | "poolFee" | "tickSpacing">): PoolKey {
  const a = l.token.toLowerCase();
  const b = l.pairToken.toLowerCase();
  const [c0, c1] = a < b ? [l.token, l.pairToken] : [l.pairToken, l.token];
  return { currency0: c0, currency1: c1, fee: l.poolFee, tickSpacing: l.tickSpacing, hooks: ADDR.memeHook };
}

export const graduatedPoolId = (l: Parameters<typeof graduatedPoolKey>[0]) => poolId(graduatedPoolKey(l));
