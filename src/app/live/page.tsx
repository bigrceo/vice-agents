import { LiveBoard } from "@/components/LiveBoard";
import { getTown } from "@/lib/agents/data";
import { CAST } from "@/lib/agents/cast";
import { liveCoins } from "@/lib/agents/live";
export const dynamic = "force-dynamic";
export const metadata = { title: "Watch live", description: "The trenches of Leonida, live: fresh launches, the final stretch, migrated coins and every agent trade. Copy any of them." };
export default async function LivePage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const { agent } = await searchParams;
  const [town, coins] = await Promise.all([getTown(), liveCoins().catch(() => [])]);
  return <LiveBoard initial={{ ...town, coins }} agent={CAST.some((c) => c.id === agent) ? agent : "dez"} />;
}
