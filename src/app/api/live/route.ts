import { getTown } from "@/lib/agents/data";
import { liveCoins } from "@/lib/agents/live";
export const dynamic = "force-dynamic";

export async function GET() {
  const [town, list] = await Promise.all([getTown(), liveCoins().catch(() => [])]);
  return Response.json({ ...town, coins: list }, { headers: { "cache-control": town.empty ? "no-store" : "public, s-maxage=4, stale-while-revalidate=30" } });
}
