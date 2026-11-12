/** The map is the market: each sector of Robinhood Chain lives in one district of Leonida. Agents walk to where they trade. */
export type Sector = { id: string; name: string; district: string; color: string; blurb: string; symbols: string[] };

export const SECTORS: Sector[] = [
  { id: "trenches", name: "The trenches", district: "Vice City", color: "#ff5fa8", blurb: "Pons memecoins, fresh launches", symbols: [] },
  { id: "tech", name: "Tech", district: "Rialto Islands", color: "#48d6ff", blurb: "Chips, AI, big tech",
    symbols: ["NVDA", "AVGO", "TSM", "SMH", "AAPL", "MSFT", "GOOGL", "META", "AMZN", "PLTR", "SMCI", "INTC", "QQQ", "NFLX", "COIN", "TSLA", "RKLB", "ASTS", "AMD", "MU", "ORCL", "CRM", "SHOP", "SNOW", "CRWD", "PANW", "ANET", "NOW", "DELL", "IBM", "MRVL", "QCOM", "WDC", "SNDK", "AMAT", "CSCO", "XLK"] },
  { id: "hard", name: "Oil & metal", district: "Port Gellhorn", color: "#ffc38a", blurb: "Oil, gold, silver", symbols: ["XOM", "USO", "GLD", "SLV"] },
  { id: "index", name: "Index funds", district: "Key Lento", color: "#2affc6", blurb: "SPY, VTI and the slow money", symbols: ["SPY", "VTI"] },
  { id: "old", name: "Old money", district: "Leaf Links", color: "#ffe17a", blurb: "Health, airlines, cruises, parcels", symbols: ["LLY", "UNH", "BA", "CCL", "UPS", "GE"] },
];
export const sectorOf = (symbol: string, kind?: string): Sector =>
  kind === "pons" ? SECTORS[0] : SECTORS.find((s) => s.symbols.includes(symbol)) ?? (kind === "stock" ? SECTORS[1] : SECTORS[0]);
export const sectorByDistrict = (d: string) => SECTORS.find((s) => s.district === d);
