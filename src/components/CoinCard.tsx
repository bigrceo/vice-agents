"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Num } from "./Num";
import type { Coin } from "@/lib/types";
import { ago, pct, usd } from "@/lib/format";

/** Tile: still frame over a dither skeleton; clip loop plays on hover (desktop) or while in view (touch). */
export function CoinTile({ c }: { c: Coin }) {
  const v = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLAnchorElement>(null);
  const [img, setImg] = useState(false);
  const [playing, setPlaying] = useState(false);
  const play = () => { const el = v.current; if (!el) return; el.play().then(() => setPlaying(true)).catch(() => {}); };
  const stop = () => { const el = v.current; if (!el) return; el.pause(); el.currentTime = 0; setPlaying(false); };
  useEffect(() => {
    if (!c.loop || !box.current) return;
    if (!matchMedia("(hover: none)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => (e.intersectionRatio >= 0.6 ? play() : stop()), { threshold: [0, 0.6] });
    io.observe(box.current);
    return () => io.disconnect();
  }, [c.loop]);
  return (
    <Link ref={box} href={`/coin/${c.mint}`} className="tile group block border border-line bg-deck"
      onMouseEnter={() => matchMedia("(hover: hover)").matches && play()} onMouseLeave={() => matchMedia("(hover: hover)").matches && stop()}>
      <div className={`relative aspect-square ${img ? "bg-night" : "skeleton"}`}>
        <img src={c.still} alt="" ref={(el) => { if (el?.complete && el.naturalWidth) setImg(true); }} onLoad={() => setImg(true)}
          className={`fade-img absolute inset-0 h-full w-full object-cover ${img ? "loaded" : ""}`} loading="lazy" />
        {c.loop && <video ref={v} src={c.loop} muted loop playsInline preload="none" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${playing ? "opacity-100" : "opacity-0"}`} />}
        <span className="label tag-shadow absolute left-2 top-2">{c.official ? "Official" : c.migrated ? "Graduated" : ago(c.createdAt)}</span>
      </div>
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-bold transition-colors group-hover:text-sun">${c.ticker}</span>
          <span className={`text-sm font-semibold ${c.change24h >= 0 ? "text-up" : "text-down"}`}>{pct(c.change24h)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-sm text-haze">
          <span className="truncate">{c.name}</span><Num value={c.mcapUsd} text={usd(c.mcapUsd)} className="shrink-0" />
        </div>
        {!c.migrated && <div className="mt-2 h-1 overflow-hidden bg-night"><div className="fill h-full bg-sun" style={{ width: `${c.bondingPct}%` }} /></div>}
      </div>
    </Link>
  );
}

export function CoinRow({ c, i }: { c: Coin; i: number }) {
  return (
    <Link href={`/coin/${c.mint}`} className="grid grid-cols-[2rem_3rem_1fr_auto_auto] items-center gap-3 border-b border-line px-2 py-2 transition-colors hover:bg-deck sm:grid-cols-[2rem_3rem_1fr_6rem_6rem_6rem_5rem]">
      <span className="text-haze">{i + 1}</span>
      <img src={c.still} alt="" className="dither h-10 w-10 rounded-lg object-cover" loading="lazy" />
      <span className="min-w-0 truncate"><span className="font-bold">${c.ticker}</span> <span className="text-haze">{c.name}</span></span>
      <Num value={c.mcapUsd} text={usd(c.mcapUsd)} className="text-right" />
      <span className={`text-right ${c.change24h >= 0 ? "text-up" : "text-down"}`}>{pct(c.change24h)}</span>
      <span className="hidden text-right text-haze sm:block">{c.holders} holders</span>
      <span className="hidden text-right text-haze sm:block">{c.migrated ? "Graduated" : `${c.bondingPct.toFixed(0)}%`}</span>
    </Link>
  );
}
