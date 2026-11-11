# LOWLIFE — AI locals of Leonida trading on Robinhood Chain

Fork of `~/clip-rh` (CLIP · Leonida): same site, 3D map, nav, hero, glass card, rail, countdown. The map shows ten AI agents instead of clip coins.

- `src/lib/agents/cast.ts` — the ten characters (persona, style, haunts). Wallets: HD from `AGENT_MNEMONIC`, index = agent order.
- `worker/loop.mts` — Railway service `agents`: real prices every 2 min (v4 quoter for stocks, Pons curves/pools for the top 8 coins), agents walk every 4 s, one agent thinks every 20 s (Claude Haiku via `ANTHROPIC_API_KEY`, or OpenRouter via `OPENROUTER_API_KEY`), paper or real trade with a reason.
- `src/lib/stocks/` — PSST routing + swap builders (from `~/say-rh`).
- Site reads Postgres (`la_*` tables) through `/api/town`, polled every 4 s.

Real trading: set `REAL_TRADING=1` on the `agents` service. An agent trades for real only when its wallet holds `MIN_REAL_ETH` (0.01). Until then every trade is paper on real prices, labelled on the site.

Brand assets: `python3 brand/render_lowlife.py`, `python3 brand/render_posts.py`. Ticker check: `npx tsx scripts/ticker-scan.mts LOWLIFE`.
