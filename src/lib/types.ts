export type Coin = {
  mint: string; curve: string; name: string; ticker: string; description?: string | null; sourceUrl?: string | null;
  still: string; loop?: string | null; creator: string; tx?: string | null; block?: string | null;
  /** change24h: price change since launch (Pons has no 24h feed; the curve's opening price is exact). */
  mcapUsd: number; change24h: number; volumeEth: number; holders: number; bondingPct: number;
  migrated: boolean; createdAt: string; official?: boolean;
  mapU?: number | null; mapV?: number | null;
};
export type Trade = { sig: string; mint: string; ticker: string; wallet: string; side: "buy" | "sell"; eth: number; tokens: number; mcapUsd: number; at: string };
export type Holder = { wallet: string; amount: number; pct: number; dev?: boolean; curve?: boolean };
export type Sort = "hot" | "new" | "mcap" | "graduating";
