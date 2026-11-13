"use client";
/** One logo for any asset on the site: xStocks from /logos, every other coin's real image through /api/img (cached at the edge).
 *  No image: the coin's initials on a plain tile, never the site's own logo. Width and height are fixed, so nothing jumps. */
import { useState } from "react";

const STOCK_LOGOS = new Set("AAPL AMAT AMD AMZN ANET ASTS AVGO BA CCL COIN CRM CRWD CSCO DELL ETH F GE GLD GOOGL INTC JNJ LLY LMT LRCX META MRVL MSFT MU NFLX NOW NVDA ORCL PANW PLTR QCOM QQQ RKLB SHOP SLV SMCI SMH SNDK SNOW SPY TSLA TSM UNH UPS USDC USDG USDT USO VTI WDC WETH XLK XOM".split(" "));
export const logoSrc = (a: { symbol: string; kind: string; token: string }) =>
  a.kind === "stock" && STOCK_LOGOS.has(a.symbol.toUpperCase()) ? `/logos/${a.symbol.toUpperCase()}.svg` : `/api/img?mint=${a.token}`;

export function AssetLogo({ a, size = 40, className = "", eager = false }: { a: { symbol: string; kind: string; token: string; logo?: string }; size?: number; className?: string; eager?: boolean }) {
  const [bad, setBad] = useState(false);
  const stock = a.kind === "stock";
  const box = { width: size, height: size };
  if (bad || !a.token) return (
    <span aria-hidden className={`asset-logo asset-initials ${stock ? "is-stock" : ""} ${className}`} style={{ ...box, fontSize: Math.max(9, size * 0.34) }}>
      {a.symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?"}
    </span>
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`asset-logo ${stock ? "is-stock" : ""} ${className}`} width={size} height={size} style={box} alt="" decoding="async"
      loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} referrerPolicy="no-referrer" src={logoSrc(a)} onError={() => setBad(true)} />
  );
}
