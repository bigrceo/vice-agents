import { getTown } from "@/lib/agents/data";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await getTown(), { headers: { "cache-control": "public, s-maxage=2, stale-while-revalidate=5" } });
}
