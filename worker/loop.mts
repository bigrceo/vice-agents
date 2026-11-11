/**
 * The agent loop (Railway): every tick the locals of Leonida walk the map, think, talk to each other and trade.
 * Prices are real (Robinhood Chain v4 quoter for tokenized stocks, Pons curves/pools for coins).
 * Trades are paper until REAL_TRADING=1 and the agent's own wallet holds MIN_REAL_ETH.
 */
import postgres from "postgres";
import { mnemonicToAccount } from "viem/accounts";
import { createWalletClient, formatEther, http, parseEther, type Address, type Hex } from "viem";
import { CAST, type Agent } from "../src/lib/agents/cast";
import { DISTRICTS } from "../src/components/map/districts";
import { STOCKS, bestRoute } from "../src/lib/stocks/route";
import { client, robinhood, ZERO } from "../src/lib/stocks/chain";
import { realSwap } from "../src/lib/stocks/exec";
import { getMarket, ethUsd } from "../src/lib/rh/market";
import { getLogsChunked } from "../src/lib/rh/util";
import { readClient } from "../src/lib/rh/rpc";
import { factoryAbi } from "../src/lib/rh/abis";
import { ADDR } from "../src/lib/rh/config";

const sql = postgres(process.env.DATABASE_URL!, { max: 2, prepare: false, onnotice: () => {} });
const MODEL = process.env.LLM_MODEL || "google/gemini-2.5-flash";
const START_ETH = 0.05;                         // paper bankroll, same size as a funded real wallet
const MIN_REAL_ETH = +(process.env.MIN_REAL_ETH || 0.01);
const REAL = process.env.REAL_TRADING === "1";
const STEP_MS = 4_000, THINK_MS = +(process.env.THINK_MS || 20_000), PRICE_MS = 120_000;
const UNIVERSE = ["SPY", "QQQ", "VTI", "NVDA", "TSLA", "AAPL", "MSFT", "GOOGL", "META", "AMZN", "AVGO", "TSM", "SMH", "COIN", "PLTR", "NFLX", "XOM", "USO", "GLD", "SLV", "RKLB", "ASTS", "SMCI", "INTC", "BA", "LLY", "CCL", "UNH"];

const account = (a: Agent) => mnemonicToAccount(process.env.AGENT_MNEMONIC!, { addressIndex: a.index });

async function schema() {
  await sql`create table if not exists la_agents (id text primary key, address text not null, u double precision, v double precision, tu double precision, tv double precision,
    district text, mood text, thought text, cash double precision not null, mode text not null default 'paper', updated_at timestamptz default now())`;
  await sql`create table if not exists la_positions (agent_id text, symbol text, kind text, token text, qty double precision, cost double precision, primary key (agent_id, symbol))`;
  await sql`create table if not exists la_events (id bigserial primary key, agent_id text, kind text, text text, to_agent text, district text, at timestamptz default now())`;
  await sql`create table if not exists la_trades (id bigserial primary key, agent_id text, side text, symbol text, kind text, token text, qty double precision, price double precision,
    eth double precision, reason text, mode text, tx text, at timestamptz default now())`;
  await sql`create table if not exists la_prices (symbol text primary key, kind text, token text, name text, price double precision, open double precision, mcap_usd double precision, updated_at timestamptz default now())`;
  await sql`create table if not exists la_meta (k text primary key, v text)`;
  for (const a of CAST) {
    const d = DISTRICTS.find((x) => x.name === a.home)!;
    await sql`insert into la_agents (id, address, u, v, tu, tv, district, cash) values (${a.id}, ${account(a).address}, ${d.u}, ${d.v}, ${d.u}, ${d.v}, ${a.home}, ${START_ETH}) on conflict (id) do update set address = excluded.address`;
  }
}

// ---------------- prices ----------------
type Px = { symbol: string; kind: "stock" | "pons"; token: string; name: string; price: number; mcapUsd: number };
let PX = new Map<string, Px>();
let ETH_USD = 0;
const PROBE = parseEther("0.005");

async function stockPrices() {
  const out: Px[] = [];
  for (const sym of UNIVERSE) {
    const st = STOCKS.find((s) => s.symbol === sym); if (!st) continue;
    const r = await bestRoute(ZERO, st.address, PROBE, {}).catch(() => null);
    if (r && r.out > 0n) out.push({ symbol: sym, kind: "stock", token: st.address, name: sym, price: 0.005 / (Number(r.out) / 10 ** st.decimals), mcapUsd: 0 });
  }
  return out;
}

let ponsCache: { at: number; list: Address[] } = { at: 0, list: [] };
async function ponsPrices() {
  if (Date.now() - ponsCache.at > 15 * 60_000) {
    const to = await readClient.getBlockNumber();
    const ev = factoryAbi.find((x) => x.type === "event" && x.name === "TokenLaunched") as any;
    const logs = await getLogsChunked({ address: ADDR.factory, event: ev, fromBlock: to - 3_000_000n, toBlock: to }).catch(() => []);
    ponsCache = { at: Date.now(), list: [...new Set((logs as any[]).map((l) => l.args.token as Address))].slice(-250) };
  }
  const ms = await Promise.all(ponsCache.list.map((t) => getMarket(t).catch(() => null)));
  return ms.filter((m) => m && m.mcapUsd && m.liquidityEth > 0.2 && m.symbol)
    .sort((a, b) => b!.mcapUsd! - a!.mcapUsd!).slice(0, 8)
    .map((m) => ({ symbol: String(m!.symbol).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10), kind: "pons" as const, token: m!.token, name: m!.name ?? "", price: m!.priceEth, mcapUsd: m!.mcapUsd! }));
}

async function refreshPrices() {
  const [s, p, e] = await Promise.all([stockPrices(), ponsPrices().catch((err) => { console.error("pons", err.message); return []; }), ethUsd()]);
  if (e) ETH_USD = e.price;
  const all = [...s, ...p];
  if (!all.length) return;
  // keep coins agents already hold, even if they fell out of the top 8
  const held = await sql`select distinct symbol, kind, token from la_positions where qty > 0 and kind = 'pons'`;
  for (const h of held) if (!all.some((x) => x.symbol === h.symbol)) {
    const m = await getMarket(h.token).catch(() => null);
    if (m) all.push({ symbol: h.symbol, kind: "pons", token: h.token, name: m.name ?? "", price: m.priceEth, mcapUsd: m.mcapUsd ?? 0 });
  }
  PX = new Map(all.map((x) => [x.symbol, x]));
  for (const x of all) await sql`insert into la_prices (symbol, kind, token, name, price, open, mcap_usd) values (${x.symbol}, ${x.kind}, ${x.token}, ${x.name}, ${x.price}, ${x.price}, ${x.mcapUsd})
    on conflict (symbol) do update set price = excluded.price, mcap_usd = excluded.mcap_usd, updated_at = now()`;
  await sql`insert into la_meta (k, v) values ('eth_usd', ${String(ETH_USD)}) on conflict (k) do update set v = excluded.v`;
  console.log(`prices: ${s.length} stocks, ${p.length} pons, ETH $${ETH_USD.toFixed(0)}`);
}

// ---------------- movement ----------------
async function walk() {
  const rows = await sql`select id, u, v, tu, tv from la_agents`;
  for (const r of rows) {
    const dx = r.tu - r.u, dv = r.tv - r.v, d = Math.hypot(dx, dv);
    let u = r.u, v = r.v;
    if (d > 0.004) { const s = Math.min(1, 0.012 / d); u += dx * s; v += dv * s; }
    else { u = r.tu + (Math.random() - 0.5) * 0.006; v = r.tv + (Math.random() - 0.5) * 0.006; } // loiter
    await sql`update la_agents set u = ${u}, v = ${v}, updated_at = now() where id = ${r.id}`;
  }
}

// ---------------- minds ----------------
async function llm(system: string, user: string) {
  let txt = "";
  if (process.env.ANTHROPIC_API_KEY) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.LLM_MODEL || "claude-haiku-5-5", max_tokens: 1500, system, messages: [{ role: "user", content: user }] }),
    });
    const j: any = await r.json();
    txt = j.content?.find((c: any) => c.type === "text")?.text ?? JSON.stringify(j.error ?? j);
  } else {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Leonida agents" },
      body: JSON.stringify({ model: MODEL, temperature: 0.9, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    });
    const j: any = await r.json();
    txt = j.choices?.[0]?.message?.content ?? JSON.stringify(j.error ?? j);
  }
  return JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
}

const fmt = (n: number) => n >= 1 ? n.toFixed(2) : n.toPrecision(3);

async function think(a: Agent) {
  const [me] = await sql`select * from la_agents where id = ${a.id}`;
  const pos = await sql`select * from la_positions where agent_id = ${a.id} and qty > 0`;
  const others = await sql`select id, district from la_agents where id <> ${a.id}`;
  const near = others.filter((o) => o.district === me.district).map((o) => o.id);
  const heard = await sql`select agent_id, kind, text, to_agent from la_events where kind in ('say','trade') and at > now() - interval '15 minutes' order by id desc limit 8`;
  const opens = new Map((await sql`select symbol, open from la_prices`).map((r) => [r.symbol, r.open]));
  const market = [...PX.values()].map((x) => `${x.symbol} (${x.kind === "pons" ? "Pons coin" + (x.mcapUsd ? ` mcap $${Math.round(x.mcapUsd / 1000)}k` : "") : "stock"}) ${fmt(x.price)} ETH, ${(((x.price / (opens.get(x.symbol) || x.price)) - 1) * 100).toFixed(1)}% since tracked`).join("\n");
  const book = pos.map((p) => { const px = PX.get(p.symbol)?.price ?? 0; return `${p.symbol}: ${fmt(p.qty)} units, cost ${fmt(p.cost)} ETH, now ${fmt(p.qty * px)} ETH`; }).join("\n") || "nothing";
  const names = Object.fromEntries(CAST.map((c) => [c.id, c.name]));
  const system = `You are ${a.name}, ${a.role} in Leonida (a Florida-like state: Vice City, the Keys, swamps). ${a.persona}
You live on a map and trade real tokenized stocks and Pons memecoins on Robinhood Chain. Style: ${a.style}. Favourite names: ${a.likes.join(", ")} (PONS = any Pons memecoin).
Stay in character, English, short and punchy, no hashtags, no emojis. Never mention being an AI. Never say GTA or Rockstar.
Answer ONLY JSON: {"thought": "<inner thought, max 140 chars>", "say": {"to": "<agent id or null>", "text": "<line said out loud, max 140 chars>"} | null,
"move_to": "<one of: ${a.haunts.join(", ")}> | null", "trade": {"side": "buy"|"sell", "symbol": "<symbol from the market list>", "pct": <1-60, % of cash for buys or % of position for sells>, "reason": "<why, in character, max 160 chars>"} | null}
Trade at most when it makes sense for you; holding is fine. Agent ids: ${CAST.filter((c) => c.id !== a.id).map((c) => `${c.id}=${c.name} (${c.role})`).join(", ")}.`;
  const user = `You are in ${me.district}. Nearby: ${near.map((n) => names[n]).join(", ") || "nobody"}.
Cash: ${fmt(me.cash)} ETH (ETH = $${ETH_USD.toFixed(0)}). Holdings:\n${book}
Market now:\n${market}
Recently heard in town:\n${heard.reverse().map((h) => `${names[h.agent_id]}${h.to_agent ? ` to ${names[h.to_agent]}` : ""}: ${h.text}`).join("\n") || "quiet"}`;
  const out = await llm(system, user);

  if (out.thought) await sql`insert into la_events (agent_id, kind, text, district) values (${a.id}, 'thought', ${String(out.thought).slice(0, 200)}, ${me.district})`;
  if (out.say?.text) {
    const to = CAST.some((c) => c.id === out.say.to) ? out.say.to : null;
    await sql`insert into la_events (agent_id, kind, text, to_agent, district) values (${a.id}, 'say', ${String(out.say.text).slice(0, 200)}, ${to}, ${me.district})`;
  }
  if (out.move_to && a.haunts.includes(out.move_to) && out.move_to !== me.district) {
    const d = DISTRICTS.find((x) => x.name === out.move_to)!;
    await sql`update la_agents set tu = ${d.u + (Math.random() - 0.5) * 0.01}, tv = ${d.v + (Math.random() - 0.5) * 0.01}, district = ${d.name} where id = ${a.id}`;
    await sql`insert into la_events (agent_id, kind, text, district) values (${a.id}, 'move', ${`heads to ${d.name}`}, ${d.name})`;
  }
  await sql`update la_agents set thought = ${String(out.thought ?? "").slice(0, 200)} where id = ${a.id}`;
  if (out.trade?.symbol) await trade(a, me, pos, out.trade).catch((e) => console.error(a.id, "trade", e.message));
}

async function trade(a: Agent, me: any, pos: any[], t: { side: string; symbol: string; pct: number; reason: string }) {
  const sym = String(t.symbol).replace(/^\$/, "").toUpperCase();
  const px = PX.get(sym); if (!px || !(px.price > 0)) return;
  const pct = Math.max(1, Math.min(60, +t.pct || 10)) / 100;
  const held = pos.find((p) => p.symbol === sym);
  const acct = account(a);
  const bal = REAL ? Number(formatEther(await client.getBalance({ address: acct.address }))) : 0;
  const mode = REAL && bal >= MIN_REAL_ETH ? "real" : "paper";
  let qty: number, eth: number, tx: string | null = null;
  if (t.side === "buy") {
    eth = (mode === "real" ? Math.max(0, bal - 0.002) : me.cash) * pct; if (eth < 0.0005) return; // real: size on the wallet, keep 0.002 ETH for gas
    qty = eth / px.price;
    if (mode === "real") tx = await sendReal(a, px, "buy", parseEther(eth.toFixed(18)));
    await sql`update la_agents set cash = cash - ${eth} where id = ${a.id}`;
    await sql`insert into la_positions (agent_id, symbol, kind, token, qty, cost) values (${a.id}, ${sym}, ${px.kind}, ${px.token}, ${qty}, ${eth})
      on conflict (agent_id, symbol) do update set qty = la_positions.qty + excluded.qty, cost = la_positions.cost + excluded.cost`;
  } else {
    if (!held || held.qty <= 0) return;
    qty = held.qty * (pct >= 0.55 ? 1 : pct); eth = qty * px.price;
    if (mode === "real") tx = await sendReal(a, px, "sell", BigInt(Math.floor(qty * 1e18)));
    await sql`update la_agents set cash = cash + ${eth} where id = ${a.id}`;
    await sql`update la_positions set qty = qty - ${qty}, cost = cost * (1 - ${qty / held.qty}) where agent_id = ${a.id} and symbol = ${sym}`;
  }
  await sql`insert into la_trades (agent_id, side, symbol, kind, token, qty, price, eth, reason, mode, tx) values (${a.id}, ${t.side}, ${sym}, ${px.kind}, ${px.token}, ${qty}, ${px.price}, ${eth}, ${String(t.reason ?? "").slice(0, 220)}, ${mode}, ${tx})`;
  await sql`insert into la_events (agent_id, kind, text, district) values (${a.id}, 'trade', ${`${t.side === "buy" ? "bought" : "sold"} ${eth.toFixed(4)} ETH of $${sym}: ${String(t.reason ?? "").slice(0, 160)}`}, ${me.district})`;
  await sql`update la_agents set mode = ${mode} where id = ${a.id}`;
  console.log(`${a.id} ${mode} ${t.side} ${sym} ${eth.toFixed(4)} ETH`);
}

async function sendReal(a: Agent, px: Px, side: "buy" | "sell", amount: bigint) {
  const acct = account(a);
  const w = createWalletClient({ account: acct, chain: robinhood, transport: http() });
  return realSwap({ kind: px.kind, token: px.token as Address, side, amount, owner: acct.address, send: (s) => w.sendTransaction({ to: s.to, data: s.data as Hex, value: s.value }) });
}

// ---------------- main ----------------
async function main() {
  if (!process.env.AGENT_MNEMONIC) throw new Error("AGENT_MNEMONIC missing");
  await schema();
  await refreshPrices();
  setInterval(() => refreshPrices().catch((e) => console.error("prices", e.message)), PRICE_MS);
  setInterval(() => walk().catch((e) => console.error("walk", e.message)), STEP_MS);
  let i = Math.floor(Math.random() * CAST.length);
  const tick = async () => {
    const a = CAST[i++ % CAST.length];
    const t0 = Date.now(); await think(a).catch((e) => console.error(a.id, "think", e.message)); console.log(a.id, "thought in", Date.now() - t0, "ms");
    await sql`delete from la_events where id < (select max(id) - 5000 from la_events)`;
    setTimeout(tick, THINK_MS);
  };
  tick();
  console.log(`agents up · ${process.env.ANTHROPIC_API_KEY ? "anthropic" : MODEL} · ${REAL ? "REAL trading armed (min " + MIN_REAL_ETH + " ETH)" : "paper trading"}`);
}
main();
