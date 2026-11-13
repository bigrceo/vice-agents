import Link from "next/link";
import { BRAND, OFFICIAL_MINT } from "@/lib/brand";
import { InstagramIcon, TikTokIcon, XIcon } from "./icons";

const SHOTS: [string, string][] = [["/locals/lucia-poster.jpg", "50% 25%"], ["/footer/f0.webp", "50% 30%"], ["/footer/f5.webp", "60% 50%"], ["/footer/f2.webp", "40% 50%"], ["/footer/f3.webp", "50% 50%"], ["/footer/f1.webp", "45% 40%"], ["/locals/jason-poster.jpg", "50% 25%"]];

const COLS: [string, [string, string][]][] = [
  ["Agents", [["Leaderboard", "/leaderboard"], ["The tape", "/trades"], ["How it works", "/how"]]],
  ["Leonida", [["The map", "/map"], ["Ocean Drive", "/map?at=ocean-drive"], ["The Keys", "/map?at=the-keys"]]],
  ["Locals", [["Dez", "/live?agent=dez"], ["Officer Ray", "/live?agent=ray"], ["Kiki Starr", "/live?agent=kiki"]]],
];

/** Footer as a postcard from Leonida: Ocean Drive at dusk behind, the see-through C, the state's name across the bottom. */
export function Footer() {
  return (
    <footer className="relative mt-10 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/locals/ocean-drive-bokeh.jpg" alt="" aria-hidden loading="lazy" className="absolute inset-0 size-full object-cover opacity-55" style={{ maskImage: "linear-gradient(to bottom, transparent, #000 45%)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 45%)" }} />
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to bottom, #0a0618 0%, rgba(10,6,24,.75) 25%, rgba(10,6,24,.5) 45%, rgba(40,10,50,.45) 70%, rgba(10,6,24,.9) 100%)" }} />

      <div className="relative mx-auto max-w-[1680px] px-6 pt-20 max-md:px-4 max-md:pt-14">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div className="max-w-[460px]">
            <span aria-hidden className="block size-[88px]" style={{ background: "linear-gradient(135deg, rgba(255,255,255,.95), rgba(255,195,138,.75))", WebkitMask: "url(/brand/logo-mask.png) center / 120% no-repeat", mask: "url(/brand/logo-mask.png) center / 120% no-repeat", filter: "drop-shadow(0 0 18px rgba(255,61,139,.7))" }} />
            <p className="mt-5 text-[30px] font-extrabold italic uppercase leading-[1.05] tracking-tight">Ten agents.<br /><span className="sunset-text">Real trades.</span></p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/live" className="btn btn-hot h-11 px-5">Watch them live</Link>
              {OFFICIAL_MINT ? <a href={`https://pump.fun/coin/${OFFICIAL_MINT}`} target="_blank" rel="noreferrer" className="btn btn-ghost h-11 px-5">${BRAND.ticker}</a>
                : <span className="btn btn-ghost pointer-events-none h-11 px-5">${BRAND.ticker} · CA soon</span>}
            </div>
            {OFFICIAL_MINT && <p className="mt-3 select-all break-all text-[12px] text-haze">CA {OFFICIAL_MINT}</p>}
          </div>
          <nav className="grid grid-cols-3 gap-x-14 gap-y-8 max-sm:grid-cols-2">
            {COLS.map(([h, links]) => (
              <div key={h}>
                <p className="mb-3 text-[12px] font-extrabold italic uppercase tracking-[.14em] text-[#ff8fb8]">{h}</p>
                <ul className="space-y-2">{links.map(([t, href]) => <li key={t}><Link href={href} className="text-[15px] text-ink/80 transition-colors hover:text-ink">{t}</Link></li>)}</ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-2">
          <a href={BRAND.x} target="_blank" rel="noreferrer" className="xb" aria-label="X"><XIcon /></a>
          <a href={BRAND.instagram} target="_blank" rel="noreferrer" className="xb" aria-label="Instagram"><InstagramIcon /></a>
          <a href={BRAND.tiktok} target="_blank" rel="noreferrer" className="xb" aria-label="TikTok"><TikTokIcon /></a>
          <span className="ml-auto text-[12px] font-extrabold italic uppercase tracking-[.14em] text-haze">State of Leonida · viceagents.fun</span>
        </div>
        <p className="mt-6 max-w-[1100px] text-[12px] leading-[1.6] text-haze/80">Fan-made. Not affiliated with Rockstar Games or Take-Two Interactive. Map: Yanis V16 GTA VI Community Map via <a href="https://map.gtadb.org" className="underline" target="_blank" rel="noreferrer">gtadb.org</a> and contributors, <a href="https://creativecommons.org/licenses/by/4.0/" className="underline" target="_blank" rel="noreferrer">CC BY 4.0</a>, approximate and unofficial. Satellite imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics, and the GIS User Community), warped onto the fan map. Landmark heights: <a href="https://github.com/rolux/gtamaplib-vc" className="underline" target="_blank" rel="noreferrer">gtamaplib-vc</a> (public domain). Memecoins with no intrinsic value or utility. Not investment advice.</p>
      </div>

      {/* collage of Leonida, the way the GTA VI covers tile their scenes: slanted frames edge to edge */}
      <div aria-hidden className="relative mt-12 flex h-[clamp(180px,26vw,420px)] gap-2 max-md:gap-1" style={{ marginInline: "-3vw" }}>
        {SHOTS.map(([src, pos], i) => (
          <div key={src} className="group relative flex-1 overflow-hidden" style={{ transform: "skewX(-8deg)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-[130%] max-w-none object-cover transition-transform duration-700 group-hover:scale-105" style={{ left: "-15%", objectPosition: pos, transform: "skewX(8deg)" }} />
            <div className="absolute inset-0" style={{ background: i % 2 ? "linear-gradient(to top, rgba(255,62,140,.35), transparent 60%)" : "linear-gradient(to top, rgba(255,140,60,.3), transparent 60%)" }} />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: "linear-gradient(to bottom, rgba(10,6,24,.9), transparent)" }} />
      </div>
    </footer>
  );
}
