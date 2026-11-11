/**
 * Server-only chain configuration. Env:
 *   TREASURY_ADDRESS            the creator-fee recipient of every coin (required for launch/verify/intents)
 *   NEXT_PUBLIC_MIND_LAUNCHER   MindLauncher address (one-signature launch + dev buy); unset = direct factory
 *   NEXT_PUBLIC_PLATFORM_TOKEN  platform token (buy & burn)
 *   DISPERSE_ADDRESS            Disperse contract (ETH airdrops to >1 recipient)
 *   PONS_LAUNCH_CONFIG_ID       default 0
 *   CREATOR_TAX_BPS             creator tax asked at launch, default 0 (MindLauncher caps it)
 */
import { getAddress, isAddress, zeroAddress } from "viem";
import { PONS, V4 } from "./net";

export type Hex = `0x${string}`;

const addr = (v: string | undefined): Hex | null => (v && isAddress(v.trim()) ? (getAddress(v.trim()) as Hex) : null);

export const ENV = {
  get treasury(): Hex | null {
    return addr(process.env.TREASURY_ADDRESS);
  },
  get launcher(): Hex | null {
    return addr(process.env.NEXT_PUBLIC_MIND_LAUNCHER);
  },
  get platformToken(): Hex | null {
    return addr(process.env.NEXT_PUBLIC_PLATFORM_TOKEN);
  },
  get disperse(): Hex | null {
    return addr(process.env.DISPERSE_ADDRESS);
  },
  get launchConfigId(): bigint {
    return BigInt(process.env.PONS_LAUNCH_CONFIG_ID ?? "0");
  },
  get creatorTaxBps(): number {
    return Number(process.env.CREATOR_TAX_BPS ?? "0");
  },
};

export function requireTreasury(): Hex {
  const t = ENV.treasury;
  if (!t) throw new Error("TREASURY_ADDRESS is not set");
  return t;
}

export const ADDR = {
  factory: PONS.factory as Hex,
  launchDeployer: PONS.launchDeployer as Hex,
  feeEscrow: PONS.feeEscrow as Hex,
  memeHook: PONS.memeHook as Hex,
  buybackVault: PONS.buybackVault as Hex,
  poolManager: V4.poolManager as Hex,
  universalRouter: V4.universalRouter as Hex,
  permit2: V4.permit2 as Hex,
  dead: "0x000000000000000000000000000000000000dEaD" as Hex,
  zero: zeroAddress as Hex,
  usdg: "0x5fc5360d0400a0fd4f2af552add042d716f1d168" as Hex,
};

/** Default slippage applied on top of an exact simulated/curve quote. */
export const SLIPPAGE_BPS = 100n;
