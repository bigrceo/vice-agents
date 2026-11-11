"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Coin, Sort } from "@/lib/types";
import { CoinRow, CoinTile } from "./CoinCard";

const TABS: [Sort, string][] = [["hot", "Hot"], ["new", "New"], ["mcap", "Market cap"], ["graduating", "About to graduate"]];

export function CoinGrid({ initial }: { initial: Coin[] }) {
  const [sort, setSort] = useState<Sort>("hot");
  const [view, setView] = useState<"tiles" | "list">("tiles");
  const [coins, setCoins] = useState(initial);
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const first = useRef(true);
  const nav = useRef<HTMLElement>(null);
  const [bar, setBar] = useState({ x: 0, y: 0, w: 0 });
  useLayoutEffect(() => {
    const place = () => { const el = nav.current?.querySelector<HTMLElement>('[aria-selected="true"]'); if (el) setBar({ x: el.offsetLeft, y: el.offsetTop + el.offsetHeight - 2, w: el.offsetWidth }); };
    place(); addEventListener("resize", place); return () => removeEventListener("resize", place);
  }, [sort]);
  useEffect(() => { try { const v = localStorage.getItem("view"); if (v === "list" || v === "tiles") setView(v); } catch {} }, []);
  useEffect(() => {
    let live = true;
    if (first.current && sort === "hot") { first.current = false; return; }
    first.current = false; setLoading(true); setFailed(false);
    fetch(`/api/coins?sort=${sort}&limit=120`).then((r) => r.json()).then((j) => { if (live && j.coins) setCoins(j.coins); })
      .catch(() => live && setFailed(true)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [sort, nonce]);
  const pick = (v: "tiles" | "list") => { setView(v); try { localStorage.setItem("view", v); } catch {} };
  return (
    <section className="mx-auto max-w-[1680px] px-4">
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <nav ref={nav} className="relative flex flex-wrap gap-x-5 gap-y-1" role="tablist">
          <span aria-hidden className="absolute top-0 h-0.5 bg-coral transition-all duration-300 ease-[var(--ease-snap)]" style={{ transform: `translate(${bar.x}px, ${bar.y}px)`, width: bar.w, left: 0 }} />
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={sort === k} onClick={() => setSort(k)}
              className={`label py-2 text-[12px] transition-colors ${sort === k ? "!text-ink" : "hover:!text-ink"}`}>{l}</button>
          ))}
        </nav>
        <div className="ml-auto flex gap-4" role="group" aria-label="View">
          {(["tiles", "list"] as const).map((v) => (
            <button key={v} onClick={() => pick(v)} aria-pressed={view === v} className={`label py-2 transition-colors ${view === v ? "!text-sun" : "hover:!text-ink"}`}>{v === "tiles" ? "Tiles" : "List"}</button>
          ))}
        </div>
      </div>
      {failed ? (
        <div className="glass py-16 text-center"><p className="font-sign text-xl">Feed hiccup</p><button onClick={() => setNonce((n) => n + 1)} className="btn btn-ghost mt-4">Retry</button></div>
      ) : loading && coins.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton aspect-[4/5] rounded-2xl border border-line" />)}</div>
      ) : coins.length === 0 ? (
        <div className="glass py-16 text-center"><p className="font-sign text-xl">Nothing here yet</p><a href="/launch" className="btn btn-hot mt-4">Launch the first one</a></div>
      ) : view === "tiles" ? (
        <div key={sort + view} className={`enter grid transition-opacity ${loading ? "opacity-50" : ""} grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`}>
          {coins.map((c) => <CoinTile key={c.mint} c={c} />)}
        </div>
      ) : (
        <div key={sort + view} className={`enter overflow-hidden rounded-2xl border border-line transition-opacity ${loading ? "opacity-50" : ""}`}>{coins.map((c, i) => <CoinRow key={c.mint} c={c} i={i} />)}</div>
      )}
    </section>
  );
}
