"use client";
import { useEffect, useRef, useState } from "react";

/** Text that flashes green/pink when its numeric value changes. */
export function Num({ value, text, className = "" }: { value: number; text: string; className?: string }) {
  const prev = useRef(value); const [dir, setDir] = useState<"" | "up" | "down">(""); const [k, setK] = useState(0);
  useEffect(() => { if (value !== prev.current) { setDir(value > prev.current ? "up" : "down"); setK((n) => n + 1); prev.current = value; } }, [value]);
  return <span key={k} className={`${className} ${dir ? `tick-${dir}` : ""}`}>{text}</span>;
}
