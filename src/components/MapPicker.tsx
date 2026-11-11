"use client";
import { useRef, useState } from "react";
import { districtOf } from "./map/districts";

export type MapPos = { u: number; v: number };

/** Launch step: drop the clip where it happened in Leonida. 2D image of the map, click or drag to place the pin. */
export function MapPicker({ value, onChange, onDone }: { value: MapPos | null; onChange: (p: MapPos) => void; onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const place = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    onChange({ u: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), v: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
  };
  const district = value ? districtOf(value.u, value.v) : null;
  return (
    <div className="space-y-3">
      <p className="text-haze">Where in Leonida does this clip happen? Drop the pin: your coin lives there on the map.</p>
      <div ref={box} onPointerDown={(e) => { setDrag(true); place(e); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => drag && place(e)} onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}
        className="relative mx-auto max-h-[60vh] cursor-crosshair touch-none select-none overflow-hidden rounded-2xl border border-line" style={{ aspectRatio: "6014 / 8192" }}>
        <img src="/map/yanis-4k.jpg" alt="Leonida" draggable={false} className="block h-full w-full object-cover" />
        {value && (
          <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full" style={{ left: `${value.u * 100}%`, top: `${value.v * 100}%` }}>
            <div className="rounded-full bg-[#ffe17a] px-2 py-0.5 text-[11px] font-extrabold text-[#1a0b26] shadow-lg">{district}</div>
            <div className="mx-auto h-5 w-0.5 bg-[#ffe17a]" /><div className="mx-auto -mt-1 size-3 rounded-full border-2 border-[#1a0b26] bg-[#ffe17a]" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onDone} disabled={!value} className="btn btn-hot h-11">{value ? `Drop it in ${district}` : "Click the map to place your clip"}</button>
        <button type="button" onClick={onDone} className="text-sm text-haze underline">Skip, pick a plot for me</button>
      </div>
    </div>
  );
}
