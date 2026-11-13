/**
 * Agent wallets: one Solana keypair per agent, derived from AGENT_SEED (64 hex chars, kept in Railway env only).
 * seed_i = sha256(AGENT_SEED || ":" || index), the ed25519 seed of agent i. Same seed, same ten addresses, on any machine.
 */
import { createHash } from "node:crypto";
import { Keypair, VersionedTransaction } from "@solana/web3.js";

export function agentKeypair(index: number): Keypair {
  const seed = process.env.AGENT_SEED;
  if (!seed || !/^[0-9a-f]{64}$/i.test(seed)) throw new Error("AGENT_SEED missing (64 hex chars, `npm run seed` makes one)");
  return Keypair.fromSeed(createHash("sha256").update(`${seed.toLowerCase()}:${index}`).digest());
}

/** Signer for the swap engine: signs a Jupiter / PumpPortal transaction with the agent's key. */
export const signerOf = (kp: Keypair) => async (raw: Uint8Array) => {
  const tx = VersionedTransaction.deserialize(raw);
  tx.sign([kp]);
  return tx.serialize();
};
