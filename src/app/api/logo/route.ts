/**
 * Coin logos: ?cid=… is an IPFS image (pump.fun metadata). It goes through a gateway once and is cached at the edge
 * (public gateways rate-limit browsers). Jupiter's https icons are used directly by the page.
 */
const GATEWAYS = ["https://gateway.pinata.cloud/ipfs/", "https://w3s.link/ipfs/", "https://ipfs.io/ipfs/"];
const LONG = "public, max-age=604800, s-maxage=31536000, immutable";
const miss = () => new Response(null, { status: 302, headers: { location: "/icon.png" } });   // last resort: the site mark, never an empty tile

export async function GET(req: Request) {
  const cid = new URL(req.url).searchParams.get("cid") ?? "";
  if (!/^[A-Za-z0-9/._-]{20,200}$/.test(cid)) return miss();
  for (const g of GATEWAYS) {
    const r = await fetch(g + cid, { redirect: "follow", signal: AbortSignal.timeout(9000) }).catch(() => null);
    const type = r?.headers.get("content-type") ?? "";
    if (r?.ok && type.startsWith("image/")) return new Response(r.body, { headers: { "content-type": type, "cache-control": LONG } });
  }
  return miss();
}
