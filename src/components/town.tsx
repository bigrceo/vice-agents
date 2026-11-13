"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { AgentView, Town, TownEvent } from "@/lib/agents/data";
import type { Coin } from "@/lib/types";

const Ctx = createContext<Town | null>(null);
/** One poll for the whole page: agents, feed, trades, prices. */
export function TownProvider({ initial, children }: { initial: Town; children: React.ReactNode }) {
  const [town, setTown] = useState(initial);
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await fetch("/api/town", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (r?.agents && !r.empty) setTown(r);
    }, 4000);
    return () => clearInterval(t);
  }, []);
  return <Ctx.Provider value={town}>{children}</Ctx.Provider>;
}
export const useTown = () => useContext(Ctx)!;
/** Every agent has an original portrait: a face crop for pins and rows, the full 3:4 shot for cards. */
export const avatar = (id: string) => `/agents/${id}.jpg`;
export const portrait = (id: string) => `/agents/${id}-full.jpg`;
export const first = (n: string) => n.replace(/^(Officer|Doc|Big) /, "").split(" ")[0];

/** The map draws "coins": each agent is one, standing where it walks. */
export function agentAsCoin(a: AgentView, events: TownEvent[] = []): Coin {
  const e = events.find((x) => x.agent === a.id && x.kind !== "move" && Date.now() - +new Date(x.at) < 45_000);
  const cut = (t: string) => (t.length > 120 ? t.slice(0, 117).replace(/\s+\S*$/, "") + "…" : t);
  const bubble = e ? { id: e.id, kind: e.kind, text: e.kind === "say" ? `“${cut(e.text)}”` : cut(e.text) } : null;
  return { mint: a.id, curve: "agent", name: a.name, ticker: first(a.name), still: avatar(a.id), creator: a.address,
    mcapUsd: a.equity * 1e6, change24h: Math.round(a.pnlPct * 10) / 10, volumeEth: 0, holders: 0, bondingPct: 0, migrated: false,
    createdAt: new Date().toISOString(), mapU: a.u, mapV: a.v, description: a.thought, ring: a.color, bubble };
}
export const eth = (n: number) => `${n >= 0.1 ? n.toFixed(3) : n.toFixed(4)} SOL`;
export const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%`;
export function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`;
}
