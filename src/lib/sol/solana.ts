import { Connection, PublicKey, VersionedTransaction, type Commitment } from "@solana/web3.js";

/**
 * Solana plumbing shared by the swap module. No Next.js, no database: this folder is meant to be
 * dropped into another MCP (Just Ask) as-is.
 */
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const LAMPORTS = 1_000_000_000;

let conn: Connection | undefined;
/** Helius (or any) RPC from HELIUS_RPC_URL; the public endpoint is a dev-only fallback. */
export function connection(): Connection {
  return (conn ??= new Connection(process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed"));
}

/** A base58 Solana address (mint or wallet). */
export const isAddress = (s: string) => {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false;
  try { new PublicKey(s); return true; } catch { return false; }
};

export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}`;
export const solscanToken = (mint: string) => `https://solscan.io/token/${mint}`;
export const solscanAccount = (a: string) => `https://solscan.io/account/${a}`;

/** Sends an already-signed transaction and waits for confirmation. Returns the signature. */
export async function sendSigned(signed: Uint8Array, lastValidBlockHeight: number, commitment: Commitment = "confirmed"): Promise<string> {
  const c = connection();
  const blockhash = VersionedTransaction.deserialize(signed).message.recentBlockhash;
  const sig = await c.sendRawTransaction(signed, { skipPreflight: true, maxRetries: 3 });
  const res = await c.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, commitment);
  if (res.value.err) throw new SwapError(`The swap failed on chain (${JSON.stringify(res.value.err).slice(0, 120)}). ${solscanTx(sig)}`);
  return sig;
}

export class SwapError extends Error {}
