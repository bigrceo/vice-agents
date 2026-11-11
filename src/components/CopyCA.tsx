"use client";
import { useState } from "react";
import { short } from "@/lib/format";

export function CopyCA({ mint }: { mint: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(mint).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); })}
      className="flex w-full max-w-[520px] items-center gap-2.5 rounded-xl border border-dashed border-sun/50 bg-black/30 px-3 py-2.5 text-left text-[13px]">
      <span className="font-extrabold">CA</span><code className="flex-1 font-sans">{short(mint, 6)}</code><em className="not-italic text-sun">{ok ? "copied" : "copy"}</em>
    </button>
  );
}
