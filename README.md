# CLIP on Robinhood Chain

Port of getclip.fun (`~/clipfun`, Solana / pump.fun) to Robinhood Chain (4663) / Pons V2. Same Leonida map, same flow:
clip link → square → **Map** (pin the spot) → coin → live. Every coin is a Pons V2 token, pinned on the 3D map.

## Run

```
npm i
cp .env.example .env.local
npm run dev        # http://localhost:4083
```

## Prod

- Vercel project `clip-rh` (team worldcupface), separate Blob store `clip-rh-media`.
- Postgres: Railway project `clip-rh` (TCP proxy), schema `npm run db:push`. Separate from the Solana DB.
- `PLATFORM_PRIVATE_KEY`: sponsor wallet; needs ≥ 0.00086 ETH on Robinhood Chain to sponsor (fee 0.0005 + gas margin).
- `LAUNCH_DRY_RUN=0` sends for real.

## Layout

- `src/lib/launch.ts`: `factory.launchToken` sent by the platform wallet (creator = creator-fee recipient, no buyback), or returned for the creator's wallet when the platform can't pay; `recordLaunch` reads `TokenLaunched` from the receipt and stores the coin + map pin.
- `src/lib/trade.ts`: curve buy / approve + sell from the user's wallet; graduated coins link to Pons.
- `src/lib/data.ts`: DB rows (identity, media, pin) + live Pons numbers (`src/lib/rh/market.ts`: price, mcap in USD via on-chain ETH/USDG, curve %, "since launch" change).
- `src/lib/rh/*`: Pons V2 addresses, ABIs, curve math (from ~/gifs-rh, ~/mindpad).
