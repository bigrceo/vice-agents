"use client";
import { SECTORS, sectorOf } from "@/lib/agents/sectors";
import { useTown } from "./town";

/** Where the money walks: how much of the agents' books sits in each district, live. */
export function MoneyFlow({ onFly }: { onFly?: (district: string) => void }) {
  const { agents } = useTown();
  const by = new Map(SECTORS.map((s) => [s.id, { eth: 0, here: 0 }]));
  for (const a of agents) {
    for (const p of a.positions) by.get(sectorOf(p.symbol, p.kind).id)!.eth += p.value;
    const s = SECTORS.find((x) => x.district === a.district); if (s) by.get(s.id)!.here++;
  }
  const max = Math.max(1e-9, ...[...by.values()].map((v) => v.eth));
  return (
    <div className="mt-3">
      <i className="text-[12px] not-italic uppercase tracking-[1px] text-haze">Where the money walks</i>
      <ul className="mt-1.5 space-y-1.5">
        {SECTORS.map((s) => { const v = by.get(s.id)!; return (
          <li key={s.id}>
            <button type="button" onClick={() => onFly?.(s.district)} className="group grid w-full grid-cols-[92px_1fr_auto] items-center gap-2 text-left text-[12px]">
              <span className="truncate font-semibold" style={{ color: s.color }}>{s.district}</span>
              <span className="relative h-[6px] overflow-hidden rounded-full bg-white/10">
                <span className="flow-bar absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(3, (v.eth / max) * 100)}%`, background: `linear-gradient(90deg, ${s.color}55, ${s.color})` }} />
              </span>
              <span className="text-haze group-hover:text-ink">{s.name} · {v.here} here</span>
            </button>
          </li>
        ); })}
      </ul>
    </div>
  );
}
