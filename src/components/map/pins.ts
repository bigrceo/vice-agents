/**
 * Map pins without three.js: where each agent stands, how its pin is placed on screen, and the default camera.
 * The page uses it from the first paint (over the map poster), then the 3D scene feeds it its real camera,
 * so the pins never move when the 3D map takes over.
 */
import type { Coin } from "@/lib/types";
import type { Plot } from "../plots";
import { CAST } from "@/lib/agents/cast";

const IMG_W = 14848, IMG_H = 20224;
export const PLANE_W = 16, PLANE_H = PLANE_W * IMG_H / IMG_W;
export const LAND_Y = 0;
export const toWorldLeonida = (u: number, v: number): [number, number, number] => [(u - 0.5) * PLANE_W, LAND_Y, (v - 0.5) * PLANE_H];

export type Entity = { coin: Coin; plot: Plot; main: boolean };
export const beamHeight = (e: Entity) => e.coin.ring ? 0.12 : e.main ? 1.7 : Math.min(2.2, 0.35 + Math.log10(Math.max(e.coin.mcapUsd, 5000) / 5000) * 0.55);
export const entityRank = (e: Entity) => Math.abs([...e.coin.mint].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1000;
const priority = (e: Entity, hot: boolean) => (hot ? 1e15 : 0) + (e.main ? 1e13 : 0) + (e.coin.ring ? -entityRank(e) : e.coin.mcapUsd);   // fixed order: live P&L must not reshuffle the pins

/** The spot an agent heads to: its own place around a district (locals on an outer ring). */
export function spotOf(e: Entity, toWorld = toWorldLeonida): [number, number] {
  const [bx, , bz] = toWorld(e.plot.u, e.plot.v);
  if (!e.coin.ring) return [bx, bz];
  const ci = CAST.findIndex((c) => c.id === e.coin.mint), slot = ci >= 0 ? ci : 10 + entityRank(e) % 30, rr = ci >= 0 ? 1 : 1.6;
  const k0 = slot * 0.628 + (ci >= 0 ? 0 : 0.31);
  return [bx + Math.cos(k0) * 0.32 * rr, bz + Math.sin(k0) * 0.22 * rr];
}
/** Where each agent stands right now: they glide toward their spot instead of jumping on every poll. */
export const walk = new Map<string, { x: number; z: number }>(), speed = new Map<string, number>();
export function walkTo(e: Entity, dt: number, toWorld = toWorldLeonida) {
  const [x, z] = spotOf(e, toWorld);
  let p = walk.get(e.coin.mint); if (!p) { p = { x, z }; walk.set(e.coin.mint, p); }
  // A walk, not a lurch: ease in, keep a steady pace, slow down on arrival.
  // Standing still is a slow stroll around the spot, so every local keeps moving a little.
  const seed = [...e.coin.mint].reduce((h, c) => h + c.charCodeAt(0), 0), t = performance.now() / 1000;
  const dx = x + Math.sin(t * 0.07 + seed) * 0.08 - p.x, dz = z + Math.cos(t * 0.05 + seed * 1.7) * 0.06 - p.z, d = Math.hypot(dx, dz), s = Math.min(dt, 0.1);
  if (d < 1e-4) return p;
  // Human pace: a short hop is walked (~0.05 map unit/s), a trip across town is driven (~0.2/s). Nobody crosses the map in a second.
  const pace = d > 1.2 ? 0.2 : 0.05;
  const v = (speed.get(e.coin.mint) ?? 0) + (Math.min(pace, d * 0.5) - (speed.get(e.coin.mint) ?? 0)) * (1 - Math.exp(-s * 1.5));
  speed.set(e.coin.mint, v); const step = Math.min(d, v * s); p.x += dx / d * step; p.z += dz / d * step; return p;
}

/** The camera the 3D map opens with, as plain math: same numbers as the scene, so the first pins land where the 3D ones will. */
export function defaultCamera(small: boolean) {
  const [hx, , hz] = toWorldLeonida(0.7, 0.53);
  const target = [hx + (small ? 0.8 : 1.2), LAND_Y, hz + 0.6];
  return { target, position: [target[0], target[1] + 9.5, target[2] + (small ? 4.5 : 7)], fov: 42 };
}
/** Project a world point with a look-at camera (y up). Returns screen pixels and whether it is in front. */
export function projector(cam: { target: number[]; position: number[]; fov: number }, w: number, h: number) {
  const [cx, cy, cz] = cam.position, f = norm([cam.target[0] - cx, cam.target[1] - cy, cam.target[2] - cz]);
  const r = norm([f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]);   // f × up
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const t = Math.tan((cam.fov * Math.PI) / 360), aspect = w / h;
  return (x: number, y: number, z: number) => {
    const d = [x - cx, y - cy, z - cz], zc = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    const nx = (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / (zc * t * aspect), ny = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (zc * t);
    return { sx: (nx + 1) / 2 * w, sy: (1 - ny) / 2 * h, front: zc > 0 };
  };
}
const norm = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ---- placement: every pin dodges the panels, the other pins and their speech bubbles ----
export type Slot = { el: HTMLButtonElement | null; fullW: number; fullH: number; measuredAt: number; last?: string; bub?: string; bw: number; bh: number; dx?: number; dy?: number };
export type Rect = { x: number; y: number; w: number; h: number };
const GAP = 6, MINI = 34;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x && a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y;
export const newSlot = (): Slot => ({ el: null, fullW: 120, fullH: 40, measuredAt: -1, bw: 250, bh: 70 });

export type LayoutState = { frame: number; obstaclesAt: number; obstacles: Rect[]; t?: number };
/**
 * One layout pass. All DOM reads (sizes) happen first and are cached, then only transforms are written:
 * no forced reflow per pin, so a frame stays cheap even with every agent talking.
 */
export function layoutPins(entities: Entity[], slots: Map<string, Slot>, selected: string | null, root: HTMLElement, size: { width: number; height: number },
  st: LayoutState, project: (x: number, y: number, z: number) => { sx: number; sy: number; front: boolean }) {
  st.frame++;
  const now = performance.now(), glide = 1 - Math.exp(-Math.min((now - (st.t ?? now)) / 1000, 0.1) * 9); st.t = now;   // labels slide to a new spot instead of snapping there
  if (st.frame - st.obstaclesAt > 15) {
    const base = root.getBoundingClientRect();
    st.obstaclesAt = st.frame;
    st.obstacles = [...document.querySelectorAll("[data-pin-obstacle]")].map((el) => { const r = el.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }; });
  }
  // reads: refresh cached sizes (rarely, or when a bubble changes)
  for (const e of entities) {
    const s = slots.get(e.coin.mint); if (!s?.el) continue;
    const bubKey = e.coin.bubble ? String(e.coin.bubble.id) : "";
    if (s.measuredAt < 0 || st.frame - s.measuredAt > 120 || s.bub !== bubKey) {
      if (s.el.dataset.mode === "full") { s.fullW = s.el.offsetWidth; s.fullH = s.el.offsetHeight; s.measuredAt = st.frame; }
      const b = s.el.querySelector<HTMLElement>(".pin-bubble");
      if (b && b.offsetWidth) { s.bw = b.offsetWidth; s.bh = b.offsetHeight; }
      s.bub = bubKey;
    }
  }
  const taken = [...st.obstacles];
  const order = [...entities].sort((a, b) => Number(!!b.coin.bubble) - Number(!!a.coin.bubble) || priority(b, b.coin.mint === selected) - priority(a, a.coin.mint === selected));
  const pinRects: Rect[] = [];
  (window as unknown as { __pinRects?: Rect[] }).__pinRects = pinRects;   // the region titles fade out under pins instead of pushing them away
  const fits = (r: Rect) => r.x >= 4 && r.y >= 8 && r.x + r.w <= size.width - 4 && r.y + r.h <= size.height - 4;
  for (const e of order) {
    const s = slots.get(e.coin.mint); if (!s?.el) continue;
    const w0 = walk.get(e.coin.mint), [x, z] = w0 ? [w0.x, w0.z] : spotOf(e);
    const { sx, sy, front } = project(x, LAND_Y + beamHeight(e), z);
    const onScreen = front && sx > -40 && sx < size.width + 40 && sy > -40 && sy < size.height + 40;
    let mode = "hidden"; let box: Rect | null = null;
    const hasBub = !!e.coin.bubble, bw = s.bw, bh = s.bh;
    if (onScreen) {
      const w = s.fullW, h = s.fullH;
      const full: [number, number][] = [[-w / 2, -10 - h], [-w / 2, -10 - h * 2 - 8], [16, -h / 2], [-w - 16, -h / 2], [-w / 2, 14], [16, -h - 20], [-w - 16, -h - 20]];
      const mini: [number, number][] = [[-17, -44], [10, -17], [-44, -17]];
      // try the spot this pin used last frame first, so pins only move when that spot is really blocked
      const sticky = (cands: [number, number][], tag: string) => { const i = s.last?.startsWith(tag) ? +s.last.slice(1) : -1; return i >= 0 && i < cands.length ? [cands[i], ...cands.filter((_, j) => j !== i)] : cands; };
      const bubbleOf = (r: Rect): Rect => ({ x: r.x + r.w / 2 - bw / 2, y: r.y < 190 ? r.y + r.h + 12 : r.y - 12 - bh, w: bw, h: bh });
      const place = (cands: [number, number][], w: number, h: number, withBubble = false) => { for (const [dx, dy] of cands) { const r = { x: sx + dx, y: sy + dy, w, h }; if (fits(r) && !taken.some((t) => overlaps(r, t)) && (!withBubble || !taken.some((t) => overlaps(bubbleOf(r), t)))) return r; } return null; };
      const fs = sticky(full, "f"), ms = sticky(mini, "m");
      box = place(fs, w, h, hasBub) ?? (hasBub ? place(fs, w, h) : null); if (box) { mode = "full"; s.last = "f" + full.indexOf(fs.find(([dx, dy]) => box!.x === sx + dx && box!.y === sy + dy)!); }
      else { box = place(ms, MINI, MINI); if (box) { mode = "mini"; s.last = "m" + mini.indexOf(ms.find(([dx, dy]) => box!.x === sx + dx && box!.y === sy + dy)!); } }
      // nowhere free: still show the face right on its spot (only the panels may hide it), never let an agent vanish
      if (!box) { const r = { x: sx - MINI / 2, y: sy - MINI / 2, w: MINI, h: MINI }; if (fits(r) && !st.obstacles.some((t) => overlaps(r, t))) { box = r; mode = "mini"; } }
    }
    if (box) { taken.push(box); pinRects.push(box); }
    // a speech bubble floats above its pin: reserve its box too so no other pin lands under it
    if (hasBub && box && mode === "full") taken.push({ x: box.x + box.w / 2 - bw / 2, y: box.y < 190 ? box.y + box.h + 12 : box.y - 12 - bh, w: bw, h: bh });
    if (s.el.dataset.mode !== mode) s.el.dataset.mode = mode;
    if (!box || s.el.dataset.mode === "hidden") { s.dx = undefined; s.dy = undefined; }
    if (box) {
      if (s.dx === undefined || s.dy === undefined || Math.hypot(box.x - s.dx, box.y - s.dy) > 400) { s.dx = box.x; s.dy = box.y; }
      else { s.dx += (box.x - s.dx) * glide; s.dy += (box.y - s.dy) * glide; }
      s.el.style.transform = `translate3d(${s.dx.toFixed(1)}px, ${s.dy.toFixed(1)}px, 0)`; const flip = box.y < 190 ? "1" : ""; if ((s.el.dataset.flip ?? "") !== flip) s.el.dataset.flip = flip; }
  }
}
