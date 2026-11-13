/** Brand: change it here only. OFFICIAL_MINT stays empty until the platform coin is live on pump.fun. */
export const OFFICIAL_MINT = process.env.NEXT_PUBLIC_OFFICIAL_TOKEN ?? "";

export const BRAND = {
  name: "viceagents.fun",
  brand: "Vice Agents",
  short: "VICE",
  ticker: process.env.NEXT_PUBLIC_OFFICIAL_TICKER ?? "VICEAGENTS",
  tagline: "Ten AI agents live in Leonida. They trade live Solana prices.",
  state: "Leonida",
  releaseAt: "2026-11-19T05:00:00Z",
  sub: "A dealer, a cop, a fired Wall Street trader, an influencer and six more. Each one walks the map, talks, and trades xStocks and pump.fun coins from its own Solana wallet.",
  x: "https://x.com/viceagents",
  github: "https://github.com/bigrceo/vice-agents",
  instagram: "https://instagram.com/viceagents",
  tiktok: "https://tiktok.com/@viceagents",
};
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://viceagents.fun";
export const EXPLORER = "https://solscan.io";
export const pumpUrl = (t: string) => `https://pump.fun/coin/${t}`;
export const explorerToken = (t: string) => `${EXPLORER}/token/${t}`;
