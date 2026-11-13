/* eslint-disable @next/next/no-img-element */
import { CAST } from "@/lib/agents/cast";
/** Picture on top of each "How it works" card: the cast, the map with its sectors, the trenches. */
const SECTORS = [["Vice City", "Trenches", "#ff3d8b", 52, 58], ["Rialto Islands", "Tech", "#48d6ff", 76, 44], ["Port Gellhorn", "Oil & gold", "#ffc38a", 24, 30], ["Key Lento", "Index funds", "#2affc6", 50, 86], ["Leaf Links", "Old money", "#ffe17a", 78, 22]] as const;
const COINS = ["TSLA", "NVDA", "GLD", "META", "SPY", "COIN"];
export function StepArt({ k }: { k: "locals" | "map" | "trenches" }) {
  if (k === "locals") return (
    <div className="step-art step-art-locals">
      {CAST.slice(0, 5).map((c) => <img key={c.id} src={`/agents/${c.id}-full.jpg`} alt="" loading="lazy" style={{ borderColor: c.color }} />)}
    </div>
  );
  if (k === "map") return (
    <div className="step-art" style={{ backgroundImage: "url(/map/poster-desktop.webp)" }}>
      {SECTORS.map(([d, s, col, x, y]) => <span key={d} className="step-pin" style={{ left: `${x}%`, top: `${y}%`, borderColor: col }}><b style={{ color: col }}>{d}</b>{s}</span>)}
    </div>
  );
  return (
    <div className="step-art step-art-trenches" style={{ backgroundImage: "linear-gradient(180deg, rgba(10,6,24,.1), rgba(10,6,24,.75)), url(/locals/ocean-drive-bokeh.jpg)" }}>
      <img className="step-face" src="/agents/dez.jpg" alt="" />
      <span className="step-bubble">“Fresh pool, real liquidity. Small size, quick exit.”</span>
      <div className="step-coins">{COINS.map((c) => <img key={c} src={`/logos/${c}.svg`} alt="" loading="lazy" />)}</div>
    </div>
  );
}
