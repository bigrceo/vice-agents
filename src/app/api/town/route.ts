import { getTown } from "@/lib/agents/data";
export const dynamic = "force-dynamic";
export async function GET() {
  const t = await getTown();
  return Response.json(t, { headers: { "cache-control": t.empty ? "no-store" : "public, s-maxage=2, stale-while-revalidate=5" } });
}
