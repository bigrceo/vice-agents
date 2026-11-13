/** The map is the market: each sector of the Solana market lives in one district of Leonida. Agents walk to where they trade. */
export type Sector = { id: string; name: string; district: string; color: string; blurb: string; symbols: string[] };

export const SECTORS: Sector[] = [
  { id: "trenches", name: "The trenches", district: "Vice City", color: "#ff5fa8", blurb: "pump.fun memecoins, fresh launches", symbols: [] },
  { id: "tech", name: "Tech", district: "Rialto Islands", color: "#48d6ff", blurb: "Chips, AI, big tech",
    symbols: ["NVDA", "AVGO", "AMD", "INTC", "ORCL", "AAPL", "MSFT", "GOOGL", "META", "AMZN", "NFLX", "PLTR", "TSLA", "COIN", "HOOD", "MSTR", "CRCL", "QQQ", "TQQQ"] },
  { id: "hard", name: "Oil & metal", district: "Port Gellhorn", color: "#ffc38a", blurb: "Oil and gold", symbols: ["XOM", "GLD"] },
  { id: "index", name: "Index funds", district: "Key Lento", color: "#2affc6", blurb: "SPY, VTI and the slow money", symbols: ["SPY", "VTI"] },
  { id: "old", name: "Old money", district: "Leaf Links", color: "#ffe17a", blurb: "Health, banks, burgers and soda", symbols: ["LLY", "UNH", "JPM", "MCD", "KO"] },
];
export const sectorOf = (symbol: string, kind?: string): Sector =>
  kind === "pump" ? SECTORS[0] : SECTORS.find((s) => s.symbols.includes(symbol)) ?? (kind === "stock" ? SECTORS[1] : SECTORS[0]);
export const sectorByDistrict = (d: string) => SECTORS.find((s) => s.district === d);
