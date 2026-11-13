"use client";
/**
 * The home map, shown complete from the first paint: the poster, every agent pin and the controls are plain HTML in the
 * page bundle. The 3D scene (three.js) loads behind them and takes over the same pins with the same camera, so nothing jumps.
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPoster } from "./MapPoster";
import { plotFor } from "./plots";
import { pct } from "@/lib/format";
import type { Coin } from "@/lib/types";
import { defaultCamera, layoutPins, walkTo, newSlot, projector, type Entity, type LayoutState, type Slot } from "./map/pins";

const loadScene = () => import("./StateMap").then((m) => m.MapScene);
const MapScene = dynamic(loadScene, { ssr: false, loading: () => null });
if (typeof window !== "undefined") void loadScene();   // start fetching three.js at once, in parallel with hydration

type Api = { zoom: (k: number) => void };

function Pins({ entities, slots, hovered, selected, onHover, onSelect }: { entities: Entity[]; slots: Map<string, Slot>; hovered: string | null; selected: string | null; onHover: (m: string | null) => void; onSelect: (m: string) => void }) {
  const slot = (m: string) => { let s = slots.get(m); if (!s) { s = newSlot(); slots.set(m, s); } return s; };
  return (
    <div className="pins" aria-label="Map labels">
      {entities.map((e) => {
        const hot = hovered === e.coin.mint || selected === e.coin.mint;
        return (
          <button key={e.coin.mint} type="button" data-mode="hidden" ref={(el) => { slot(e.coin.mint).el = el; }}
            className={`pin ${e.main ? "pin-main" : ""} ${e.coin.ring ? "pin-agent" : ""} ${hot ? "is-active" : ""}`} onClick={() => onSelect(e.coin.mint)}
            style={e.coin.ring ? ({ "--ring": e.coin.ring } as React.CSSProperties) : undefined}
            onMouseEnter={() => onHover(e.coin.mint)} onMouseLeave={() => onHover(null)} aria-label={e.coin.ring ? e.coin.name : `$${e.coin.ticker}`}>
            {e.coin.bubble && <span key={e.coin.bubble.id} className={`pin-bubble is-${e.coin.bubble.kind}`}>{e.coin.bubble.text}</span>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.coin.still} alt="" width={30} height={30} fetchPriority="high" />
            <span className="pin-text"><b>{e.coin.curve === "agent" ? e.coin.ticker : `$${e.coin.ticker}`}</b><i className={e.coin.change24h >= 0 ? "text-up" : "text-down"}>{pct(e.coin.change24h)}</i></span>
          </button>
        );
      })}
    </div>
  );
}

export function StateMap({ coins, active, onActive, children }: { coins: Coin[]; active: string | null; onActive: (m: string | null) => void; children?: React.ReactNode }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const slots = useMemo(() => new Map<string, Slot>(), []);
  const entities = useMemo<Entity[]>(() => coins.map((c, i) => ({ coin: c, plot: plotFor(c, i), main: !!c.official })), [coins]);
  const api = useRef<Api | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const onReady = useMemo(() => () => { setReady(true); (window as unknown as { __mapAt?: number }).__mapAt = Math.round(performance.now()); }, []);
  // until the 3D camera runs, place the pins with the same default camera in plain math
  const latest = useRef({ entities, active }); latest.current = { entities, active };
  useEffect(() => {
    if (ready || new URLSearchParams(location.search).get("at")) return;
    const st: LayoutState = { frame: 0, obstaclesAt: -99, obstacles: [] };
    let raf = 0, last = performance.now();
    const tick = (now = performance.now()) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      for (const e of latest.current.entities) walkTo(e, dt);
      const el = root.current;
      if (el) {
        const size = { width: el.clientWidth, height: el.clientHeight };
        layoutPins(latest.current.entities, slots, latest.current.active, el, size, st, projector(defaultCamera(innerWidth < 700), size.width, size.height));
        const w = window as unknown as { __pinsAt?: number }; if (w.__pinsAt == null && size.width) w.__pinsAt = Math.round(performance.now());
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [ready, slots]);
  return (
    <div ref={root} className="map-canvas absolute inset-0">
      <MapPoster hidden={ready} />
      <div className="absolute inset-0"><MapScene entities={entities} slots={slots} active={active} hovered={hovered} onHover={setHovered} onActive={onActive} api={api as never} root={root} onReady={onReady} /></div>
      <Pins entities={entities} slots={slots} hovered={hovered} selected={active} onHover={setHovered} onSelect={onActive} />
      <div className="map-vignette" aria-hidden="true" />
      <div className="absolute bottom-[18px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 max-md:bottom-3 max-md:left-auto max-md:right-3 max-md:translate-x-0">
        <button type="button" onClick={() => api.current?.zoom(1.35)} className="grid size-9 place-items-center rounded-full border border-line bg-night/70 text-lg font-bold text-ink hover:bg-night/90" aria-label="Zoom out">−</button>
        <span className="whitespace-nowrap rounded-full border border-line bg-night/70 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-haze max-xl:hidden">Drag to pan · scroll to zoom · click a beacon</span>
        <button type="button" onClick={() => api.current?.zoom(0.74)} className="grid size-9 place-items-center rounded-full border border-line bg-night/70 text-lg font-bold text-ink hover:bg-night/90" aria-label="Zoom in">+</button>
      </div>
      {children}
    </div>
  );
}
