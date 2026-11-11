// Is a ticker free on Pons? Reads every TokenLaunched from the factory, then symbol() of each token (multicall).
import { parseAbi } from "viem";
import { readClient } from "../src/lib/rh/rpc";
import { client } from "../src/lib/stocks/chain";
import { getLogsChunked } from "../src/lib/rh/util";
import { factoryAbi } from "../src/lib/rh/abis";
import { ADDR } from "../src/lib/rh/config";
const want = process.argv.slice(2).map((s) => s.toUpperCase());
const ev = factoryAbi.find((x: any) => x.type === "event" && x.name === "TokenLaunched") as any;
const to = await readClient.getBlockNumber();
const logs = await getLogsChunked({ address: ADDR.factory, event: ev, fromBlock: 0n, toBlock: to });
const tokens = (logs as any[]).map((l) => l.args.token);
console.log("launches", tokens.length);
const abi = parseAbi(["function symbol() view returns (string)"]);
const hits: Record<string, number> = Object.fromEntries(want.map((w) => [w, 0]));
const chunks: any[][] = []; for (let i = 0; i < tokens.length; i += 1000) chunks.push(tokens.slice(i, i + 1000));
let done = 0;
const work = async () => { for (let c = chunks.shift(); c; c = chunks.shift()) {
  const r = await client.multicall({ contracts: c.map((address: any) => ({ address, abi, functionName: "symbol" })) }).catch(() => []);
  for (const x of r as any[]) if (x.status === "success") { const s = String(x.result).toUpperCase().replace(/^\$/, ""); if (s in hits) hits[s]++; }
  if (++done % 50 === 0) console.log("chunks", done, JSON.stringify(hits));
} };
await Promise.all(Array.from({ length: 12 }, work));
console.log("FINAL", hits);
