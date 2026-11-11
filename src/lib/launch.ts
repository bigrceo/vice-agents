import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { decodeEventLog, encodeFunctionData, toHex, type Hex } from "viem";
import { BRAND, SITE_URL } from "./brand";
import { db, schema } from "./db";
import { checksum, dryRun, isEvmAddress, platformAccount, platformWallet } from "./evm";
import { readClient } from "./rh/rpc";
import { factoryAbi } from "./rh/abis";
import { ADDR, ENV } from "./rh/config";

export type LaunchInput = {
  name: string; ticker: string; description?: string; sourceUrl?: string;
  stillRef: string; loopRef?: string;
  recipient: string;            // creator-fee recipient (EVM)
  twitter?: string; website?: string;
  mapU?: number; mapV?: number;     // where the clip happens in Leonida (0..1 of the map image)
};

const PER_IP = Number(process.env.LAUNCHES_PER_IP_PER_DAY ?? 5);
const ipHits = new Map<string, number[]>();

export function validate(i: LaunchInput) {
  const name = i.name?.trim();
  const ticker = i.ticker?.replace(/^\$/, "").trim().toUpperCase();
  if (!name || name.length > 32) throw new Error("Name must be 1 to 32 characters.");
  if (!/^[A-Z0-9]{1,10}$/.test(ticker)) throw new Error("Ticker must be 1 to 10 letters or numbers.");
  if (!isEvmAddress(i.recipient)) throw new Error("Paste a valid 0x address for the creator fees, or connect a wallet.");
  const okRef = (r?: string) => !r || r.startsWith("local:drafts/") || /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/drafts\//.test(r);
  if (!i.stillRef || !okRef(i.stillRef) || !okRef(i.loopRef)) throw new Error("Pick the square of your clip first.");
  const mapU = i.mapU == null ? undefined : Number(i.mapU), mapV = i.mapV == null ? undefined : Number(i.mapV);
  if ((mapU != null || mapV != null) && !(mapU! >= 0 && mapU! <= 1 && mapV! >= 0 && mapV! <= 1)) throw new Error("Bad map position.");
  return { ...i, name, ticker, recipient: checksum(i.recipient), mapU, mapV };
}
type Valid = ReturnType<typeof validate>;

async function rateLimit(ip?: string) {
  if (!ip) return;
  const d = db();
  if (d) {
    const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(schema.coins)
      .where(and(eq(schema.coins.ip, ip), gt(schema.coins.createdAt, sql`now() - interval '1 day'`)));
    if (n >= PER_IP) throw new Error(`You've launched ${PER_IP} coins today. Come back tomorrow.`);
    return;
  }
  const now = Date.now(), hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 86_400_000);
  if (hits.length >= PER_IP) throw new Error(`You've launched ${PER_IP} coins today. Come back tomorrow.`);
  hits.push(now); ipHits.set(ip, hits);
}

const publicUrl = (ref: string) => ref.startsWith("http") ? ref : `${SITE_URL}/api/drafts/file?ref=${encodeURIComponent(ref)}`;

/** Calldata for factory.launchToken: creator gets the creator fees, no buyback, Pons config 0. */
async function buildCall(i: Valid) {
  const configId = ENV.launchConfigId;
  const [launchFee, economics] = await Promise.all([
    readClient.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: "launchFee" }),
    readClient.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: "previewLaunchEconomics", args: [configId, ADDR.zero] }),
  ]);
  const params = {
    name: i.name, symbol: i.ticker, logo: publicUrl(i.stillRef),
    description: i.description?.trim() || `${i.name}, a ${BRAND.state} clip coin launched on ${BRAND.name}.`,
    socials: { twitter: i.twitter ?? "", telegram: "", discord: "", website: i.website || i.sourceUrl || SITE_URL, farcaster: "" },
    creatorFeeRecipient: i.recipient as Hex, creatorTaxBps: ENV.creatorTaxBps, buybackEnabled: false,
    expectedEconomics: economics, salt: toHex(crypto.getRandomValues(new Uint8Array(32))),
  } as const;
  const data = encodeFunctionData({ abi: factoryAbi, functionName: "launchToken", args: [params, configId, ADDR.zero] });
  return { to: ADDR.factory, data, value: launchFee };
}

/** Can the platform wallet pay a launch right now? (Pons fee + gas, with margin) */
export async function sponsorStatus() {
  const acct = platformAccount();
  const launchFee = await readClient.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: "launchFee" });
  const gasPrice = await readClient.getGasPrice();
  const need = launchFee + gasPrice * 9_000_000n * 2n;
  if (!acct) return { address: null, balance: 0n, need, launchFee, ok: false };
  const balance = await readClient.getBalance({ address: acct.address });
  return { address: acct.address, balance, need, launchFee, ok: balance >= need };
}

/**
 * Sponsored: the platform wallet sends launchToken and pays fee + gas (no wallet needed).
 * When it can't (unset or empty), returns the exact tx for the creator's wallet to send itself.
 */
export async function prepareLaunch(raw: LaunchInput, ip?: string) {
  const i = validate(raw);
  await rateLimit(ip);
  const call = await buildCall(i);
  const s = await sponsorStatus();
  const wallet = platformWallet();
  if (dryRun()) {
    const from = (s.address ?? i.recipient) as Hex;
    const sim = await readClient.call({ account: from, ...call, stateOverride: [{ address: from, balance: 10n ** 18n }] }).then(() => "ok").catch((e: Error) => e.message.slice(0, 200));
    return { dryRun: true, simulation: sim, sponsored: s.ok };
  }
  if (!s.ok || !wallet) return { sponsored: false, tx: { to: call.to, data: call.data, value: call.value.toString() }, payload: i };
  const hash = await wallet.sendTransaction({ ...call, chain: wallet.chain });
  const coin = await recordLaunch(hash, i, true, ip);
  return { sponsored: true, mint: coin.mint, sig: hash };
}

/** Reads the TokenLaunched event of a sent tx and stores the coin. */
export async function recordLaunch(hash: Hex, i: Valid, sponsored: boolean, ip?: string) {
  const rc = await readClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (rc.status !== "success") throw new Error("The launch failed on chain.");
  let token: string | null = null, curve = "", deployer = "";
  for (const log of rc.logs) {
    if (log.address.toLowerCase() !== ADDR.factory.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "TokenLaunched") { const a = ev.args as any; token = a.token; curve = a.curve; deployer = a.deployer; }
    } catch { /* other event */ }
  }
  if (!token) throw new Error("No Pons launch in that transaction.");
  const rec = {
    mint: checksum(token), curve, deployer, name: i.name, ticker: i.ticker, description: i.description ?? null, sourceUrl: i.sourceUrl ?? null,
    still: publicUrl(i.stillRef), loop: i.loopRef ? publicUrl(i.loopRef) : null, creator: i.recipient, sponsored, tx: hash,
    block: rc.blockNumber.toString(), ip: ip ?? null, mapU: i.mapU ?? null, mapV: i.mapV ?? null,
  };
  const d = db();
  if (d) await d.insert(schema.coins).values(rec).onConflictDoNothing();
  else console.warn("[launch] no DATABASE_URL: coin not stored", rec.mint);
  return rec;
}
