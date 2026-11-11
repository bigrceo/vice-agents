"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MapPicker, type MapPos } from "./MapPicker";
import { BRAND, EXPLORER, ponsUrl } from "@/lib/brand";
import { useWallet } from "./wallet";
import { CopyButton } from "./toast";

type Draft = { ref: string; title?: string; author?: string };
type Step = "source" | "crop" | "map" | "details" | "done";
const fileUrl = (ref: string) => `/api/drafts/file?ref=${encodeURIComponent(ref)}`;

export function LaunchFlow({ initialUrl, initialRef }: { initialUrl?: string; initialRef?: string }) {
  const w = useWallet();
  const [step, setStep] = useState<Step>(initialRef ? "crop" : "source");
  const [url, setUrl] = useState(initialUrl ?? "");
  const [draft, setDraft] = useState<Draft | null>(initialRef ? { ref: initialRef } : null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [note, setNote] = useState("");
  const [sponsored, setSponsored] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/launch/status").then((r) => r.json()).then((d) => setSponsored(Boolean(d.sponsored))).catch(() => setSponsored(false)); }, []);
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 1, start: 0, length: 4 });
  const [render, setRender] = useState<{ stillRef: string; loopRef: string } | null>(null);
  const [form, setForm] = useState({ name: "", ticker: "", description: "", recipient: "", firstBuyEth: "" });
  const [done, setDone] = useState<{ mint: string; sig: string; dryRun?: boolean } | null>(null);
  const [mapPos, setMapPos] = useState<MapPos | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const STEPS: Step[] = ["source", "crop", "map", "details", "done"];
  const at = STEPS.indexOf(step);

  useEffect(() => { if (initialUrl) resolve(initialUrl); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (w.address && !form.recipient) setForm((f) => ({ ...f, recipient: w.address! })); }, [w.address]); // eslint-disable-line

  async function resolve(u: string) {
    setBusy("Finding the video…"); setErr(""); setNote("");
    const r = await fetch("/api/drafts/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: u }) }).then((r) => r.json()).catch(() => ({ error: "Network error" }));
    setBusy("");
    if (r.error) return setErr(r.error);
    if (!r.draft) { setNote(r.note ?? "Drop the video file to continue."); return; }
    setDraft({ ref: r.draft.ref, title: r.title, author: r.author });
    if (r.title) setForm((f) => ({ ...f, name: f.name || r.title.replace(/#\S+/g, "").trim().slice(0, 32) }));
    setStep("crop");
  }
  async function upload(f: File) {
    setBusy("Uploading…"); setErr("");
    try {
      if (f.size > 60_000_000) throw new Error("That video is too big (60 MB max).");
      if (!/^video\//.test(f.type) && !/\.(mp4|mov|webm|m4v)$/i.test(f.name)) throw new Error("That isn't a video.");
      const { upload: put } = await import("@vercel/blob/client");
      const id = crypto.randomUUID();
      const b = await put(`drafts/${id}/video`, f, { access: "public", handleUploadUrl: "/api/drafts/token", contentType: f.type || "video/mp4" });
      setDraft({ ref: b.url }); setStep("crop");
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(""); }
  }
  async function doRender() {
    if (!draft) return;
    setBusy("Cutting your loop…"); setErr("");
    const r = await fetch("/api/drafts/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: draft.ref, crop }) }).then((r) => r.json()).catch(() => ({ error: "Render failed" }));
    setBusy("");
    if (r.error) return setErr(r.error);
    setRender(r); setStep("map");
  }
  async function launch() {
    if (!render) return;
    setErr("");
    const buy = Number(form.firstBuyEth || 0);
    let buyer: string | undefined;
    if (buy > 0 || sponsored === false || !form.recipient) { buyer = w.address ?? (await w.connect()) ?? undefined; if (!buyer) return setErr("Connect a wallet to continue."); }
    const recipient = form.recipient || buyer || "";
    setBusy("Creating your coin on Pons…");
    try {
      const body = { name: form.name, ticker: form.ticker, description: form.description, recipient,
        stillRef: render.stillRef, loopRef: render.loopRef, sourceUrl: url || undefined, mapU: mapPos?.u, mapV: mapPos?.v };
      let r = await fetch("/api/launch/prepare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (r.error) throw new Error(r.error);
      if (r.dryRun) { setDone({ mint: "", sig: "", dryRun: true }); setStep("done"); return; }
      if (!r.sponsored) {
        // The platform wallet can't pay right now: the creator's wallet sends the exact same launch.
        setBusy("Approve the launch in your wallet (Pons launch fee + gas)…");
        const hash = await w.send(r.tx);
        setBusy("Confirming on Robinhood Chain…");
        r = await fetch("/api/launch/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hash, payload: r.payload }) }).then((r) => r.json());
        if (r.error) throw new Error(r.error);
      }
      setDone(r);
      if (buy > 0 && buyer) {
        try {
          setBusy("Coin is live. Approve your first buy…");
          const q = await fetch("/api/trade/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint: r.mint, wallet: buyer, side: "buy", amount: buy }) }).then((r) => r.json());
          if (q.error) throw new Error(q.error);
          for (const tx of q.txs) await w.wait(await w.send(tx));
        } catch (e) { setErr("Your coin is live, but the first buy didn't go through: " + (e instanceof Error ? e.message.split("\n")[0] : String(e)) + ". Buy it from the coin page."); }
      }
      setStep("done");
    } catch (e) { setErr(e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : String(e)); } finally { setBusy(""); }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-sign text-3xl sm:text-4xl">Launch a clip</h1>
      <p className="mt-2 text-haze">{sponsored === false ? "Your coin goes live on Pons, Robinhood Chain, in one transaction from your wallet (Pons launch fee + gas)." : `Free: ${BRAND.brand} pays the launch. Your coin goes live on Pons, Robinhood Chain, in one transaction.`}</p>
      <ol className="mt-6 grid grid-cols-5 gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={step === s ? "step" : undefined} className={`label transition-colors ${i === at ? "!text-coral" : i < at ? "!text-ink" : ""}`}>
            <span className="mb-1.5 block h-1 overflow-hidden bg-line"><span className={`block h-full origin-left transition-transform duration-500 ease-[var(--ease-snap)] ${i === at ? "bg-coral" : "bg-sun"} ${i <= at ? "scale-x-100" : "scale-x-0"}`} /></span>
            {i + 1} {s === "source" ? "Clip" : s === "crop" ? "Square" : s === "map" ? "Map" : s === "details" ? "Coin" : "Live"}
          </li>
        ))}
      </ol>
      <div key={step} className="enter glass-map relative mt-4 overflow-hidden p-4 sm:p-6">
        {step === "source" && (
          <div className="space-y-4">
            <form onSubmit={(e) => { e.preventDefault(); if (url.trim()) resolve(url.trim()); }} className="flex flex-col gap-2 sm:flex-row">
              <input className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="tiktok.com/@…/video/…, instagram.com/reel/…, youtube.com/shorts/…, x.com/…/status/…" />
              <button className="btn btn-hot h-11">Fetch</button>
            </form>
            <div role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && file.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
              onClick={() => file.current?.click()} className={`cursor-pointer border-2 border-dashed p-8 text-center transition-[border-color,background-color,color] duration-150 hover:border-coral ${over ? "border-sun bg-deck-hi text-sun" : "border-line text-haze"}`}>
              Or drop a video here (mp4, mov, webm, 60 MB max)
            </div>
            <input ref={file} type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            {note && <p className="text-sun">{note}</p>}
            <p className="text-sm text-haze">Tip: put {BRAND.name}/ before any clip link to start from it.</p>
          </div>
        )}
        {step === "crop" && draft && <CropPicker src={fileUrl(draft.ref)} crop={crop} onChange={setCrop} onDone={doRender} />}
        {step === "map" && <MapPicker value={mapPos} onChange={setMapPos} onDone={() => setStep("details")} />}
        {step === "details" && render && (
          <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
            <video src={fileUrl(render.loopRef)} autoPlay loop muted playsInline className="aspect-square w-full bg-night object-cover" />
            <div className="space-y-3">
              <L t="Name"><input className="field" maxLength={32} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></L>
              <L t="Ticker"><input className="field uppercase" maxLength={10} value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase() })} /></L>
              <L t="Description (optional)"><input className="field" maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></L>
              <L t="Creator fees go to">
                <div className="flex gap-2">
                  <input className="field" placeholder="0x… address on Robinhood Chain (or connect)" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value.trim() })} />
                  {!w.address && <button type="button" onClick={w.connect} className="btn btn-ghost h-11 shrink-0">Connect</button>}
                </div>
              </L>
              <L t="First buy in ETH (optional, signed by your wallet)"><input className="field" inputMode="decimal" placeholder="0" value={form.firstBuyEth} onChange={(e) => setForm({ ...form, firstBuyEth: e.target.value.replace(/[^0-9.]/g, "") })} /></L>
              <button onClick={launch} disabled={!!busy} className="btn btn-hot h-12 w-full text-lg">Launch ${form.ticker || "COIN"}</button>
              <button onClick={() => setStep("crop")} className="label hover:!text-ink">Back to the square</button>
            </div>
          </div>
        )}
        {step === "done" && done && (
          <div className="space-y-4 py-2 text-center">
            {!done.dryRun && <Confetti />}
            {render && <video src={fileUrl(render.loopRef)} autoPlay loop muted playsInline className="pop mx-auto size-32 border-2 border-ink object-cover shadow-[6px_6px_0_var(--color-pink)]" />}
            <p className="pop font-sign text-3xl text-sun [animation-delay:.1s]">{done.dryRun ? "Dry run complete" : `$${form.ticker || "COIN"} is live`}</p>
            {done.dryRun && <p className="text-sun">LAUNCH_DRY_RUN is on: the launch was simulated, nothing was sent on chain.</p>}
            {done.mint && <div className="flex flex-wrap items-center justify-center gap-2"><span className="break-all text-sm text-haze">{done.mint}</span><CopyButton text={done.mint} /></div>}
            {!done.dryRun && <div className="flex flex-wrap justify-center gap-2">
              <Link href={`/coin/${done.mint}`} className="btn btn-hot">Open coin</Link>
              <a className="btn btn-ghost" target="_blank" rel="noreferrer"
                href={`https://x.com/intent/post?text=${encodeURIComponent(`$${form.ticker} is live on ${BRAND.name}`)}&url=${encodeURIComponent(`${location.origin}/coin/${done.mint}`)}`}>Share on X</a>
              <a href={ponsUrl(done.mint)} target="_blank" rel="noreferrer" className="btn btn-ghost">Pons</a>
              <a href={`${EXPLORER}/tx/${done.sig}`} target="_blank" rel="noreferrer" className="btn btn-ghost">Explorer</a></div>}
          </div>
        )}
        {busy && <div role="status" className="enter mt-4"><p className="text-ink">{busy}</p><div className="skeleton mt-2 h-2 border border-line" /></div>}
        {err && <p role="alert" className="enter mt-4 border-l-4 border-down pl-3 text-down">{err}</p>}
      </div>
    </div>
  );
}

/** CSS-only confetti burst: square bits in the party colours. */
function Confetti() {
  const cols = ["#ff2d7a", "#ff9b3d", "#48d6ff", "#5cff9d", "#ffffff", "#c76bff"];
  return <div aria-hidden className="pointer-events-none absolute inset-0">{Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2, d = 140 + ((i * 53) % 120);
    return <span key={i} className="confetti" style={{ background: cols[i % cols.length], animationDelay: `${(i % 6) * 20}ms`,
      ["--x" as string]: `${Math.cos(a) * d}px`, ["--y" as string]: `${Math.sin(a) * d * 0.8 + 60}px`, ["--r" as string]: `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg` }} />;
  })}</div>;
}

const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block space-y-1"><span className="label">{t}</span>{children}</label>;

/** Square crop over the video: drag to move, slider to size, scrub the start of the loop. */
function CropPicker({ src, crop, onChange, onDone }: { src: string; crop: { x: number; y: number; size: number; start: number; length: number }; onChange: (c: any) => void; onDone: () => void }) {
  const v = useRef<HTMLVideoElement>(null); const box = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: 1, h: 1, d: 0 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [grab, setGrab] = useState(false);
  const side = Math.min(dim.w, dim.h) * crop.size; // px in video space
  const fw = side / dim.w, fh = side / dim.h;     // fractions of frame
  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
  useEffect(() => { if (v.current && dim.d) v.current.currentTime = crop.start; }, [crop.start, dim.d]);
  return (
    <div className="space-y-4">
      <p className="label text-center">Drag the square to frame your clip</p>
      <div ref={box} className="relative mx-auto w-fit max-w-full touch-none select-none overflow-hidden bg-night">
        <video ref={v} src={src} muted playsInline loop autoPlay className="block max-h-[60vh] max-w-full"
          onLoadedMetadata={(e) => { const t = e.currentTarget; setDim({ w: t.videoWidth, h: t.videoHeight, d: t.duration }); onChange({ ...crop, x: (1 - Math.min(t.videoWidth, t.videoHeight) / t.videoWidth) / 2, y: (1 - Math.min(t.videoWidth, t.videoHeight) / t.videoHeight) / 2 }); }} />
        <div className={`absolute border-2 shadow-[0_0_0_9999px_rgba(20,18,58,.6)] transition-colors ${grab ? "cursor-grabbing border-sun" : "cursor-grab border-coral"}`}
          style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${fw * 100}%`, height: `${fh * 100}%` }}
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y }; setGrab(true); }}
          onPointerMove={(e) => { if (!drag.current || !box.current) return; const r = box.current.getBoundingClientRect();
            onChange({ ...crop, x: clamp(drag.current.cx + (e.clientX - drag.current.x) / r.width, 1 - fw), y: clamp(drag.current.cy + (e.clientY - drag.current.y) / r.height, 1 - fh) }); }}
          onPointerUp={() => { drag.current = null; setGrab(false); }} onPointerCancel={() => { drag.current = null; setGrab(false); }}>
          <span aria-hidden className={`pointer-events-none absolute inset-0 transition-opacity ${grab ? "opacity-100" : "opacity-0"} bg-[linear-gradient(to_right,transparent_33%,rgb(255_255_255/.35)_33%,rgb(255_255_255/.35)_calc(33%+1px),transparent_calc(33%+1px),transparent_66%,rgb(255_255_255/.35)_66%,rgb(255_255_255/.35)_calc(66%+1px),transparent_calc(66%+1px)),linear-gradient(to_bottom,transparent_33%,rgb(255_255_255/.35)_33%,rgb(255_255_255/.35)_calc(33%+1px),transparent_calc(33%+1px),transparent_66%,rgb(255_255_255/.35)_66%,rgb(255_255_255/.35)_calc(66%+1px),transparent_calc(66%+1px))]`} />
          {["-left-1 -top-1", "-right-1 -top-1", "-left-1 -bottom-1", "-right-1 -bottom-1"].map((p) => <span key={p} aria-hidden className={`pointer-events-none absolute size-2.5 bg-sun ${p}`} />)}
        </div>
      </div>
      <label className="block"><span className="label">Square size</span>
        <input type="range" min={0.3} max={1} step={0.01} value={crop.size} className="w-full accent-coral"
          onChange={(e) => { const s = +e.target.value; const nfw = Math.min(dim.w, dim.h) * s / dim.w, nfh = Math.min(dim.w, dim.h) * s / dim.h; onChange({ ...crop, size: s, x: clamp(crop.x, 1 - nfw), y: clamp(crop.y, 1 - nfh) }); }} /></label>
      <label className="block"><span className="label">Loop starts at {crop.start.toFixed(1)} s</span>
        <input type="range" min={0} max={Math.max(0, dim.d - 1)} step={0.1} value={crop.start} className="w-full accent-coral" onChange={(e) => onChange({ ...crop, start: +e.target.value })} /></label>
      <label className="block"><span className="label">Loop length {crop.length} s</span>
        <input type="range" min={1} max={6} step={0.5} value={crop.length} className="w-full accent-coral" onChange={(e) => onChange({ ...crop, length: +e.target.value })} /></label>
      <button onClick={onDone} className="btn btn-hot h-12 w-full">Use this square</button>
    </div>
  );
}
