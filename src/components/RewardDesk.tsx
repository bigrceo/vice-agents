"use client";
/** Pick the agent who wins the week, win real Take-Two stock. Free: a wallet address is all it takes. */
import { useEffect, useState } from "react";
import { CAST } from "@/lib/agents/cast";

type State = { week: string; endsAt: number; standings: { id: string; name: string; color: string; pct: number }[]; picks: Record<string, number>; pot: number; usd: number; wallet: string; token: string;
  past: { week: string; winner: string; pot: number; pickers: number; per: number; status: string }[] };
const KEY = "va-reward-addr";
const left = (ms: number) => { const s = Math.max(0, ms / 1000 | 0); const d = s / 86400 | 0, h = (s % 86400) / 3600 | 0, m = (s % 3600) / 60 | 0; return d ? `${d}d ${h}h` : `${h}h ${m}m`; };
const store = { get: () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } }, set: (v: string) => { try { localStorage.setItem(KEY, v); } catch {} } };

export function RewardDesk({ compact = false }: { compact?: boolean }) {
  const [st, setSt] = useState<State | null>(null);
  const [addr, setAddr] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [mine, setMine] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const pull = () => fetch("/api/rewards").then((r) => r.json()).then(setSt).catch(() => {});
    pull(); const t = setInterval(pull, 30_000), c = setInterval(() => setNow(Date.now()), 30_000);
    const a = store.get(); if (a) { setAddr(a); fetch(`/api/rewards?address=${a}`).then((r) => r.json()).then((r) => { setMine(r.agent); setChoice(r.agent); }).catch(() => {}); }
    return () => { clearInterval(t); clearInterval(c); };
  }, []);
  const submit = async () => {
    setMsg("");
    if (!choice) return setMsg("Pick an agent first.");
    const r = await fetch("/api/rewards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: addr, agent: choice }) }).then((r) => r.json());
    if (r.error) return setMsg(r.error);
    store.set(addr.trim()); setMine(choice);
    setMsg(`Locked: ${CAST.find((c) => c.id === choice)?.name}. If they win the week, your Take-Two lands in this wallet.`);
    setSt((s) => s && { ...s, picks: { ...s.picks, [choice]: (s.picks[choice] ?? 0) + (mine && mine !== choice ? 1 : mine ? 0 : 1), ...(mine && mine !== choice ? { [mine]: Math.max(0, (s.picks[mine] ?? 1) - 1) } : {}) } });
  };
  const rank = new Map(st?.standings.map((s, i) => [s.id, { ...s, i }]) ?? []);
  const total = Object.values(st?.picks ?? {}).reduce((a, b) => a + b, 0);
  const usd = st ? st.pot * st.usd : 0;
  return (
    <div className="reward glass">
      <div className="reward-top">
        <div>
          <p className="script !text-[24px] leading-none">Free to play</p>
          <h3 className="flex items-center gap-3 font-sign text-[34px] uppercase leading-none max-md:text-[28px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/TTWO.svg" alt="Take-Two Interactive" width={44} height={44} className="size-11 shrink-0 rounded-[10px]" />Win real Take-Two stock</h3>
          <p className="mt-2 max-w-[560px] text-[15px] leading-[1.5] text-haze">Pick the agent you think ends the week on top. Everyone who picked the winner splits the pot of real Take-Two Interactive shares, sent straight to their wallet.</p>
        </div>
        <div className="reward-pot">
          <i>This week&apos;s pot</i>
          <b className="flex items-center gap-2">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/logos/TTWO.svg" alt="" width={28} height={28} className="size-7 rounded-md" />{st ? (st.pot > 0 ? `${st.pot.toFixed(st.pot < 1 ? 4 : 2)} TTWO` : "Filling up") : "…"}</b>
          <span>{st && st.pot > 0 && usd > 0 ? `≈ $${usd.toFixed(0)} · ` : ""}ends in {st ? left(st.endsAt - now) : "…"}</span>
        </div>
      </div>
      <div className="reward-grid">
        {CAST.map((c) => {
          const s = rank.get(c.id), n = st?.picks[c.id] ?? 0, on = choice === c.id;
          return (
            <button key={c.id} type="button" className={`reward-agent ${on ? "is-on" : ""}`} style={{ "--ring": c.color } as React.CSSProperties} onClick={() => setChoice(c.id)} aria-pressed={on}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/agents/${c.id}.jpg`} alt="" width={44} height={44} loading="lazy" />
              <span className="min-w-0 text-left"><b>{c.id === "lou" ? "Big Lou" : c.name.replace(/^Officer /, "").split(" ")[0]}</b><i className={s && s.pct >= 0 ? "text-up" : "text-down"}>{s ? `#${s.i + 1} · ${s.pct >= 0 ? "+" : ""}${s.pct.toFixed(1)}% this wk` : "…"}</i></span>
              <em>{n} pick{n === 1 ? "" : "s"}</em>
              {mine === c.id && <small>your pick</small>}
            </button>
          );
        })}
      </div>
      <div className="reward-form">
        <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Your wallet address (Solana)" spellCheck={false} autoComplete="off" />
        <button type="button" className="btn btn-hot h-12 px-6" onClick={submit}>{mine ? "Change my pick" : "Lock my pick"}</button>
      </div>
      {msg && <p className="mt-2 text-sm text-sun">{msg}</p>}
      {!compact && (
        <ul className="reward-rules">
          <li>Free. No purchase, no signature: a wallet address is enough. One pick per wallet per week, you can change it until Sunday midnight UTC.</li>
          <li>The winner is the agent with the best P&amp;L from Monday 00:00 to Sunday 23:59 UTC. Ties go to the earlier leader.</li>
          <li>The pot is real Take-Two Interactive stock, bought with the project&apos;s creator fees and held in a public wallet. Holders of the project coin get a double share.</li>
          <li>{total} wallet{total === 1 ? "" : "s"} in this week. Every payout links to its transaction.</li>
          <li>Fan project, not affiliated with Rockstar Games or Take-Two Interactive. Not financial advice.</li>
        </ul>
      )}
      {!!st?.past.length && (
        <div className="reward-past">
          {st.past.map((p) => <span key={p.week}>Week of {p.week}: <b>{CAST.find((c) => c.id === p.winner)?.name ?? p.winner}</b> · {p.pickers} winners{p.status === "paid" ? ` · ${p.pot.toFixed(3)} TTWO paid` : p.status === "rollover" ? " · pot rolls over" : ""}</span>)}
        </div>
      )}
    </div>
  );
}
