import { standings, weekId } from "@/lib/rewards";
export const dynamic = "force-dynamic";
/** A finished week's final table (the worker reads it to pay the winners). */
export async function GET(req: Request) {
  const week = new URL(req.url).searchParams.get("week") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || week >= weekId()) return Response.json({ error: "week not over" }, { status: 400 });
  return Response.json({ week, standings: await standings(week) });
}
