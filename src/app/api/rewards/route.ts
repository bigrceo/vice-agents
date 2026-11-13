import { myPick, pick, rewardState } from "@/lib/rewards";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (address) return Response.json({ agent: await myPick(address) });
  return Response.json(await rewardState(), { headers: { "cache-control": "public, s-maxage=10, stale-while-revalidate=30" } });
}
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  try { return Response.json(await pick(String(b.address ?? "").trim(), String(b.agent ?? ""))); }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
