/**
 * The agent loop (Railway): every tick the locals of Leonida walk the map, think, talk to each other and trade.
 * Prices are real (Jupiter for xStocks and pump.fun coins, pump.fun curve progress read on chain).
 * Trades are paper until REAL_TRADING=1 and the agent's own Solana wallet holds MIN_REAL_SOL; real trades go through Jupiter
 * (PumpPortal for fresh curve coins Jupiter can't route yet), signed by the agent's own keypair.
 * Amounts are SOL. Column names (`cash`, `eth`) are kept from the Robinhood build.
 */
import postgres from "postgres";
import { PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction } from "@solana/spl-token";
import { CAST, type Agent } from "../src/lib/agents/cast";
import { SECTORS, sectorOf } from "../src/lib/agents/sectors";
import { DISTRICTS } from "../src/components/map/districts";
import { stocks, pumpCoins, byMints, solUsd, curveProgress, type Mkt } from "../src/lib/sol/market";
import { planSwap, executePlan } from "../src/lib/sol/index";
import { connection, LAMPORTS } from "../src/lib/sol/solana";
import { tokenByMint } from "../src/lib/sol/tokens";
import { agentKeypair, signerOf } from "../src/lib/sol/wallets";

const sql = postgres(process.env.DATABASE_URL!, { max: 2, prepare: false, onnotice: () => {} });
const MODEL = process.env.LLM_MODEL || "google/gemini-2.5-flash";
const START_SOL = 0.5;                          // paper bankroll
const MIN_REAL_SOL = +(process.env.MIN_REAL_SOL || 0.1);
const FEE_RESERVE = 0.01;                       // kept for fees and token-account rent
const REAL = process.env.REAL_TRADING === "1";
const STEP_MS = 4_000, THINK_MS = +(process.env.THINK_MS || 20_000), PRICE_MS = 120_000;

const account = (a: Agent) => agentKeypair(a.index);

async function schema() {
  await sql`create table if not exists la_agents (id text primary key, address text not null, u double precision, v double precision, tu double precision, tv double precision,
    district text, mood text, thought text, cash double precision not null, mode text not null default 'paper', updated_at timestamptz default now())`;
  await sql`create table if not exists la_positions (agent_id text, symbol text, kind text, token text, qty double precision, cost double precision, primary key (agent_id, symbol))`;
  await sql`create table if not exists la_events (id bigserial primary key, agent_id text, kind text, text text, to_agent text, district text, at timestamptz default now())`;
  await sql`create table if not exists la_trades (id bigserial primary key, agent_id text, side text, symbol text, kind text, token text, qty double precision, price double precision,
    eth double precision, reason text, mode text, tx text, at timestamptz default now())`;
  await sql`create table if not exists la_prices (symbol text primary key, kind text, token text, name text, price double precision, open double precision, mcap_usd double precision, updated_at timestamptz default now())`;
  await sql`create table if not exists la_meta (k text primary key, v text)`;
  await sql`alter table la_prices add column if not exists liq double precision`;
  await sql`alter table la_prices add column if not exists fresh boolean default false`;
  await sql`alter table la_prices add column if not exists logo text`;
  await sql`alter table la_prices add column if not exists progress double precision`;
  await sql`alter table la_prices add column if not exists graduated boolean default false`;
  for (const a of CAST) {
    const d = DISTRICTS.find((x) => x.name === a.home)!;
    await sql`insert into la_agents (id, address, u, v, tu, tv, district, cash) values (${a.id}, ${account(a).publicKey.toBase58()}, ${d.u}, ${d.v}, ${d.u}, ${d.v}, ${a.home}, ${START_SOL}) on conflict (id) do update set address = excluded.address`;
  }
}

// ---------------- prices ----------------
type Px = { symbol: string; kind: "stock" | "pump"; token: string; name: string; logo: string; decimals: number; price: number; mcapUsd: number; liq: number; fresh?: boolean; progress?: number; graduated?: boolean };
/** Paper fills move the price like a constant-product pool of `liq` SOL would: no free exits from thin coins. */
const fillIn = (sol: number, x: Px) => (sol / x.price) * (x.liq / (x.liq + sol));
const fillOut = (qty: number, x: Px) => { const v = qty * x.price; return v * (x.liq / (x.liq + v)); };
let PX = new Map<string, Px>();
let SOL_USD = 0;

const toPx = (m: Mkt, fresh = false): Px => ({ symbol: m.symbol, kind: m.kind, token: m.mint, name: m.name, logo: m.logo, decimals: m.decimals, price: m.priceSol, mcapUsd: m.mcapUsd, liq: m.liqSol, fresh, graduated: m.graduated });

/** Ask the site for every new coin's logo once: the proxy stores a thumbnail in la_logos, so visitors never wait on IPFS. */
const warmed = new Set<string>();
async function warmLogos() {
  const site = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://viceagents.fun";
  const rows = await sql`select distinct token from la_prices where kind = 'pump'`;
  for (const { token } of rows) {
    if (warmed.has(token)) continue;
    const r = await fetch(`${site}/api/img?mint=${token}`, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (r && (r.ok || r.status === 404)) warmed.add(token);   // a failed fetch is retried on the next refresh
  }
}

async function refreshPrices() {
  const sol = await solUsd(); if (!sol) return;
  SOL_USD = sol;
  const [st, p] = await Promise.all([stocks(sol).catch((e) => { console.error("xstocks", e.message); return [] as Mkt[]; }), pumpCoins(sol).catch((e) => { console.error("pump", e.message); return []; })]);
  const all: Px[] = [...st.map((m) => toPx(m)), ...p.map((m) => toPx(m, m.fresh))];
  if (!all.length) return;
  // keep coins agents already hold, even if they fell out of the trenches list
  const held = await sql`select distinct symbol, token from la_positions where qty > 0 and kind = 'pump'`;
  const missing = held.filter((h) => !all.some((x) => x.token === h.token));
  for (const m of await byMints(missing.map((h) => h.token), sol).catch(() => [])) all.push({ ...toPx(m), symbol: missing.find((h) => h.token === m.mint)!.symbol });
  const prog = await curveProgress(all.filter((x) => x.kind === "pump").map((x) => x.token)).catch(() => new Map());
  for (const x of all) if (x.kind === "pump") { const c = prog.get(x.token); x.progress = c?.progress ?? (x.graduated ? 100 : 0); x.graduated = x.graduated || !!c?.complete; }
  PX = new Map(all.map((x) => [x.symbol, x]));
  for (const x of all) await sql`insert into la_prices (symbol, kind, token, name, price, open, mcap_usd, liq, fresh, logo, progress, graduated) values (${x.symbol}, ${x.kind}, ${x.token}, ${x.name}, ${x.price}, ${x.price}, ${x.mcapUsd}, ${x.liq}, ${!!x.fresh}, ${x.logo}, ${x.progress ?? null}, ${!!x.graduated})
    on conflict (symbol) do update set price = excluded.price, mcap_usd = excluded.mcap_usd, liq = excluded.liq, token = excluded.token, fresh = excluded.fresh, logo = excluded.logo, progress = excluded.progress, graduated = excluded.graduated, updated_at = now()`;
  await sql`delete from la_prices where kind = 'pump' and updated_at < now() - interval '30 minutes' and symbol not in (select symbol from la_positions where qty > 0)`;
  await sql`insert into la_meta (k, v) values ('sol_usd', ${String(SOL_USD)}) on conflict (k) do update set v = excluded.v`;
  console.log(`prices: ${st.length} xstocks, ${p.length} pump.fun, SOL $${SOL_USD.toFixed(0)}`);
  warmLogos().catch(() => {});
}

/** Where an agent goes next: mostly the district of something it holds (the map shows where the money sits), else one of its spots. */
async function nextStop(a: Agent) {
  const held = await sql`select symbol, kind from la_positions where agent_id = ${a.id} and qty > 0`;
  if (held.length && Math.random() < 0.65) { const h = held[Math.floor(Math.random() * held.length)]; return sectorOf(h.symbol, h.kind).district; }
  return a.haunts[Math.floor(Math.random() * a.haunts.length)];
}
async function goTo(a: Agent, to: string, why: string) {
  const d = DISTRICTS.find((x) => x.name === to); if (!d) return;
  await sql`update la_agents set tu = ${d.u + (Math.random() - 0.5) * 0.012}, tv = ${d.v + (Math.random() - 0.5) * 0.012}, district = ${to} where id = ${a.id}`;
  await sql`insert into la_events (agent_id, kind, text, district) values (${a.id}, 'move', ${why}, ${to})`;
}

async function walk() {
  const rows = await sql`select id, u, v, tu, tv, district from la_agents`;
  for (const r of rows) {
    // between thoughts they roam their usual spots, so the map is never still
    const a = CAST.find((c) => c.id === r.id)!;
    if (Math.hypot(r.tu - r.u, r.tv - r.v) < 0.004 && Math.random() < 0.035) {
      const to = await nextStop(a);
      if (to !== r.district) { const sec = SECTORS.find((x) => x.district === to); await goTo(a, to, `heads to ${to}${sec ? ` (${sec.name.toLowerCase()})` : ""}`); continue; }
    }
    const dx = r.tu - r.u, dv = r.tv - r.v, d = Math.hypot(dx, dv);
    let u = r.u, v = r.v;
    if (d > 0.004) { const s = Math.min(1, 0.008 / d); u += dx * s; v += dv * s; }
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
  // Each local works its own corner of the trenches: the coins it holds plus a personal draw (re-dealt every 10 minutes),
  // so ten agents don't all see, and all ape, the same hottest coin. Crowding is shown so they can avoid it.
  const held = new Set(pos.map((p) => p.symbol));
  const crowd = new Map((await sql`select symbol, count(distinct agent_id)::int n from la_positions where qty > 0 group by symbol`).map((r) => [r.symbol, r.n as number]));
  const slot = Math.floor(Date.now() / 600_000), rank = (sym: string) => [...`${a.id}:${slot}:${sym}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const pumpView = new Set([...held, ...[...PX.values()].filter((x) => x.kind === "pump" && !held.has(x.symbol)).sort((x, y) => rank(x.symbol) - rank(y.symbol)).slice(0, 6).map((x) => x.symbol)]);
  const market = SECTORS.map((sec) => {
    const rows = [...PX.values()].filter((x) => sectorOf(x.symbol, x.kind).id === sec.id && (x.kind !== "pump" || pumpView.has(x.symbol)));
    return rows.length ? `${sec.name} (district ${sec.district}):\n` + rows.map((x) => `  ${x.symbol}${x.fresh ? " FRESH LAUNCH" : ""}${x.kind === "pump" ? ` mcap $${Math.round(x.mcapUsd / 1000)}k, pool ${x.liq.toFixed(1)} SOL${x.graduated ? "" : `, curve ${Math.round(x.progress ?? 0)}%`}` : " (xStock)"} ${fmt(x.price)} SOL, ${(((x.price / (opens.get(x.symbol) || x.price)) - 1) * 100).toFixed(1)}% since tracked${crowd.get(x.symbol) ? `, ${crowd.get(x.symbol)} locals already hold it` : ""}`).join("\n") : "";
  }).filter(Boolean).join("\n");
  const book = pos.map((p) => { const px = PX.get(p.symbol)?.price ?? 0; return `${p.symbol}: ${fmt(p.qty)} units, cost ${fmt(p.cost)} SOL, now ${fmt(p.qty * px)} SOL`; }).join("\n") || "nothing";
  const names = Object.fromEntries(CAST.map((c) => [c.id, c.name]));
  const system = `You are ${a.name}, ${a.role} in Leonida (a Florida-like state: Vice City, the Keys, swamps). ${a.persona}
You live on a map and trade real tokenized stocks (xStocks) and pump.fun memecoins on Solana. The map is the market: ${SECTORS.map((x) => `${x.district} = ${x.name.toLowerCase()}`).join(", ")}. You walk to the district of what you trade.
The trenches matter most: fresh pump.fun launches are where a sharp call gets noticed, but thin pools punish size. Style: ${a.style}. Favourite names: ${a.likes.join(", ")} (PUMP = any pump.fun memecoin). You only see your own corner of the trenches: find your own coins. Piling into what the other locals already hold is how bagholders are made.
Stay in character, English, short and punchy, no hashtags, no emojis. Never mention being an AI. Never say GTA or Rockstar.
Answer ONLY JSON: {"thought": "<inner thought, max 140 chars>", "say": {"to": "<agent id or null>", "text": "<line said out loud, max 140 chars>"} | null,
"move_to": "<one of: ${[...new Set([...a.haunts, ...SECTORS.map((x) => x.district)])].join(", ")}> | null", "trade": {"side": "buy"|"sell", "symbol": "<symbol from the market list>", "pct": <1-60, % of cash for buys or % of position for sells>, "reason": "<why, in character, max 160 chars>"} | null}
Trade at most when it makes sense for you; holding is fine. Agent ids: ${CAST.filter((c) => c.id !== a.id).map((c) => `${c.id}=${c.name} (${c.role})`).join(", ")}.`;
  const user = `You are in ${me.district}. Nearby: ${near.map((n) => names[n]).join(", ") || "nobody"}.
Cash: ${fmt(me.cash)} SOL (SOL = $${SOL_USD.toFixed(0)}). Holdings:\n${book}
Market now:\n${market}
Recently heard in town:\n${heard.reverse().map((h) => `${names[h.agent_id]}${h.to_agent ? ` to ${names[h.to_agent]}` : ""}: ${h.text}`).join("\n") || "quiet"}`;
  const out = await llm(system, user);

  if (out.thought) await sql`insert into la_events (agent_id, kind, text, district) values (${a.id}, 'thought', ${String(out.thought).slice(0, 200)}, ${me.district})`;
  if (out.say?.text) {
    const to = CAST.some((c) => c.id === out.say.to) ? out.say.to : null;
    await sql`insert into la_events (agent_id, kind, text, to_agent, district) values (${a.id}, 'say', ${String(out.say.text).slice(0, 200)}, ${to}, ${me.district})`;
  }
  if (out.move_to && out.move_to !== me.district && !out.trade?.symbol && DISTRICTS.some((x) => x.name === out.move_to)) await goTo(a, out.move_to, `heads to ${out.move_to}`);
  await sql`update la_agents set thought = ${String(out.thought ?? "").slice(0, 200)} where id = ${a.id}`;
  if (out.trade?.symbol) await trade(a, me, pos, out.trade).catch((e) => console.error(a.id, "trade", e.message));
}

async function trade(a: Agent, me: any, pos: any[], t: { side: string; symbol: string; pct: number; reason: string }) {
  const sym = String(t.symbol).replace(/^\$/, "").toUpperCase();
  const px = PX.get(sym); if (!px || !(px.price > 0)) return;
  const pct = Math.max(1, Math.min(60, +t.pct || 10)) / 100;
  const held = pos.find((p) => p.symbol === sym);
  const kp = account(a);
  const bal = REAL ? (await connection().getBalance(kp.publicKey)) / LAMPORTS : 0;
  const mode = REAL && bal >= MIN_REAL_SOL ? "real" : "paper";
  let qty: number, sol: number, tx: string | null = null;
  if (t.side === "buy") {
    sol = (mode === "real" ? Math.max(0, bal - FEE_RESERVE) : me.cash) * pct;
    if (px.kind === "pump") sol = Math.min(sol, px.liq * 0.02);   // never more than 2% of a coin's pool
    if (sol < 0.005) return;
    qty = fillIn(sol, px);
    if (mode === "real") ({ tx, qty, sol } = await sendReal(a, px, "buy", sol));
    await sql`update la_agents set cash = cash - ${sol} where id = ${a.id}`;
    await sql`insert into la_positions (agent_id, symbol, kind, token, qty, cost) values (${a.id}, ${sym}, ${px.kind}, ${px.token}, ${qty}, ${sol})
      on conflict (agent_id, symbol) do update set qty = la_positions.qty + excluded.qty, cost = la_positions.cost + excluded.cost`;
  } else {
    if (!held || held.qty <= 0) return;
    qty = held.qty * (pct >= 0.55 ? 1 : pct); sol = fillOut(qty, px);
    if (mode === "real") ({ tx, qty, sol } = await sendReal(a, px, "sell", qty, pct >= 0.55));
    await sql`update la_agents set cash = cash + ${sol} where id = ${a.id}`;
    await sql`update la_positions set qty = greatest(0, qty - ${qty}::float8), cost = cost * greatest(0, 1 - ${qty / held.qty}::float8) where agent_id = ${a.id} and symbol = ${sym}`;
  }
  await sql`insert into la_trades (agent_id, side, symbol, kind, token, qty, price, eth, reason, mode, tx) values (${a.id}, ${t.side}, ${sym}, ${px.kind}, ${px.token}, ${qty}, ${sol / qty}, ${sol}, ${String(t.reason ?? "").slice(0, 220)}, ${mode}, ${tx})`;
  await sql`insert into la_events (agent_id, kind, text, district) values (${a.id}, 'trade', ${`${t.side === "buy" ? "bought" : "sold"} ${sol.toFixed(3)} SOL of $${sym}: ${String(t.reason ?? "").slice(0, 160)}`}, ${me.district})`;
  await sql`update la_agents set mode = ${mode} where id = ${a.id}`;
  const sec = sectorOf(sym, px.kind);
  if (sec.district !== me.district) await goTo(a, sec.district, `heads to ${sec.district} (${sec.name.toLowerCase()}) to ${t.side} $${sym}`);
  console.log(`${a.id} ${mode} ${t.side} ${sym} ${sol.toFixed(4)} SOL`);
}

/** A real swap from the agent's own wallet. Returns what actually moved on chain (the book follows the chain, not the quote). */
async function sendReal(a: Agent, px: Px, side: "buy" | "sell", amount: number, all = false) {
  const kp = account(a), owner = kp.publicKey.toBase58();
  const token = await tokenByMint(px.token); if (!token) throw new Error(`no token data for ${px.symbol}`);
  let raw: bigint;
  if (side === "buy") raw = BigInt(Math.floor(amount * LAMPORTS));
  else {
    const accs = await connection().getParsedTokenAccountsByOwner(kp.publicKey, { mint: new PublicKey(px.token) });
    const have = accs.value.reduce((s, x) => s + BigInt(x.account.data.parsed.info.tokenAmount.amount), 0n);
    raw = all ? have : BigInt(Math.min(Number(have), Math.floor(amount * 10 ** token.decimals)));
    if (raw <= 0n) throw new Error(`wallet holds no ${px.symbol}`);
  }
  const plan = await planSwap({ side, token, quote: "SOL", amount: raw, slippageBps: px.kind === "pump" ? 500 : 150 });
  const r = await executePlan(plan, owner, signerOf(kp));
  const dec = 10 ** token.decimals;
  return side === "buy"
    ? { tx: r.signature, qty: Number(r.received) / dec, sol: Number(r.spent) / LAMPORTS }
    : { tx: r.signature, qty: Number(r.spent) / dec, sol: Number(r.received) / LAMPORTS };
}

// ---------------- weekly Take-Two reward ----------------
// The agent with the best week wins; everyone who picked it shares the TTWO in the reward wallet (seed index 100). TTWO on Solana is
// Backpack's Token-2022 mint (accounts open unfrozen, transfer hook off), so a payout is: create the picker's ATA, transferChecked.
// Live buys and sends only with REWARDS_LIVE=1: before that the worker records what each picker would get ('preview').
const TTWO = new PublicKey("TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo"), TTWO_DEC = 6;
const SITE = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://viceagents.fun";
const wkStart = (t = Date.now()) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - ((d.getUTCDay() + 6) % 7) * 86_400_000; };
const wkId = (t = Date.now()) => new Date(wkStart(t)).toISOString().slice(0, 10);
const tokenUnits = async (owner: PublicKey, mint: PublicKey) =>
  (await connection().getParsedTokenAccountsByOwner(owner, { mint }).catch(() => ({ value: [] as any[] }))).value.reduce((s, a) => s + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
async function settleRewards() {
  const prev = wkId(Date.now() - 7 * 86_400_000);
  if (Date.now() - wkStart() < 10 * 60_000) return;   // let the new week's snapshot land first
  await sql`create table if not exists la_rewards (week text primary key, winner text, pot double precision, pickers int, per double precision, status text, txs jsonb, at timestamptz default now())`;
  await sql`create table if not exists la_picks (week text, address text, agent text, at timestamptz default now(), primary key (week, address))`;
  const [done] = await sql`select status from la_rewards where week = ${prev}`;
  const live = process.env.REWARDS_LIVE === "1";
  if (done && (done.status !== "preview" || !live)) return;
  const fin = await fetch(`${SITE}/api/rewards/final?week=${prev}`).then((r) => r.json());
  const winner = fin.standings?.[0]?.id as string | undefined; if (!winner) return;
  const picks = await sql`select address from la_picks where week = ${prev} and agent = ${winner}`;
  const kp = agentKeypair(100), me = kp.publicKey;
  const mint = process.env.NEXT_PUBLIC_OFFICIAL_TOKEN, minHold = BigInt(process.env.LOCALS_MIN_HOLD || 1_000_000) * 10n ** 6n;   // pump.fun coins have 6 decimals
  const weights = await Promise.all(picks.map(async (p) => mint ? ((await tokenUnits(new PublicKey(p.address), new PublicKey(mint))) >= minHold ? 2n : 1n) : 1n));
  const txs: { to: string; amount: string; tx: string }[] = [];
  if (live) {
    // creator fees → TTWO: keep a SOL reserve (fees + ~0.0021 SOL rent per new picker account), swap a share of the rest
    const sol = BigInt(await connection().getBalance(me)), reserve = BigInt(Math.round(Number(process.env.REWARD_RESERVE_SOL || "0.05") * LAMPORTS));
    const spend = sol > reserve ? (sol - reserve) * BigInt(Math.round(Number(process.env.REWARD_SHARE || "0.5") * 100)) / 100n : 0n;
    if (spend > BigInt(0.005 * LAMPORTS)) {
      const token = await tokenByMint(TTWO.toBase58());
      if (token) await executePlan(await planSwap({ side: "buy", token, quote: "SOL", amount: spend, slippageBps: 150 }), me.toBase58(), signerOf(kp)).catch((e) => console.error("ttwo buy", e.message));
    }
  }
  const bal = await tokenUnits(me, TTWO), human = Number(bal) / 10 ** TTWO_DEC;
  const total = weights.reduce((a, b) => a + b, 0n);
  if (!picks.length || bal === 0n) {
    await sql`insert into la_rewards (week, winner, pot, pickers, per, status, txs) values (${prev}, ${winner}, ${human}, ${picks.length}, 0, ${picks.length ? "empty" : "rollover"}, '[]') on conflict (week) do update set status = excluded.status`;
    return console.log(`reward ${prev}: ${winner} won, ${picks.length} pickers, pot ${human} TTWO, nothing sent`);
  }
  const unit = bal / total, from = getAssociatedTokenAddressSync(TTWO, me, false, TOKEN_2022_PROGRAM_ID);
  if (live) for (let i = 0; i < picks.length; i++) {
    const amount = unit * weights[i]; if (amount === 0n) continue;
    const owner = new PublicKey(picks[i].address), to = getAssociatedTokenAddressSync(TTWO, owner, true, TOKEN_2022_PROGRAM_ID);
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(me, to, owner, TTWO, TOKEN_2022_PROGRAM_ID),
      createTransferCheckedInstruction(from, TTWO, to, me, amount, TTWO_DEC, [], TOKEN_2022_PROGRAM_ID));
    const sig = await connection().sendTransaction(tx, [kp]).catch((e) => { console.error("ttwo send", e.message); return ""; });
    txs.push({ to: picks[i].address, amount: String(Number(amount) / 10 ** TTWO_DEC), tx: sig });
  }
  await sql`insert into la_rewards (week, winner, pot, pickers, per, status, txs) values (${prev}, ${winner}, ${human}, ${picks.length}, ${Number(unit) / 10 ** TTWO_DEC}, ${live ? "paid" : "preview"}, ${sql.json(txs)})
    on conflict (week) do update set pot = excluded.pot, pickers = excluded.pickers, per = excluded.per, status = excluded.status, txs = excluded.txs, at = now()`;
  await sql`insert into la_events (agent_id, kind, text, district) values (${winner}, 'reward', ${`won the week: ${picks.length} pickers ${live ? "got" : "would get"} ${human.toFixed(4)} Take-Two shares`}, ${null})`;
  console.log(`reward ${prev}: ${winner}, ${picks.length} pickers, ${live ? "paid" : "preview"}`);
}

// ---------------- main ----------------
async function main() {
  account(CAST[0]);   // fails fast without a valid AGENT_SEED
  await schema();
  await refreshPrices();
  setInterval(() => refreshPrices().catch((e) => console.error("prices", e.message)), PRICE_MS);
  setInterval(() => walk().catch((e) => console.error("walk", e.message)), STEP_MS);
  setInterval(() => settleRewards().catch((e) => console.error("rewards", e.message)), 10 * 60_000);
  let i = Math.floor(Math.random() * CAST.length);
  const tick = async () => {
    const a = CAST[i++ % CAST.length];
    const t0 = Date.now(); await think(a).catch((e) => console.error(a.id, "think", e.message)); console.log(a.id, "thought in", Date.now() - t0, "ms");
    await sql`delete from la_events where id < (select max(id) - 5000 from la_events)`;
    setTimeout(tick, THINK_MS);
  };
  tick();
  console.log(`agents up · ${process.env.ANTHROPIC_API_KEY ? "anthropic" : MODEL} · ${REAL ? "REAL trading armed (min " + MIN_REAL_SOL + " SOL)" : "paper trading"}`);
}
main();
