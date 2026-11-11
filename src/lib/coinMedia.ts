import "server-only";
import { getRawCoin } from "./data";
import { MOCK_COINS } from "./mock";
import { demoClip } from "./media";
import { getFile } from "./storage";

const demo = new Map<string, Promise<{ loop: Buffer; still: Buffer }>>();
export async function coinMedia(mint: string, kind: "still" | "loop"): Promise<Response> {
  const mockIdx = MOCK_COINS.findIndex((c) => c.mint === mint);
  let buf: Buffer | null = null;
  if (mockIdx >= 0) {
    if (!demo.has(mint)) demo.set(mint, demoClip(mockIdx + 1));
    buf = (await demo.get(mint)!)[kind];
  } else {
    const c = await getRawCoin(mint);
    const ref = kind === "still" ? c?.still : c?.loop;
    if (ref?.startsWith("http")) return Response.redirect(ref, 302);
    if (ref) buf = await getFile(ref);
  }
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "content-type": kind === "still" ? "image/jpeg" : "video/mp4", "cache-control": "public, max-age=86400, immutable" } });
}
