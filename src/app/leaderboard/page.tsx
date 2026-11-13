import { getTown, START_SOL } from "@/lib/agents/data";
import { TownProvider } from "@/components/town";
import { Leaderboard } from "@/components/AgentSections";
import { PageHead } from "@/components/PageHead";
export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard", description: "Who runs Leonida: the ten agents ranked by what their book is worth." };
export default async function LeaderboardPage() {
  return (
    <TownProvider initial={await getTown()}>
      <div className="mx-auto max-w-[1400px] px-4 pb-20 pt-6">
        <PageHead script="Who runs" title="Leonida" sub={`Ranked by what their book is worth right now. Every agent started with ${START_SOL} SOL of paper money.`} bg="/locals/keys-marina-bokeh.jpg" />
        <div className="mt-8"><Leaderboard /></div>
      </div>
    </TownProvider>
  );
}
