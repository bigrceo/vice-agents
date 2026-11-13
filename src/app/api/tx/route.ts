import { connection } from "@/lib/sol/index";
export const dynamic = "force-dynamic";

/** Status of a signature the user just sent from their wallet: { done, ok }. */
export async function GET(req: Request) {
  const sig = new URL(req.url).searchParams.get("sig") ?? "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig)) return Response.json({ done: true, ok: false });
  const { value } = await connection().getSignatureStatuses([sig]).catch(() => ({ value: [null] }));
  const s = value[0];
  if (!s || !s.confirmationStatus || s.confirmationStatus === "processed") return Response.json({ done: false });
  return Response.json({ done: true, ok: !s.err });
}
