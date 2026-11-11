"use client";
/** Lucia and Jason as short looping videos in their place (Ocean Drive, the Keys). The first frame shows at once as the
 *  poster, the loop starts as soon as it can play; no 3D engine on these pages. */
import Link from "next/link";
import { useState } from "react";
import { LOCALS, type Local } from "@/lib/locals";

function Clip({ l, className = "" }: { l: Local; className?: string }) {
  // the animation plays once, then the video rests on its last frame (they look at you) and only breathes: a slow,
  // barely visible rise of the frame. No loop, so the face never changes again.
  const [held, setHeld] = useState(false);
  if (!l.video) return (   // portrait only (no clip yet): it just breathes
    <div className="absolute inset-0 local-breathe">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={l.poster} alt={`${l.name} in ${l.place}`} className={`absolute inset-0 h-full w-full object-cover ${className}`} />
    </div>
  );
  return (
    <div className={`absolute inset-0 ${held ? "local-breathe" : ""}`}>
      <video src={l.video} poster={l.poster} autoPlay muted playsInline preload="auto" aria-label={`${l.name} on ${l.place}`}
        onEnded={() => setHeld(true)} className={`absolute inset-0 h-full w-full object-cover object-[50%_18%] ${className}`} />
    </div>
  );
}

function Card({ l, compact }: { l: Local; compact?: boolean }) {
  return (
    <Link href={`/locals/${l.id}`} className={`local-link group relative block overflow-hidden ${compact ? "min-h-0 flex-1 rounded-[14px]" : "aspect-[4/5] rounded-[20px]"}`} aria-label={`${l.name}: profile`}>
      <div className="absolute inset-0 overflow-hidden rounded-[inherit] border border-white/10">
        <Clip l={l} className="transition-transform duration-700 group-hover:scale-[1.04]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%]" style={{ background: "linear-gradient(to bottom, transparent, rgba(13,7,32,.85) 75%, #0d0720)" }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
          <p className={`label text-sun ${compact ? "!text-[10px]" : ""}`}>${l.ticker} · {l.role}</p>
          <h3 className={`font-sign uppercase leading-none ${compact ? "text-[30px]" : "text-[44px]"}`}>{l.name}</h3>
          {!compact && <p className="mt-2 text-[15px] leading-[1.5] text-haze">{l.bio}</p>}
        </div>
      </div>
    </Link>
  );
}

/** Cast roster for /locals: one wide row per local, media and story side by side, alternating. */
export function LocalsRoster() {
  return (
    <div className="flex flex-col gap-6">
      {LOCALS.map((l, i) => (
        <article key={l.id} className={`glass-map grid items-stretch overflow-hidden md:grid-cols-[minmax(0,420px)_1fr] ${i % 2 ? "md:[&>*:first-child]:order-2 md:grid-cols-[1fr_minmax(0,420px)]" : ""}`}>
          <Link href={`/locals/${l.id}`} className="group relative block aspect-[4/5] overflow-hidden md:aspect-auto md:min-h-[460px]" aria-label={`${l.name}: profile`}>
            <Clip l={l} className="transition-transform duration-700 group-hover:scale-[1.04]" />
          </Link>
          <div className="flex flex-col justify-center gap-4 p-7 max-md:p-5">
            <p className="label text-sun">${l.ticker} · {l.role}</p>
            <h2 className="font-sign text-[84px] uppercase leading-[.85] max-md:text-[64px]"><span className="sunset-text">{l.name}</span></h2>
            <p className="text-[14px] text-haze">{l.place}</p>
            <p className="max-w-[560px] text-[17px] leading-[1.6] text-ink/90">{l.story?.[0] ?? l.bio}</p>
            <div className="flex flex-wrap gap-2">
              {(l.facts ?? []).slice(0, 3).map(([k, v]) => <span key={k} className="stat !py-2 !pr-5"><i className="!text-[10px]">{k}</i><b className="!text-[14px]">{v}</b></span>)}
            </div>
            <div className="mt-1 flex flex-wrap gap-3">
              <Link href={`/locals/${l.id}`} className="btn btn-hot h-11 px-5">See {l.name}</Link>
              <a href={l.mapAt ? `/map?at=${l.mapAt}` : "/map"} className="btn btn-ghost h-11 px-5">On the map</a>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function LocalsSection({ compact = false, only }: { compact?: boolean; only?: string }) {
  if (only) {
    const l = LOCALS.find((x) => x.id === only);
    return l ? <div className="relative h-full overflow-hidden rounded-[22px] border border-white/10"><Clip l={l} /></div> : null;
  }
  if (compact) {
    // the hero rail has room for two faces; the others are one tap away on /locals
    const more = LOCALS.slice(2);
    return (
      <div className="flex h-full flex-col gap-2.5">
        {LOCALS.slice(0, 2).map((l) => <Card key={l.id} l={l} compact />)}
        {more.length > 0 && (
          <Link href="/locals" className="group flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/5 p-2 transition-colors hover:border-pink/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {more.map((m) => <img key={m.id} src={m.poster} alt="" className="size-10 rounded-full object-cover object-top" />)}
            <span className="min-w-0 flex-1 text-[13px]"><b className="block">Meet {more.map((m) => m.name).join(", ")}</b><i className="not-italic text-haze">and the rest of Leonida</i></span>
            <span className="text-haze transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        )}
      </div>
    );
  }
  return <div className="mx-auto grid max-w-[760px] gap-[18px] md:grid-cols-2">{LOCALS.map((l) => <Card key={l.id} l={l} />)}</div>;
}
