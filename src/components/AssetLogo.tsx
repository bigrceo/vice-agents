"use client";
/** One logo for any asset on the site: xStocks from /logos (else their Jupiter icon), pump.fun coins from their Jupiter icon or IPFS image. */
import { useState } from "react";

const STOCK_LOGOS = new Set("AAPL AMAT AMD AMZN ANET ASTS AVGO BA CCL COIN CRM CRWD CSCO DELL ETH F GE GLD GOOGL INTC JNJ LLY LMT LRCX META MRVL MSFT MU NFLX NOW NVDA ORCL PANW PLTR QCOM QQQ RKLB SHOP SLV SMCI SMH SNDK SNOW SPY TSLA TSM UNH UPS USDC USDG USDT USO VTI WDC WETH XLK XOM".split(" "));
export const logoSrc = (a: { symbol: string; kind: string; token: string; logo?: string }) => {
  if (a.kind === "stock" && STOCK_LOGOS.has(a.symbol.toUpperCase())) return `/logos/${a.symbol.toUpperCase()}.svg`;
  if (a.logo?.startsWith("ipfs://")) return `/api/logo?cid=${encodeURIComponent(a.logo.slice(7).replace(/^ipfs\//, ""))}`;
  if (a.logo?.startsWith("https://")) return a.logo;
  return "/icon.png";
};

export function AssetLogo({ a, size = 40, className = "" }: { a: { symbol: string; kind: string; token: string; logo?: string }; size?: number; className?: string }) {
  const [bad, setBad] = useState(false);
  const stock = a.kind === "stock";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`asset-logo ${stock ? "is-stock" : ""} ${className}`} width={size} height={size} style={{ width: size, height: size }} alt=""
      loading="lazy" referrerPolicy="no-referrer" src={bad ? "/icon.png" : logoSrc(a)} onError={() => setBad(true)} />
  );
}
