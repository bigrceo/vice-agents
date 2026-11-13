"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BRAND, OFFICIAL_MINT } from "@/lib/brand";
import { StateMap } from "./MapShell";
import { AgentRail } from "./AgentRail";
import { MoneyFlow } from "./MoneyFlow";
import { AgentDrawer } from "./AgentDrawer";
import { agentAsCoin, useTown } from "./town";
import { Countdown } from "./Countdown";

/** Leonida-style hero: the state map full-bleed, a glass card on the left, the "on the map" rail on the right. */
export function MapHero() {
  const town = useTown();
  // the worker moves them every few seconds; the map glides each agent to its new spot (map/pins walkTo)
  const coins = useMemo(() => town.agents.filter((a) => a.u != null).map((a) => agentAsCoin(a, town.events)), [town.agents, town.events]);
  const [active, setActive] = useState<string | null>(null);
  const paper = town.agents.every((a) => a.mode === "paper");
  const [lead, tail] = BRAND.tagline.split(". ");
  const card = (
        <div data-pin-obstacle className="glass-map z-20 w-[min(420px,100%-48px)] p-5 pb-4 md:absolute md:left-6 md:top-[96px] md:max-h-[calc(100svh-120px)] md:overflow-y-auto [scrollbar-width:none] max-md:mx-4 max-md:mt-3 max-md:w-auto">
          <p className="script">Welcome to {BRAND.state}</p>
          <h1 className="font-sign text-[64px] uppercase leading-[.92] max-md:text-[50px] [@media(max-height:960px)]:text-[52px]">
            <span className="sunset-text block" style={{ filter: "drop-shadow(0 4px 22px rgba(255,61,139,.45))" }}>Vice</span>
            <span className="block">Agents</span>
          </h1>
          <p className="mb-3.5 mt-2.5 text-[16px] text-haze">{lead}. <span className="text-ink">{tail}</span></p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="stat"><i>Agents on the map</i><b>{coins.length}</b></div>
            <div className="stat"><i>Trades so far</i><b>{town.agents.reduce((s, a) => s + a.trades, 0)}</b></div>
          </div>
          <p className="mt-3 text-[13px] leading-[1.45] text-haze">{paper
            ? <>Real prices from Solana. <span className="text-sun">Paper trading</span> until their wallets are funded.</>
            : <>Trading <span className="text-up">for real</span> from their own wallets on Solana.</>}</p>
          <MoneyFlow onFly={(d) => dispatchEvent(new CustomEvent("clip:fly", { detail: d }))} />
          <div className="mt-2.5 flex gap-2.5">
            {OFFICIAL_MINT
              ? <a href={`https://pump.fun/coin/${OFFICIAL_MINT}`} target="_blank" rel="noreferrer" className="btn btn-hot flex-1">Buy ${BRAND.ticker}</a>
              : <span className="btn btn-ghost flex-1 cursor-default opacity-70">${BRAND.ticker} · soon</span>}
            <Link href="/how" className="btn btn-ghost flex-1">How it works</Link>
          </div>
          <div className="mt-3.5 [@media(max-height:900px)]:hidden">
            <i className="text-[12px] not-italic uppercase tracking-[1px] text-haze">GTA VI hits {BRAND.state} in</i>
            <div className="mt-1.5"><Countdown to={BRAND.releaseAt} /></div>
          </div>
        </div>
  );
  const rail = (
        <aside id="feed" data-pin-obstacle className="glass-map z-20 flex w-[310px] flex-col p-3 md:absolute md:bottom-[70px] md:right-6 md:top-[96px] max-md:mx-4 max-md:mt-3 max-md:h-[560px] max-md:w-auto">
          <div className="px-1.5 pb-2">
            <p className="script !text-[22px] leading-none">Live</p>
            <b className="font-sign text-[30px] font-normal uppercase leading-none tracking-wide">On the map</b>
          </div>
          <div className="min-h-0 flex-1"><AgentRail onPick={setActive} /></div>
        </aside>
  );
  return (
    <section id="map" className="relative scroll-mt-0 md:-mt-[84px] md:h-[100svh] md:min-h-[680px] md:overflow-hidden max-md:flex max-md:flex-col max-md:pb-4">
      <div className="md:absolute md:inset-0 max-md:relative max-md:h-[64svh] max-md:min-h-[420px]">
      <StateMap coins={coins} active={active} onActive={setActive}>
        {active && coins.some((c) => c.mint === active) && <AgentDrawer id={active} onClose={() => setActive(null)} />}
      </StateMap>
      <div className="hidden md:contents">{card}{rail}</div>
      </div>
      {/* the sea melts into the page: no hard edge between the map and the rest of the site */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[200px] max-md:hidden" style={{ background: "linear-gradient(to bottom, rgba(10,6,24,0) 0%, rgba(14,10,40,.55) 45%, rgba(10,6,24,.92) 80%, #0a0618 100%)" }} />
      <div className="md:hidden">{card}{rail}</div>
    </section>
  );
}
