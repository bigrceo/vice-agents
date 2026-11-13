import Link from "next/link";
import { notFound } from "next/navigation";
import { CAST } from "@/lib/agents/cast";
import { getTown } from "@/lib/agents/data";
import { PageHead } from "@/components/PageHead";
import { AssetLogo } from "@/components/AssetLogo";
export const dynamic = "force-dynamic";

/** A place in Leonida: who lives or hangs out there, and what they traded lately. */
const PLACES: Record<string, { name: string; script: string; img: string; at: string; districts: string[]; sub: string; sector: string }> = {
  "ocean-drive": { name: "Ocean Drive", script: "Neon on", img: "/locals/ocean-drive.jpg", at: "ocean-drive", districts: ["Vice Beach", "Dalton Island"],
    sub: "Vice Beach after dark: art deco, ring lights and patrol cars. Kiki films here, Ray patrols here, Marisol sells condos two blocks back.", sector: "Momentum, megacaps and whatever is trending" },
  "the-keys": { name: "The Keys", script: "Down in", img: "/locals/keys-marina.jpg", at: "the-keys", districts: ["Key Lento", "Gloriana Key", "Catalan Key", "Mariana County"],
    sub: "Marinas, pawn shops and slow money. Big Lou prices everything at a discount from behind his counter, and the index funds live here.", sector: "Index funds, gold and hard assets" },
};
export function generateStaticParams() { return Object.keys(PLACES).map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const p = PLACES[(await params).slug]; return p ? { title: p.name, description: p.sub } : {}; }

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const p = PLACES[(await params).slug]; if (!p) notFound();
  const town = await getTown();
  const locals = CAST.filter((c) => p.districts.includes(c.home) || c.haunts.some((h) => p.districts.includes(h)));
  const here = town.agents.filter((a) => p.districts.includes(a.district));
  const trades = town.trades.filter((t) => locals.some((c) => c.id === t.agent)).slice(0, 12);
  return (
    <div className="mx-auto max-w-[1300px] px-4 pb-20 pt-6">
      <div className="place-hero" style={{ backgroundImage: `linear-gradient(180deg, rgba(10,6,24,.15), rgba(10,6,24,.95)), url(${p.img})` }}>
        <PageHead script={p.script} title={p.name} sub={p.sub} />
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/map?at=${p.at}`} className="btn btn-hot h-11 px-5">Fly there on the map</Link>
          <span className="btn btn-ghost h-11 px-5">{here.length} agent{here.length === 1 ? "" : "s"} here right now</span>
        </div>
      </div>
      <h2 className="font-sign mt-10 text-[34px] uppercase">The locals <span className="script !text-[22px]">{p.sector}</span></h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {locals.map((c) => (
          <Link key={c.id} href={`/live?agent=${c.id}`} className="tape-row" style={{ borderLeftColor: c.color }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/agents/${c.id}.jpg`} alt="" />
            <div className="min-w-0"><b>{c.name}</b><p className="text-sm text-haze">{c.role} · {c.home === p.districts[0] || p.districts.includes(c.home) ? "lives here" : "hangs out here"}</p></div>
          </Link>
        ))}
      </div>
      <h2 className="font-sign mt-10 text-[34px] uppercase">Their last trades</h2>
      <div className="mt-4 grid gap-2">
        {trades.map((t) => (
          <div key={t.id} className={`tape-row is-${t.side}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/agents/${t.agent}.jpg`} alt="" />
            <div className="min-w-0 flex-1">
              <p><b>{CAST.find((c) => c.id === t.agent)?.name}</b> <span className={t.side === "buy" ? "text-up" : "text-down"}>{t.side === "buy" ? "bought" : "sold"}</span> <AssetLogo a={t} size={20} className="asset-logo-sm" /><b>${t.symbol}</b></p>
              <p className="text-sm text-haze">{t.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
