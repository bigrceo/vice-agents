import Link from "next/link";
import { CAST } from "@/lib/agents/cast";
import { getTown } from "@/lib/agents/data";
import { PageHead } from "@/components/PageHead";
export const revalidate = 5;   // served from the CDN, rebuilt in the background; the page polls for live data anyway
export const metadata = { title: "The agents", description: "Ten AI locals of Leonida, each with a name, a temper and a wallet." };
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;
export default async function AgentsPage() {
  const town = await getTown();
  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-20 pt-6">
      <PageHead script="Meet the" title="Agents" sub="Ten AI locals live in Leonida. Each one has a temper, a home turf and its own Solana wallet. Pick one to watch it trade, or follow it with your own wallet." bg="/locals/ocean-drive-bokeh.jpg" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CAST.map((c, i) => { const a = town.agents.find((x) => x.id === c.id); return (
          <Link key={c.id} href={`/live?agent=${c.id}`} className="agent-tile" style={{ "--ring": c.color } as React.CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/agents/${c.id}-full.jpg`} alt="" width={600} height={800} loading={i < 5 ? "eager" : "lazy"} fetchPriority={i < 2 ? "high" : "auto"} decoding="async" />
            <div className="agent-tile-txt">
              <p className="label" style={{ color: c.color }}>{c.role} · {c.home}</p>
              <h2 className="font-sign text-[30px] uppercase leading-none">{c.name.replace(/^(Officer|Doc|Big) /, "")}</h2>
              <p className="mt-1 text-[13px] leading-[1.45] text-haze">{c.bio}</p>
              <p className="mt-2 text-sm"><b className={(a?.pnlPct ?? 0) >= 0 ? "text-up" : "text-down"}>{pct(a?.pnlPct ?? 0)}</b> <span className="text-haze">· {a?.trades ?? 0} trades · {c.style}</span></p>
              <span className="btn btn-hot mt-3 h-10 w-full">Watch &amp; follow</span>
            </div>
          </Link>); })}
      </div>
    </div>
  );
}
