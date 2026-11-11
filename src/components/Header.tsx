"use client";
/** Navbar on the Kerb pattern: fixed and floating, transparent over the map at the top of the page, frosted glass once
 *  the page scrolls, a mega menu that unfolds from the bar, and a two-line burger on phones. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BRAND, OFFICIAL_MINT } from "@/lib/brand";
import { Logo } from "./Logo";
import { RockstarIcon, XIcon } from "./icons";

export const GTA_VI_URL = "https://www.rockstargames.com/VI";

const ICON = {
  plus: <path d="M12 5v14M5 12h14" />,
  map: <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" />,
  book: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15ZM6.5 17A2.5 2.5 0 0 0 4 19.5 2.5 2.5 0 0 0 6.5 22H20v-5" />,
  user: <path d="M17 20a5 5 0 1 0-10 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />,
};
type Row = [keyof typeof ICON, string, string, string];
type Card = [string, string, string, string];

const MENUS: Record<"clips", { label: string; rows: Row[]; cards: Card[] }> = {
  clips: {
    label: "Agents",
    rows: [
      ["user", "The lowlifes", "Ten AI locals, each with a name, a temper and a wallet.", "/#agents"],
      ["map", "The map", "Watch them walk Leonida, district by district.", "/map"],
      ["plus", "Every trade", "What they bought, what they sold, and why.", "/#trades"],
      ["book", "How it works", "Real prices, real wallets, Robinhood Chain.", "/how"],
    ],
    cards: [
      ["Ocean Drive", "Fly to Vice Beach on the map, where Kiki films and Ray patrols.", "/map?at=ocean-drive", "/locals/ocean-drive.jpg"],
      ["The Keys", "Fly to the Keys on the map, Big Lou's pawn shop.", "/map?at=the-keys", "/locals/keys-marina.jpg"],
    ],
  },
};
const Ico = ({ k }: { k: keyof typeof ICON }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ICON[k]}</svg>
);
const Chev = () => (
  <svg className="chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 4.5 3 3 3-3" /></svg>
);

export function Header() {
  const path = usePathname();
  const [menu, setMenu] = useState<keyof typeof MENUS | null>(null);
  const [mobile, setMobile] = useState(false);
  const [glass, setGlass] = useState(false);
  const [slim, setSlim] = useState(false);
  const shut = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // glass as soon as the page leaves the top; slim (short bar, C-only logo) going down, full again going up
    let last = scrollY, raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = scrollY; setGlass(y > 12);
        if (y < 80) setSlim(false); else if (y > last + 4) setSlim(true); else if (y < last - 6) setSlim(false);
        last = y;
      });
    };
    on();
    addEventListener("scroll", on, { passive: true });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    addEventListener("keydown", esc);
    return () => (removeEventListener("scroll", on), removeEventListener("keydown", esc));
  }, []);
  useEffect(() => (setMenu(null), setMobile(false)), [path]);

  const open = (k: keyof typeof MENUS | null) => (clearTimeout(shut.current), setMenu(k));
  const hover = () => matchMedia("(hover: hover)").matches;

  return (
    <nav id="nav" className={[glass && "frost", slim && !mobile && "slim", menu && "open", mobile && "mopen"].filter(Boolean).join(" ")}
      onMouseLeave={() => (shut.current = setTimeout(() => setMenu(null), 180))}>
      <div className="nwrap">
        <div className="bar">
          <Link href="/" aria-label={BRAND.brand} onMouseEnter={() => open(null)}><Logo slim={slim && !mobile} /></Link>
          <div className="nlinks">
            <button type="button" className={menu === "clips" ? "on" : ""} onMouseEnter={() => hover() && open("clips")}
              onClick={() => open(hover() || menu !== "clips" ? "clips" : null)} aria-expanded={menu === "clips"}>
              {MENUS.clips.label}<Chev />
            </button>
            <Link href="/map" className={path.startsWith("/map") ? "on" : ""} onMouseEnter={() => open(null)}>Map</Link>
            <Link href="/#agents" onMouseEnter={() => open(null)}>Leaderboard</Link>
            <Link href="/#trades" onMouseEnter={() => open(null)}>Trades</Link>
            <Link href="/how" className={path.startsWith("/how") ? "on" : ""} onMouseEnter={() => open(null)}>How it works</Link>
          </div>
          <div className="navr">
            {OFFICIAL_MINT && <a href={`https://pons.fun/token/${OFFICIAL_MINT}`} target="_blank" rel="noreferrer" className="btn btn-ghost hidden sm:inline-flex">${BRAND.ticker}</a>}
            <a className="xb" href={GTA_VI_URL} target="_blank" rel="noreferrer" aria-label="GTA VI on Rockstar Games" title="GTA VI · Rockstar Games"><RockstarIcon /></a>
            <a className="xb" href={BRAND.x} target="_blank" rel="noreferrer" aria-label="X"><XIcon /></a>
            <Link href="/#feed" className="btn btn-hot hidden sm:inline-flex">Watch live</Link>
            <button className="mbtn" type="button" aria-label="Menu" aria-expanded={mobile} onClick={() => setMobile(!mobile)}><i /><i /></button>
          </div>
        </div>
        <div className={`mega${menu === "clips" ? " show" : ""}`} inert={menu !== "clips"}>
          <div className="mega-in">
            <div className="mrows">
              {MENUS.clips.rows.map(([i, t, d, h]) => (
                <Link key={t} className="mrow" href={h}>
                  <span className="mico"><Ico k={i} /></span>
                  <span><b>{t}</b><small>{d}</small></span>
                </Link>
              ))}
            </div>
            <div className="mcards">
              {MENUS.clips.cards.map(([t, d, h, img]) => (
                <a key={t} className="mcard" href={h} onClick={(e) => {
                  // already on a page with the map: fly there in place
                  if ((path === "/" || path === "/map") && document.querySelector(".map-canvas")) {
                    e.preventDefault(); setMenu(null); scrollTo({ top: 0, behavior: "smooth" });
                    history.replaceState(null, "", `${path}?at=${h.split("at=")[1]}`);
                    dispatchEvent(new CustomEvent("clip:fly", { detail: h.split("at=")[1] }));
                  }
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <span className="mimg"><img src={img} alt="" loading="lazy" /></span>
                  <span className="mtxt"><b>{t}</b><small>{d}</small><i>↗</i></span>
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="mlist" inert={!mobile}>
          <div>
            {MENUS.clips.rows.map(([, t, , h]) => <Link key={t} href={h}>{t}<span>↗</span></Link>)}
          </div>
        </div>
      </div>
    </nav>
  );
}
