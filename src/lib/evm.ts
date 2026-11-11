import "server-only";
import { createWalletClient, defineChain, getAddress, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN } from "./rh/net";

export const robinhood = defineChain({
  id: CHAIN.id, name: CHAIN.name, nativeCurrency: CHAIN.nativeCurrency,
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || CHAIN.rpcUrl] } },
  blockExplorers: { default: { name: "Blockscout", url: CHAIN.explorer } },
});

/** The platform wallet: pays the Pons launch fee + gas of sponsored launches. Never holds user funds. */
export function platformAccount() {
  const k = process.env.PLATFORM_PRIVATE_KEY?.trim();
  if (!k) return null;
  return privateKeyToAccount((k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`);
}
export function platformWallet() {
  const account = platformAccount();
  if (!account) return null;
  return createWalletClient({ account, chain: robinhood, transport: http(process.env.PLATFORM_RPC_URL || "https://robinhood-rpc.publicnode.com") });
}
export const isEvmAddress = (s: unknown): s is string => typeof s === "string" && isAddress(s.trim());
export const checksum = (s: string) => getAddress(s.trim()) as `0x${string}`;
export const dryRun = () => process.env.LAUNCH_DRY_RUN === "1";
