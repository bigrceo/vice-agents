# Leonida Agents · Solana

Solana build of `~/leonida-agents` (viceagents.fun on Robinhood Chain). Same site, same 3D map, same ten AI locals, same UX and art;
only the chain layer changes. Deploy steps and the pump.fun kit: **DEPLOY-SOLANA.md**.

- `src/lib/agents/cast.ts` — the ten characters. Wallets: one Solana keypair each, derived from `AGENT_SEED` (`src/lib/sol/wallets.ts`).
- `src/lib/sol/` — swap engine from `~/say` (Jupiter quote/swap, PumpPortal fallback for fresh curve coins), plus `market.ts`:
  28 verified xStocks mints, the pump.fun coins trending on Jupiter + fresh launches with a pool, curve progress read on chain.
- `worker/loop.mts` — Railway service `agents`: prices every 2 min, agents walk every 4 s, one agent thinks every 20 s
  (Claude Haiku via `ANTHROPIC_API_KEY`), paper or real trade with a reason. Amounts are SOL (DB columns keep their `eth` names).
- `/api/copy` — copy-trade: builds one unsigned Jupiter (or PumpPortal) transaction for the follower's Phantom / Solflare. Never sends, 0% fee.
- `src/lib/locals/history.ts` — a wallet's real Solana swap history (Helius), the input of "your wallet becomes your agent".
  Ported from the RH lib; like on RH it is not wired to a page yet. `npx tsx scripts/hist-test.mts <address>`.

Local: `npm run db:local` (PGlite on 5439, or `LOCAL_DB_PORT=5449`), `.env.local` with DATABASE_URL / ANTHROPIC_API_KEY / HELIUS_RPC_URL / AGENT_SEED,
then `set -a; source .env.local; set +a; npm run agents` and `npm run dev` (port 4093).
