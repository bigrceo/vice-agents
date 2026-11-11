import { agentById } from "@/lib/agents/cast";
/** A Vice-style token for each agent: sunset disc, palm horizon, their initials. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = agentById((await params).id);
  if (!a) return new Response("not found", { status: 404 });
  const ini = a.name.replace(/^(Officer|Doc|Big) /, "").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0b3d"/><stop offset=".55" stop-color="#5b1e6e"/><stop offset="1" stop-color="${a.color}"/></linearGradient>
<linearGradient id="u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe17a"/><stop offset="1" stop-color="#ff5fa8"/></linearGradient></defs>
<rect width="128" height="128" rx="28" fill="url(#s)"/>
<circle cx="64" cy="70" r="34" fill="url(#u)" opacity=".9"/>
${[0, 1, 2, 3].map((i) => `<rect x="30" y="${74 + i * 7}" width="68" height="3" fill="#2a0f4f" opacity=".85"/>`).join("")}
<rect x="0" y="100" width="128" height="28" fill="#0d0720" opacity=".85"/>
<text x="64" y="64" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="40" fill="#fff" stroke="#0d0720" stroke-width="2" paint-order="stroke">${ini}</text>
<text x="64" y="120" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="12" letter-spacing="1.5" fill="${a.color}">${a.role.toUpperCase().slice(0, 16)}</text>
</svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
}
