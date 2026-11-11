"use client";
import { useTown, avatar, first, ago } from "./town";

const VERB = { thought: "thinks", say: "says", move: "", trade: "" } as const;

/** "On the map": what the locals think, say and trade, live. */
export function AgentRail({ onPick, limit = 40 }: { onPick?: (id: string) => void; limit?: number }) {
  const { events, agents } = useTown();
  const name = (id: string | null) => (id ? first(agents.find((a) => a.id === id)?.name ?? id) : "");
  const color = (id: string) => agents.find((a) => a.id === id)?.color ?? "#fff";
  if (!events.length) return <p className="p-2 text-sm text-haze">The town is waking up. First words in a few seconds.</p>;
  return (
    <ul className="h-full space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
      {events.slice(0, limit).map((e) => (
        <li key={e.id} className="feed-in">
          <button type="button" onClick={() => onPick?.(e.agent)} className="flex w-full gap-2.5 rounded-[12px] bg-white/[.04] p-2 text-left transition-colors hover:bg-white/[.09]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar(e.agent)} alt="" className="size-9 flex-none rounded-[10px]" />
            <span className="min-w-0 text-[13px] leading-[1.4]">
              <b style={{ color: color(e.agent) }}>{name(e.agent)}</b>
              <span className="text-haze"> {e.kind === "say" && e.to ? `to ${name(e.to)}` : VERB[e.kind]} · {e.district} · {ago(e.at)}</span>
              <span className={`block ${e.kind === "thought" ? "italic text-haze" : e.kind === "trade" ? "text-sun" : e.kind === "move" ? "text-haze" : "text-ink"}`}>
                {e.kind === "say" ? `“${e.text}”` : e.text}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
