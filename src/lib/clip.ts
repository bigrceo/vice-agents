import "server-only";

export type Platform = "tiktok" | "instagram" | "youtube" | "x" | "direct" | "other";
export type Resolved = { platform: Platform; url: string; title?: string; author?: string; thumbnail?: string; videoUrl?: string; needsUpload: boolean; note?: string };

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export function normalizeLink(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  try { return new URL(s).toString(); } catch { return null; }
}

export function platformOf(u: string): Platform {
  const h = new URL(u).hostname.replace(/^www\.|^m\.|^vm\.|^vt\./, "");
  if (h.endsWith("tiktok.com")) return "tiktok";
  if (h.endsWith("instagram.com")) return "instagram";
  if (h === "youtube.com" || h === "youtu.be") return "youtube";
  if (h === "x.com" || h === "twitter.com" || h.endsWith("fxtwitter.com") || h.endsWith("vxtwitter.com")) return "x";
  if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u)) return "direct";
  return "other";
}

async function json(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: { "user-agent": UA, accept: "application/json", ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

/** Optional self-hosted cobalt instance (github.com/imputnet/cobalt): resolves every platform to a file. */
async function cobalt(url: string): Promise<string | undefined> {
  const api = process.env.COBALT_API_URL;
  if (!api) return;
  try {
    const j = await json(api, { method: "POST", headers: { "content-type": "application/json", ...(process.env.COBALT_API_KEY ? { authorization: `Api-Key ${process.env.COBALT_API_KEY}` } : {}) },
      body: JSON.stringify({ url, videoQuality: "720", downloadMode: "mute" }) });
    return j.url ?? j.picker?.find((p: any) => p.type === "video")?.url;
  } catch { return; }
}

export async function resolveClip(raw: string): Promise<Resolved> {
  const url = normalizeLink(raw);
  if (!url) throw new Error("That doesn't look like a link.");
  const platform = platformOf(url);
  const out: Resolved = { platform, url, needsUpload: true };

  if (platform === "direct") return { ...out, videoUrl: url, needsUpload: false };

  if (platform === "x") {
    const id = /status(?:es)?\/(\d+)/.exec(url)?.[1];
    if (id) {
      try {
        const j = await json(`https://api.fxtwitter.com/i/status/${id}`);
        const t = j.tweet;
        const v = t?.media?.videos?.[0] ?? t?.media?.all?.find((m: any) => m.type === "video" || m.type === "gif");
        Object.assign(out, { title: t?.text?.slice(0, 80), author: t?.author?.screen_name ? "@" + t.author.screen_name : undefined, thumbnail: v?.thumbnail_url });
        if (v?.url) return { ...out, videoUrl: v.url, needsUpload: false };
      } catch { /* fall through */ }
    }
  }

  if (platform === "tiktok") {
    try {
      const o = await json(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      Object.assign(out, { title: o.title, author: o.author_unique_id ? "@" + o.author_unique_id : o.author_name, thumbnail: o.thumbnail_url });
    } catch { /* ignore */ }
    try {
      const j = await json(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
      const play = j?.data?.play as string | undefined;
      if (play) return { ...out, videoUrl: play.startsWith("http") ? play : `https://www.tikwm.com${play}`, needsUpload: false };
    } catch { /* ignore */ }
  }

  if (platform === "youtube") {
    try {
      const o = await json(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
      Object.assign(out, { title: o.title, author: o.author_name, thumbnail: o.thumbnail_url });
    } catch { /* ignore */ }
  }

  const c = await cobalt(url);
  if (c) return { ...out, videoUrl: c, needsUpload: false };
  return { ...out, note: "We found the post but can't fetch its video. Drop the video file to continue." };
}

/** Downloads a resolved video, capped in size. */
export async function downloadVideo(videoUrl: string, maxBytes = 60_000_000): Promise<Buffer> {
  const r = await fetch(videoUrl, { headers: { "user-agent": UA, referer: new URL(videoUrl).origin }, signal: AbortSignal.timeout(25_000) });
  if (!r.ok || !r.body) throw new Error("Couldn't download the video. Drop the file instead.");
  const len = Number(r.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new Error("That video is too big (60 MB max).");
  const chunks: Uint8Array[] = []; let total = 0;
  const reader = r.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { reader.cancel(); throw new Error("That video is too big (60 MB max)."); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
