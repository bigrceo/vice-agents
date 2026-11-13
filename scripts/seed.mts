// Prints a fresh AGENT_SEED and the ten agent addresses it gives. Nothing is written anywhere: paste the seed into Railway yourself.
import { randomBytes } from "node:crypto";
import { CAST } from "../src/lib/agents/cast";
const seed = process.env.AGENT_SEED || randomBytes(32).toString("hex");
process.env.AGENT_SEED = seed;
const { agentKeypair } = await import("../src/lib/sol/wallets");
console.log(`AGENT_SEED=${seed}\n`);
for (const a of CAST) console.log(a.id.padEnd(8), agentKeypair(a.index).publicKey.toBase58());
