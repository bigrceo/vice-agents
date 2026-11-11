/** Shared helpers: v4 pool reads, chunked logs, block-by-time. */
import { encodeAbiParameters, keccak256, type AbiEvent, type Log } from "viem";
import { logsClient, readClient } from "./rpc";
import { poolManagerAbi } from "./abis";
import { ADDR, type Hex } from "./config";

export const Q96 = 2n ** 96n;

export interface PoolKey {
  currency0: Hex;
  currency1: Hex;
  fee: number;
  tickSpacing: number;
  hooks: Hex;
}

export function poolId(key: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

/** slot0 + liquidity of a v4 pool via PoolManager.extsload (no StateView needed). */
export async function readPool(id: Hex): Promise<{ sqrtPriceX96: bigint; tick: number; liquidity: bigint }> {
  const base = BigInt(keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [id, 6n])));
  const [s0, liq] = await Promise.all([
    readClient.readContract({ address: ADDR.poolManager, abi: poolManagerAbi, functionName: "extsload", args: [toB32(base)] }),
    readClient.readContract({ address: ADDR.poolManager, abi: poolManagerAbi, functionName: "extsload", args: [toB32(base + 3n)] }),
  ]);
  const w = BigInt(s0);
  const sqrtPriceX96 = w & ((1n << 160n) - 1n);
  let tick = Number((w >> 160n) & 0xffffffn);
  if (tick >= 0x800000) tick -= 0x1000000;
  return { sqrtPriceX96, tick, liquidity: BigInt(liq) & ((1n << 128n) - 1n) };
}

const toB32 = (n: bigint): Hex => `0x${n.toString(16).padStart(64, "0")}`;

/** Price of currency0 in currency1 (raw units ratio) as a float. */
export function price0in1(sqrtPriceX96: bigint): number {
  const s = Number(sqrtPriceX96) / 2 ** 96;
  return s * s;
}

/** Virtual reserves of the active range (exact for a full-range-only pool). */
export function virtualReserves(sqrtPriceX96: bigint, liquidity: bigint): { r0: bigint; r1: bigint } {
  if (sqrtPriceX96 === 0n) return { r0: 0n, r1: 0n };
  return { r0: (liquidity * Q96) / sqrtPriceX96, r1: (liquidity * sqrtPriceX96) / Q96 };
}

/**
 * getLogs on the official RPC (the only one serving logs), splitting the range
 * on error. The official RPC accepted 2M-block ranges in testing.
 */
export async function getLogsChunked<E extends AbiEvent>(p: {
  address?: Hex | Hex[];
  event: E;
  args?: Record<string, unknown>;
  fromBlock: bigint;
  toBlock: bigint;
  maxRange?: bigint;
}): Promise<Log<bigint, number, false, E, true>[]> {
  const out: Log<bigint, number, false, E, true>[] = [];
  const maxRange = p.maxRange ?? 2_000_000n;
  const run = async (from: bigint, to: bigint, depth: number): Promise<void> => {
    if (to - from + 1n > maxRange) {
      const mid = from + maxRange - 1n;
      await run(from, mid, depth);
      await run(mid + 1n, to, depth);
      return;
    }
    try {
      const logs = await logsClient.getLogs({
        address: p.address,
        event: p.event,
        args: p.args as never,
        fromBlock: from,
        toBlock: to,
        strict: true,
      });
      out.push(...(logs as never[]));
    } catch (e) {
      if (from === to || depth > 20) throw e;
      const mid = (from + to) / 2n;
      await run(from, mid, depth + 1);
      await run(mid + 1n, to, depth + 1);
    }
  };
  if (p.toBlock >= p.fromBlock) await run(p.fromBlock, p.toBlock, 0);
  return out;
}

/** First block with timestamp >= ts (binary search, ~25 reads). */
export async function blockAtTime(ts: number): Promise<bigint> {
  const latest = await readClient.getBlock({ blockTag: "latest" });
  if (Number(latest.timestamp) <= ts) return latest.number;
  // Rough guess from the recent block rate, then binary search.
  const back = 200_000n > latest.number ? latest.number : 200_000n;
  const past = await readClient.getBlock({ blockNumber: latest.number - back });
  const rate = Number(latest.timestamp - past.timestamp) / Number(back || 1n) || 0.25;
  let lo = latest.number - BigInt(Math.ceil((Number(latest.timestamp) - ts) / rate) * 2);
  if (lo < 0n) lo = 0n;
  let hi = latest.number;
  const loBlock = await readClient.getBlock({ blockNumber: lo });
  if (Number(loBlock.timestamp) >= ts) return lo;
  while (hi - lo > 1n) {
    const mid = (lo + hi) / 2n;
    const b = await readClient.getBlock({ blockNumber: mid });
    if (Number(b.timestamp) >= ts) hi = mid;
    else lo = mid;
  }
  return hi;
}

export const bpsOf = (x: bigint, bps: bigint) => (x * bps) / 10_000n;
export const withSlippage = (x: bigint, bps: bigint) => (x * (10_000n - bps)) / 10_000n;
