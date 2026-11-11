"use client";
import { useState } from "react";
export function Report({ mint }: { mint: string }) {
  const [open, setOpen] = useState(false); const [sent, setSent] = useState(false); const [reason, setReason] = useState("");
  if (sent) return <p className="text-sm text-haze">Thanks, we'll look at it.</p>;
  return open ? (
    <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); await fetch("/api/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint, reason }) }); setSent(true); }}>
      <input className="field h-10" placeholder="What's wrong? (offensive, stolen clip, scam…)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn btn-ghost">Send</button>
    </form>
  ) : <button onClick={() => setOpen(true)} className="text-sm text-haze underline hover:text-ink">Report this coin</button>;
}
