import { isAddress } from "@/lib/sol/solana";
import sharp from "sharp";
import { sqlClient } from "@/lib/db";
/**
 * The real image of a Solana coin, by mint: the icon the worker stored, else Jupiter's, else DexScreener's. IPFS links are raced
 * across gateways. The first fetch shrinks it to a 96px WebP kept in Postgres (la_logos), so every later request, on any edge, is a
 * fast DB read; the worker warms new coins before anyone sees them. Cached a year at the edge. No image: 404, the page draws initials.
 */
const GATEWAYS = ["https://ipfs.io/ipfs/", "https://gateway.pinata.cloud/ipfs/", "https://dweb.link/ipfs/", "https://w3s.link/ipfs/"];
const LONG = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=31536000, immutable";

const cidOf = (u: string) => u.match(/^ipfs:\/\/(?:ipfs\/)?(.+)$/)?.[1] ?? u.match(/\/ipfs\/([A-Za-z0-9]{40,}.*)$/)?.[1] ?? null;
const variants = (u: string) => { const c = cidOf(u); return c ? GATEWAYS.map((g) => g + c) : /^https:\/\//.test(u) ? [u] : []; };

async function get(url: string) {
  const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(6000) });
  const type = r.headers.get("content-type") ?? "";
  if (!r.ok || !type.startsWith("image/")) throw new Error("not an image");
  return { type, body: await r.arrayBuffer() };
}

async function candidates(mint: string): Promise<string[]> {
  const out: string[] = [];
  if (process.env.DATABASE_URL) {
    const rows = await sqlClient()`select logo from la_prices where token = ${mint} and logo <> '' limit 1`.catch(() => []);
    if (rows[0]?.logo) out.push(rows[0].logo);
  }
  const jup = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).catch(() => []);
  const t = Array.isArray(jup) ? jup.find((x: any) => x.id === mint) : null; if (t?.icon) out.push(t.icon);
  const dex = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).catch(() => []);
  for (const p of Array.isArray(dex) ? dex : []) if (p.info?.imageUrl) { out.push(p.info.imageUrl); break; }
  return [...new Set(out)];
}

const thumb = (b: ArrayBuffer) => sharp(Buffer.from(b), { animated: false }).resize(96, 96, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
const send = (b: Uint8Array, type: string) => new Response(new Uint8Array(b), { headers: { "content-type": type, "cache-control": LONG } });

export async function GET(req: Request) {
  const mint = new URL(req.url).searchParams.get("mint") ?? "";
  if (!isAddress(mint)) return new Response(null, { status: 400 });
  const sql = process.env.DATABASE_URL ? sqlClient() : null;
  if (sql) {
    await sql`create table if not exists la_logos (k text primary key, type text, body bytea, at timestamptz default now())`.catch(() => {});
    const [hit] = await sql`select type, body from la_logos where k = ${mint}`.catch(() => []);
    if (hit) return send(hit.body, hit.type);
  }
  for (const c of await candidates(mint)) {
    const urls = variants(c); if (!urls.length) continue;
    const img = await Promise.any(urls.map(get)).catch(() => null);   // first gateway to answer wins
    if (!img) continue;
    const small = await thumb(img.body).then((b) => ({ type: "image/webp", body: b })).catch(() => ({ type: img.type, body: Buffer.from(img.body) }));
    if (sql) await sql`insert into la_logos (k, type, body) values (${mint}, ${small.type}, ${small.body}) on conflict (k) do nothing`.catch(() => {});
    return send(small.body, small.type);
  }
  return new Response(null, { status: 404, headers: { "cache-control": "public, s-maxage=600" } });
}
