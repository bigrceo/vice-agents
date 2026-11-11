import { agentById } from "@/lib/agents/cast";
/** A Vice-style token for each agent: sunset disc, palm horizon, their initials. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = agentById((await params).id);
  if (!a) return new Response("not found", { status: 404 });
  const ini = a.name.replace(/^(Officer|Doc|Big) /, "").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0b3d"/><stop offset=".6" stop-color="#4a1660"/><stop offset="1" stop-color="${a.color}"/></linearGradient>
<linearGradient id="u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe17a"/><stop offset="1" stop-color="#ff3d8b"/></linearGradient>
<clipPath id="c"><circle cx="64" cy="64" r="64"/></clipPath></defs>
<g clip-path="url(#c)"><rect width="128" height="128" fill="url(#s)"/>
<circle cx="64" cy="84" r="46" fill="url(#u)"/>
${[0, 1, 2, 3].map((i) => `<rect x="0" y="${92 + i * 9}" width="128" height="${2 + i}" fill="#1a0b3d" opacity=".9"/>`).join("")}
<text x="64" y="80" text-anchor="middle" font-family="'Arial Black', Impact, sans-serif" font-weight="900" font-size="54" fill="#fff" stroke="#140828" stroke-width="5" paint-order="stroke">${ini}</text></g>
</svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
}
