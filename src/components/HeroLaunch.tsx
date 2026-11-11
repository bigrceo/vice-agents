"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PLATFORMS: [RegExp, string][] = [[/tiktok\.com/i, "TikTok"], [/instagram\.com/i, "Instagram Reels"], [/youtube\.com|youtu\.be/i, "YouTube Shorts"], [/(^|\/\/|\.)(x|twitter)\.com/i, "X"]];
const detect = (u: string) => (/^https?:\/\/|\.com\//i.test(u.trim()) ? PLATFORMS.find(([r]) => r.test(u))?.[1] ?? "Video link" : null);
const ytId = (u: string) => u.match(/(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/)?.[1];

/** Paste a link → /launch?url=…; drop a video → upload, then /launch?ref=… */
export function HeroLaunch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const [nudge, setNudge] = useState(0);
  const [local, setLocal] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const platform = detect(url);
  const yt = ytId(url);
  useEffect(() => () => { if (local) URL.revokeObjectURL(local); }, [local]);
  async function upload(f: File) {
    if (!f.type.startsWith("video/")) return setErr("That is not a video file.");
    setBusy(true); setErr(""); setLocal(URL.createObjectURL(f));
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch("/api/drafts", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({ error: "Upload failed. Try again." }));
    if (r.error) { setBusy(false); setLocal(null); return setErr(r.error); }
    router.push(`/launch?ref=${encodeURIComponent(r.draft.ref)}`);
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); router.push(url.trim() ? `/launch?url=${encodeURIComponent(url.trim())}` : "/launch"); }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
      className={`relative w-full rounded-xl border border-dashed p-2 text-left transition-[border-color,background-color,transform] duration-150 ${compact ? "mt-3.5" : "mx-auto mt-8 max-w-2xl"} ${drag ? "scale-[1.02] border-sun bg-deck-hi" : platform ? "border-sky bg-black/30" : "border-sun/50 bg-black/30"}`}>
      <div className={`flex flex-col gap-2 ${compact ? "" : "sm:flex-row"}`}>
        <input value={url} onChange={(e) => { setUrl(e.target.value); setErr(""); }} onPaste={(e) => { if (detect(e.clipboardData.getData("text"))) setNudge((n) => n + 1); }}
          placeholder="Paste a GTA 6 clip link (TikTok, X, YouTube)" inputMode="url" autoComplete="off"
          className={`min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-haze/70 ${compact ? "h-10" : "h-12"}`} aria-label="Clip link" />
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => file.current?.click()} className={`btn btn-ghost flex-1 whitespace-nowrap ${compact ? "" : "h-12"}`}>{busy ? "Uploading…" : "Drop a capture"}</button>
          <button key={nudge} disabled={busy} className={`btn btn-hot flex-1 px-6 ${compact ? "" : "h-12"} ${nudge ? "nudge" : ""}`}>Launch a clip</button>
        </div>
      </div>
      {(platform || local) && (
        <div className="enter flex items-center gap-3 px-3 pb-1 pt-2 text-sm">
          {local ? <video src={local} muted autoPlay loop playsInline className="size-10 rounded-lg border border-line object-cover" />
            : yt ? <img src={`https://i.ytimg.com/vi/${yt}/default.jpg`} alt="" className="size-10 rounded-lg border border-line object-cover" />
            : <span aria-hidden className="dither size-10 rounded-lg border border-line" />}
          <span className="label !text-sky">{local ? "Uploading your video" : `${platform} detected`}</span>
          <span className="text-haze">{local ? "One sec…" : "Hit Launch to grab it"}</span>
        </div>
      )}
      {drag && <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-night/80 font-sign text-xl text-sun">Drop it</div>}
      <input ref={file} type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {err && <p role="alert" className="px-3 pb-1 pt-2 text-sm text-down">{err}</p>}
    </form>
  );
}
