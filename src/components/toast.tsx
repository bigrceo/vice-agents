"use client";
import { useEffect, useState } from "react";

/** Fire-and-forget toast: toast("Copied") from anywhere on the client. */
export function toast(text: string) { window.dispatchEvent(new CustomEvent("clip-toast", { detail: text })); }

export async function copy(text: string, label = "Copied") {
  try { await navigator.clipboard.writeText(text); toast(label); } catch { toast("Copy failed"); }
}

export function Toaster() {
  const [msg, setMsg] = useState<{ t: string; k: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => { setMsg({ t: (e as CustomEvent<string>).detail, k: Date.now() }); clearTimeout(timer); timer = setTimeout(() => setMsg(null), 1800); };
    window.addEventListener("clip-toast", on);
    return () => { window.removeEventListener("clip-toast", on); clearTimeout(timer); };
  }, []);
  if (!msg) return null;
  return <div key={msg.k} role="status" className="toast border-2 border-night bg-sun px-4 py-2 font-sign text-sm uppercase text-night shadow-[4px_4px_0_var(--color-pink)]">{msg.t}</div>;
}

/** Copy-CA button: square, bordered, toast on success. */
export function CopyButton({ text, label = "Copy CA", className = "" }: { text: string; label?: string; className?: string }) {
  return <button type="button" onClick={() => copy(text, "CA copied")} className={`btn btn-ghost h-9 text-[12px] ${className}`}>{label}</button>;
}
