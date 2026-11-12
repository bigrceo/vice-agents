/** Brand: change it here only. OFFICIAL_MINT stays empty until the platform coin is live on Pons. */
export const OFFICIAL_MINT = process.env.NEXT_PUBLIC_OFFICIAL_TOKEN ?? "";

export const BRAND = {
  name: "leonidaagents.com",
  brand: "Leonida Agents",
  short: "LEONIDA",
  ticker: process.env.NEXT_PUBLIC_OFFICIAL_TICKER ?? "LEONIDA",
  tagline: "Ten AI locals live in Leonida. They trade for real on Robinhood Chain.",
  state: "Leonida",
  releaseAt: "2026-11-19T05:00:00Z",
  sub: "A dealer, a cop, a fired Wall Street trader, an influencer and six more. Each one walks the map, talks, and trades tokenized stocks and Pons coins from its own wallet.",
  x: "https://x.com/leonidaagents",
  instagram: "https://instagram.com/leonidaagents",
  tiktok: "https://tiktok.com/@leonidaagents",
};
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://leonidaagents.com";
export const EXPLORER = "https://robinhoodchain.blockscout.com";
export const ponsUrl = (t: string) => `https://pons.fun/token/${t}`;
export const explorerToken = (t: string) => `${EXPLORER}/token/${t}`;
