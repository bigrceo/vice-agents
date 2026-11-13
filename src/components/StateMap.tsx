"use client";
/**
 * Port of the stateofleonida.xyz map (React Three Fiber): the extended map on a tilted plane in a teal ocean,
 * the 4K core blended on top with its mask, one beacon (halo, pulsing ring, beam, sphere) per coin, HTML pins
 * projected from the scene that dodge the hero card and the rail, OrbitControls kept inside the island.
 */
import { MapPoster } from "./MapPoster";
import { PLOTS, plotFor, type Plot } from "./plots";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Coin } from "@/lib/types";
import { pct } from "@/lib/format";
import { CAST } from "@/lib/agents/cast";
import { CityNeon, Clouds, DistrictLabels, MODES, Ocean, Sky, Sun, type Mode } from "./map/Atmosphere";
import { CityLight } from "./map/Buildings";
import { TileLayer } from "./map/TileLayer";
import { Island, LAND_Y } from "./map/Island";
import { ClipBoard } from "./map/ClipBoards";
import { RealCity } from "./map/RealCity";
void RealCity;
import { districtOf, DISTRICTS } from "./map/districts";

// ---- Yanis V16 GTA VI community map (gtadb.org, CC BY 4.0), island crop stitched from the z5 tiles: 6118×8192 ----
const IMG_W = 14848, IMG_H = 20224; // Yanis V17 island crop: tiles x 21..78, y 21..99 (ground textures keep this aspect)
const PLANE_W = 16, PLANE_H = PLANE_W * IMG_H / IMG_W;
import { uvToWorldMiami } from "./map/georef";
import { GOOGLE_KEY, MiamiTiles, MiamiCredits } from "./map/MiamiTiles";
/** Two worlds sharing the same u/v: the Leonida fan map (default, the shape people know) and photoreal Miami (Google 3D
 * Tiles) that the camera dives into when it gets close to a district, or on the "Real" toggle. MIAMI is flipped right before
 * the Canvas remounts (key), so every helper below reads the current world. */
let MIAMI = false;
const CAN_REAL = false; // photoreal Miami kept in code, off in the UI
void GOOGLE_KEY;
/** Where to land when switching worlds (set by the dive logic). */
export const PLACES: Record<string, { u: number; v: number; h: number }> = {
  "ocean-drive": { u: 0.845, v: 0.485, h: 2.6 },
  "the-keys": { u: 0.56, v: 0.836, h: 3.2 },
  "grassrivers": { u: 0.483, v: 0.75, h: 3.4 },
};
const pendingFocus: { world: [number, number, number] | null; dist: number } = { world: null, dist: 2.5 };
const toWorld = (u: number, v: number): [number, number, number] => MIAMI ? uvToWorldMiami(u, v) : [(u - 0.5) * PLANE_W, LAND_Y, (v - 0.5) * PLANE_H];
const DISTRICT_COLOR: Record<string, string> = { "Vice City": "#ff5fa8", "Vice Beach": "#ffc38a", "Port Gellhorn": "#48d6ff", "Key Lento": "#2affc6", Ambrosia: "#ffe17a", "Lummox County": "#d9b8ff" };

/** Stable plot per coin: the official coin owns HQ, the rest hash their mint onto the other plots. */

type Entity = { coin: Coin; plot: Plot; main: boolean };
const beamHeight = (e: Entity) => e.coin.ring ? 0.12 : e.main ? 1.7 : Math.min(2.2, 0.35 + Math.log10(Math.max(e.coin.mcapUsd, 5000) / 5000) * 0.55);
const beamColor = (e: Entity) => e.main ? "#ff5fa8" : e.coin.change24h >= 0 ? "#2affc6" : "#ff4d6d";

// ---- scene ----
function Ground({ onReady, mode }: { onReady: () => void; mode: Mode }) {
  return (
    <group>
      <Ocean mode={mode} half={[PLANE_W / 2, PLANE_H / 2]} />
      <Island mode={mode} planeW={PLANE_W} planeH={PLANE_H} onReady={onReady} />
    </group>
  );
}

/** Where each beacon stands right now: agents glide toward their new spot instead of jumping on every poll. Pins read it too. */
const walk = new Map<string, THREE.Vector3>(), speed = new Map<string, number>();
function walkTo(e: Entity, dt: number) {
  const [bx, , bz] = toWorld(e.plot.u, e.plot.v);
  const k0 = e.coin.ring ? Math.max(0, CAST.findIndex((c) => c.id === e.coin.mint)) * 0.628 : 0, x = bx + (e.coin.ring ? Math.cos(k0) * 0.32 : 0), z = bz + (e.coin.ring ? Math.sin(k0) * 0.22 : 0);   // each local keeps its own spot around a district
  let p = walk.get(e.coin.mint); if (!p) { p = new THREE.Vector3(x, 0, z); walk.set(e.coin.mint, p); }
  // A walk, not a lurch: ease in up to a steady pace, then slow down on arrival (~1 map unit per second at full pace).
  const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), s = Math.min(dt, 0.1);
  if (d < 0.002) { speed.set(e.coin.mint, 0); return p; }
  const v = (speed.get(e.coin.mint) ?? 0) + (Math.min(1, d * 1.2) - (speed.get(e.coin.mint) ?? 0)) * (1 - Math.exp(-s * 2.5));
  speed.set(e.coin.mint, v); const step = Math.min(d, v * s); p.x += dx / d * step; p.z += dz / d * step; return p;
}

function Beacon({ e, active, onHover, onSelect }: { e: Entity; active: boolean; onHover: (m: string | null) => void; onSelect: () => void }) {
  const beam = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const g = useRef<THREE.Group>(null);
  const [x, , z] = toWorld(e.plot.u, e.plot.v);
  const h = beamHeight(e), col = e.coin.ring ?? beamColor(e), dist = DISTRICT_COLOR[e.plot.district] ?? "#fff";
  const speed = 1 + Math.min(1, (e.coin.volumeEth ?? 0) / Math.max(e.coin.mcapUsd, 1) / 0.02);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (g.current) { const p = walkTo(e, dt); g.current.position.x = p.x; g.current.position.z = p.z; }
    if (ring.current) { const s = 1 + ((t * 0.6 * speed + (x + z)) % 1) * 1.6; ring.current.scale.set(s, s, s); (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - (s - 1) / 1.6); }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = (active ? 0.9 : 0.55) + Math.sin(t * 3 + x) * 0.08;
  });
  const r = e.main ? 0.07 : 0.035;
  const ev = {
    onPointerOver: (ev: { stopPropagation: () => void }) => { ev.stopPropagation(); onHover(e.coin.mint); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { onHover(null); document.body.style.cursor = ""; },
    onClick: (ev: { stopPropagation: () => void }) => { ev.stopPropagation(); onSelect(); },
  };
  return (
    <group ref={g} position={[x, LAND_Y, z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}><circleGeometry args={[e.main ? 0.32 : 0.2, 40]} /><meshBasicMaterial color={dist} transparent opacity={active ? 0.55 : 0.32} depthWrite={false} /></mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.015}><ringGeometry args={[e.main ? 0.3 : 0.18, e.main ? 0.34 : 0.21, 48]} /><meshBasicMaterial color={col} transparent depthWrite={false} /></mesh>
      {!e.coin.ring && <><mesh ref={beam} position-y={h / 2} {...ev}><cylinderGeometry args={[r * 0.6, r, h, 20, 1, true]} /><meshBasicMaterial color={col} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} /></mesh>
      <mesh position-y={h} {...ev}><sphereGeometry args={[r * 1.5, 20, 20]} /><meshBasicMaterial color={col} toneMapped={false} /></mesh></>}
    </group>
  );
}

/** Open plot: a small gold dot on the ground, click → launch. */
function Lot({ p, onSelect, onHover }: { p: Plot; onSelect: () => void; onHover: (x: number | null, y?: number) => void }) {
  const [x, , z] = toWorld(p.u, p.v);
  const g = useRef<THREE.Group>(null); const ring = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);
  // Open plots are quiet: a small pink marker that only shows once the camera is close, breathing slowly.
  useFrame(({ clock }) => {
    const vis = THREE.MathUtils.smoothstep(7.5 - camera.position.y, 0, 2.5);
    const t = clock.elapsedTime;
    if (g.current) { g.current.visible = vis > 0.01; const sc = 1 + Math.sin(t * 2 + x * 3) * 0.06; g.current.scale.set(sc, 1, sc); }
    if (ring.current) (ring.current.material as THREE.MeshBasicMaterial).opacity = vis * (0.55 + Math.sin(t * 2 + x * 3) * 0.2);
    g.current?.children.forEach((c, i) => { if (i === 0) ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = vis * 0.95; });
  });
  return (
    <group ref={g} position={[x, LAND_Y, z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; const r = (e.nativeEvent.target as HTMLElement).getBoundingClientRect(); onHover(e.nativeEvent.clientX - r.left, e.nativeEvent.clientY - r.top); }}
        onPointerMove={(e) => { const r = (e.nativeEvent.target as HTMLElement).getBoundingClientRect(); onHover(e.nativeEvent.clientX - r.left, e.nativeEvent.clientY - r.top); }}
        onPointerOut={() => { document.body.style.cursor = ""; onHover(null); }}>
        <circleGeometry args={[0.035, 24]} /><meshBasicMaterial color="#ff5fa8" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.011}><ringGeometry args={[0.065, 0.075, 40]} /><meshBasicMaterial color="#ff5fa8" transparent opacity={0} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  );
}

type Api = { zoom: (k: number) => void; target: THREE.Vector3 };
function FogCtl({ mode }: { mode: Mode }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => { (window as unknown as { __scene?: THREE.Scene }).__scene = scene; }, [scene]);
  useFrame(() => { const f = scene.fog as THREE.Fog | null; if (f) f.color.lerp(new THREE.Color(MODES[mode].fog), 0.05); });
  return null;
}
function Controls({ entities, selected, api, onWorld }: { entities: Entity[]; selected: string | null; api: React.MutableRefObject<Api | null>; onWorld: (real: boolean) => void }) {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const controls = useMemo(() => {
    const c = new OrbitControls(camera, dom);
    c.enableDamping = true; c.dampingFactor = 0.08; c.screenSpacePanning = false;
    c.enableZoom = false; // the wheel scrolls the page; zoom = ctrl/cmd + wheel, pinch, or the buttons
    // Leonida-style: left drag pans the map, right drag tilts; one finger pans, two fingers pinch/tilt.
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.panSpeed = 1.2; c.enableZoom = true; c.zoomToCursor = false;
    c.minDistance = MIAMI ? 0.2 : 0.9; c.maxDistance = MIAMI ? 320 : (window.innerWidth < 700 ? 11 : 13); c.minPolarAngle = 0.15; c.maxPolarAngle = 1.05; c.minAzimuthAngle = -0.6; c.maxAzimuthAngle = 0.6; c.zoomSpeed = 0.8;
    // ?at=<place> (menu cards): open already zoomed on that district
    const at = PLACES[new URLSearchParams(location.search).get("at") ?? ""];
    if (at && !MIAMI) {
      const [ax, , az] = toWorld(at.u, at.v);
      c.target.set(ax, LAND_Y, az); camera.position.set(ax, LAND_Y + at.h, az + at.h * 0.62);
      return c;
    }
    const [hx, , hz] = MIAMI ? (pendingFocus.world ?? [0, 0, 0]) : (pendingFocus.world ?? toWorld(0.7, 0.53));
    const off = new THREE.Vector3(hx + (window.innerWidth < 700 ? 0.8 : 1.2), MIAMI ? 0 : LAND_Y, hz + 0.6);
    c.target.copy(off); camera.position.add(off);
    return c;
  }, [camera, dom]);
  // menu cards on a page that already shows the map: fly there instead of reloading
  useEffect(() => {
    const fly = (e: Event) => {
      const k = (e as CustomEvent<string>).detail, dd = DISTRICTS.find((x) => x.name === k);
      const at = PLACES[k] ?? (dd ? { u: dd.u, v: dd.v, h: 3.2 } : undefined); if (!at || MIAMI) return;
      const [ax, , az] = toWorld(at.u, at.v);
      const t0 = controls.target.clone(), p0 = camera.position.clone();
      const t1 = new THREE.Vector3(ax, LAND_Y, az), p1 = new THREE.Vector3(ax, LAND_Y + at.h, az + at.h * 0.62);
      const start = performance.now(); let raf = 0;
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / 1400), e2 = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        controls.target.lerpVectors(t0, t1, e2); camera.position.lerpVectors(p0, p1, e2); controls.update();
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    };
    addEventListener("clip:fly", fly);
    return () => removeEventListener("clip:fly", fly);
  }, [controls, camera]);
  const goal = useRef<THREE.Vector3 | null>(null);
  // Intro flyover: start high and far, ease into the default framing.
  const intro = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);
  useEffect(() => {
    // no opening flyover: the map appears already framed
    intro.current = null; controls.enabled = true;
  }, [camera, controls]);
  useEffect(() => () => controls.dispose(), [controls]);
  useEffect(() => {
    const zoom = (k: number) => {
      const dir = camera.position.clone().sub(controls.target);
      const d = THREE.MathUtils.clamp(dir.length() * k, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(dir.setLength(d));
    };
    api.current = { zoom, target: controls.target };
    const onWheel = (e: WheelEvent) => {
      // Wheel up zooms in. Wheel down zooms out until the camera is fully out, then the page scrolls.
      const dist = camera.position.distanceTo(controls.target);
      if (e.deltaY < 0) {
        if (window.scrollY > 4) return; // coming back up the page: keep scrolling
        e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0045));
      } else if (dist < controls.maxDistance - 0.01) {
        e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0045));
      }
    };
    // Capture phase so OrbitControls' own wheel zoom never runs: the wheel is ours (zoom in / zoom out then scroll the page).
    const guard = (e: WheelEvent) => { e.stopImmediatePropagation(); onWheel(e); };
    dom.addEventListener("wheel", guard, { passive: false, capture: true });
    return () => { dom.removeEventListener("wheel", guard, { capture: true } as EventListenerOptions); api.current = null; };
  }, [camera, controls, dom, api]);
  useEffect(() => {
    const e = entities.find((e) => e.coin.mint === selected); if (!e) return;
    const [x, , z] = toWorld(e.plot.u, e.plot.v); goal.current = new THREE.Vector3(x, MIAMI ? 0 : LAND_Y, z);
  }, [selected, entities]);
  useFrame((_, dt) => {
    if (intro.current) {
      const i = intro.current; i.t = Math.min(1, i.t + dt / (window.innerWidth < 700 ? 1.2 : 2.2));
      const e = 1 - Math.pow(1 - i.t, 3);
      camera.position.lerpVectors(i.from, i.to, e);
      if (i.t >= 1) { intro.current = null; controls.enabled = true; }
      camera.lookAt(controls.target); return;
    }
    if (goal.current) {
      const d = goal.current.clone().sub(controls.target).multiplyScalar(0.08);
      controls.target.add(d); camera.position.add(d);
      if (d.lengthSq() < 1e-6) goal.current = null;
    }
    const t = controls.target;
    // Dive: close to the ground on Leonida → the same spot in real Miami; far above Miami → back to Leonida.
    const dist = camera.position.distanceTo(t);
    if (CAN_REAL && !intro.current) {
      void dist; void onWorld; // worlds switch only from the toggle
    }
    // Keep the whole view on the map: the farther the camera, the smaller the area the target may roam.
    const vis = MIAMI ? 0 : dist * 0.26; // loose enough to reach the Keys and the north shore
    const LX = MIAMI ? 220 : Math.max(0.2, PLANE_W / 2 - vis), LZ = MIAMI ? 220 : Math.max(0.2, PLANE_H / 2 - vis * 0.9);
    const dx = THREE.MathUtils.clamp(t.x, -LX, LX) - t.x, dz = THREE.MathUtils.clamp(t.z, -LZ, LZ) - t.z;
    if (dx || dz) { t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz; }
    controls.update();
  });
  return null;
}

// ---- HTML pins projected from the scene, dodging [data-pin-obstacle] boxes ----
type Slot = { el: HTMLButtonElement | null; line: SVGLineElement | null; fullW: number; fullH: number; measuredAt: number; last?: string; dx?: number; dy?: number };
type Rect = { x: number; y: number; w: number; h: number };
const GAP = 6, MINI = 34;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x && a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y;
const priority = (e: Entity, hot: boolean) => (hot ? 1e15 : 0) + (e.main ? 1e13 : 0) + (e.coin.ring ? -entityRank(e) : e.coin.mcapUsd);   // fixed order: live P&L must not reshuffle the pins
const entityRank = (e: Entity) => Math.abs([...e.coin.mint].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1000;

function PinLayout({ entities, slots, hovered, selected }: { entities: Entity[]; slots: Map<string, Slot>; hovered: string | null; selected: string | null }) {
  const camera = useThree((s) => s.camera), size = useThree((s) => s.size), dom = useThree((s) => s.gl.domElement);
  const v = useMemo(() => new THREE.Vector3(), []);
  const obstacles = useRef<{ at: number; rects: Rect[] }>({ at: -1, rects: [] });
  const frame = useRef(0);
  useFrame((_, dt) => {
    frame.current++;
    const glide = 1 - Math.exp(-Math.min(dt, 0.1) * 9);   // labels slide to a new spot instead of snapping there
    const base = dom.getBoundingClientRect();
    if (frame.current - obstacles.current.at > 15) obstacles.current = { at: frame.current, rects: [...document.querySelectorAll("[data-pin-obstacle]")].map((el) => { const r = el.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }; }) };
    const taken = [...obstacles.current.rects];
    const order = [...entities].sort((a, b) => Number(!!b.coin.bubble) - Number(!!a.coin.bubble) || priority(b, b.coin.mint === selected) - priority(a, a.coin.mint === selected));   // talkers first: their bubble claims its space before anyone else   // hover never reshuffles the layout
    const pinRects: Rect[] = [];
    (window as unknown as { __pinRects?: Rect[] }).__pinRects = pinRects;   // the region titles fade out under pins instead of pushing them away
    for (const e of order) {
      const s = slots.get(e.coin.mint); if (!s?.el) continue;
      const w = walk.get(e.coin.mint), [x, , z] = w ? [w.x, 0, w.z] : toWorld(e.plot.u, e.plot.v);
      v.set(x, (MIAMI ? 0 : LAND_Y) + beamHeight(e), z).project(camera);
      const sx = (v.x + 1) / 2 * size.width, sy = (1 - v.y) / 2 * size.height;
      const onScreen = v.z < 1 && sx > -40 && sx < size.width + 40 && sy > -40 && sy < size.height + 40;
      if (s.measuredAt < 0 || frame.current - s.measuredAt > 120) {
        if (s.el.dataset.mode === "full") { s.fullW = s.el.offsetWidth; s.fullH = s.el.offsetHeight; s.measuredAt = frame.current; }
        else if (s.measuredAt < 0) { s.fullW = 120; s.fullH = 40; }
      }
      let mode = "hidden"; let box: Rect | null = null;
      if (onScreen) {
        const w = s.fullW, h = s.fullH;
        const full: [number, number][] = [[-w / 2, -10 - h], [-w / 2, -10 - h * 2 - 8], [16, -h / 2], [-w - 16, -h / 2], [-w / 2, 14], [16, -h - 20], [-w - 16, -h - 20]];
        const mini: [number, number][] = [[-17, -44], [10, -17], [-44, -17]];
        const fits = (r: Rect) => r.x >= 4 && r.y >= 8 && r.x + r.w <= size.width - 4 && r.y + r.h <= size.height - 4;
        // try the spot this pin used last frame first, so pins only move when that spot is really blocked
        const sticky = (cands: [number, number][], tag: string) => { const i = s.last?.startsWith(tag) ? +s.last.slice(1) : -1; return i >= 0 && i < cands.length ? [cands[i], ...cands.filter((_, j) => j !== i)] : cands; };
        const bubEl = s.el.querySelector<HTMLElement>(".pin-bubble"), bw = bubEl?.offsetWidth || 250, bh = bubEl?.offsetHeight || 70;
        const bubbleOf = (r: Rect): Rect => ({ x: r.x + r.w / 2 - bw / 2, y: r.y < 190 ? r.y + r.h + 12 : r.y - 12 - bh, w: bw, h: bh });
        const place = (cands: [number, number][], w: number, h: number, withBubble = false) => { for (const [dx, dy] of cands) { const r = { x: sx + dx, y: sy + dy, w, h }; if (fits(r) && !taken.some((t) => overlaps(r, t)) && (!withBubble || !taken.some((t) => overlaps(bubbleOf(r), t)))) return r; } return null; };
        const fs = sticky(full, "f"), ms = sticky(mini, "m");
        box = place(fs, w, h, !!bubEl) ?? (bubEl ? place(fs, w, h) : null); if (box) { mode = "full"; s.last = "f" + full.indexOf(fs.find(([dx, dy]) => box!.x === sx + dx && box!.y === sy + dy)!); }
        else { box = place(ms, MINI, MINI); if (box) { mode = "mini"; s.last = "m" + mini.indexOf(ms.find(([dx, dy]) => box!.x === sx + dx && box!.y === sy + dy)!); } }
        // nowhere free: still show the face right on its spot (only the panels may hide it), never let an agent vanish
        if (!box) { const r = { x: sx - MINI / 2, y: sy - MINI / 2, w: MINI, h: MINI }; if (fits(r) && !obstacles.current.rects.some((t) => overlaps(r, t))) { box = r; mode = "mini"; } }
      }
      if (box) taken.push(box);
      // a speech bubble floats above its pin: reserve its box too so no other pin lands under it
      const bub = mode === "full" ? s.el.querySelector<HTMLElement>(".pin-bubble") : null;
      if (bub && box) { const bw = bub.offsetWidth || 250, bh = bub.offsetHeight || 70; taken.push({ x: box.x + box.w / 2 - bw / 2, y: box.y < 190 ? box.y + box.h + 12 : box.y - 12 - bh, w: bw, h: bh }); }
      if (s.el.dataset.mode !== mode) s.el.dataset.mode = mode;
      if (!box || s.el.dataset.mode === "hidden") { s.dx = undefined; s.dy = undefined; }
      if (box) {
        if (s.dx === undefined || s.dy === undefined || Math.hypot(box.x - s.dx, box.y - s.dy) > 400) { s.dx = box.x; s.dy = box.y; }
        else { s.dx += (box.x - s.dx) * glide; s.dy += (box.y - s.dy) * glide; }
        s.el.style.transform = `translate3d(${s.dx.toFixed(1)}px, ${s.dy.toFixed(1)}px, 0)`; const flip = box.y < 190 ? "1" : ""; if ((s.el.dataset.flip ?? "") !== flip) s.el.dataset.flip = flip; }
      if (box) pinRects.push(box);
      if (s.line) {
        const ex = box ? box.x + box.w / 2 : sx;
        const ey = box ? (box.y + box.h < sy ? box.y + box.h : box.y > sy ? box.y : box.y + box.h / 2) : sy;
        const show = box && Math.hypot(ex - sx, ey - sy) > 18;
        s.line.style.opacity = "0"; void show;   // no leader lines: the beacon on the ground already marks the spot
        s.line.setAttribute("x1", sx.toFixed(1)); s.line.setAttribute("y1", sy.toFixed(1)); s.line.setAttribute("x2", ex.toFixed(1)); s.line.setAttribute("y2", ey.toFixed(1));
      }
    }
  });
  return null;
}

function Pins({ entities, slots, hovered, selected, onHover, onSelect }: { entities: Entity[]; slots: Map<string, Slot>; hovered: string | null; selected: string | null; onHover: (m: string | null) => void; onSelect: (m: string) => void }) {
  const slot = (m: string) => { let s = slots.get(m); if (!s) { s = { el: null, line: null, fullW: 120, fullH: 40, measuredAt: -1 }; slots.set(m, s); } return s; };
  return (
    <div className="pins" aria-label="Map labels">
      <svg className="pin-lines" aria-hidden="true">{entities.map((e) => <line key={e.coin.mint} ref={(el) => { slot(e.coin.mint).line = el; }} />)}</svg>
      {entities.map((e) => {
        const hot = hovered === e.coin.mint || selected === e.coin.mint;
        return (
          <button key={e.coin.mint} type="button" data-mode="hidden" ref={(el) => { slot(e.coin.mint).el = el; }}
            className={`pin ${e.main ? "pin-main" : ""} ${e.coin.ring ? "pin-agent" : ""} ${hot ? "is-active" : ""}`} onClick={() => onSelect(e.coin.mint)}
            style={e.coin.ring ? ({ "--ring": e.coin.ring } as React.CSSProperties) : undefined}
            onMouseEnter={() => onHover(e.coin.mint)} onMouseLeave={() => onHover(null)} aria-label={e.coin.ring ? e.coin.name : `$${e.coin.ticker}`}>
            {e.coin.bubble && <span key={e.coin.bubble.id} className={`pin-bubble is-${e.coin.bubble.kind}`}>{e.coin.bubble.text}</span>}
            <img src={e.coin.still} alt="" loading="lazy" />
            <span className="pin-text"><b>{e.coin.curve === "agent" ? e.coin.ticker : `$${e.coin.ticker}`}</b><i className={e.coin.change24h >= 0 ? "text-up" : "text-down"}>{pct(e.coin.change24h)}</i></span>
          </button>
        );
      })}
    </div>
  );
}

export function StateMap({ coins, active, onActive, children }: { coins: Coin[]; active: string | null; onActive: (m: string | null) => void; children?: React.ReactNode }) {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const slots = useMemo(() => new Map<string, Slot>(), []);
  const entities = useMemo<Entity[]>(() => coins.map((c, i) => ({ coin: c, plot: plotFor(c, i), main: !!c.official })), [coins]);
  const takenPlots = useMemo(() => new Set(entities.map((e) => e.plot.id)), [entities]);
  const small = typeof window !== "undefined" && window.innerWidth < 700;
  const api = useRef<Api | null>(null);
  const [ready, setReady] = useState(false);
  const [credits, setCredits] = useState("");
  const [real, setRealState] = useState(false);
  const setReal = (v: boolean) => { if (v === real) return; setReady(false); setRealState(v); };
  MIAMI = real && CAN_REAL;
  const [mode, setMode] = useState<Mode>("day");
  const [lotTip, setLotTip] = useState<{ plot: Plot; x: number; y: number } | null>(null);
  const onReady = useMemo(() => () => { setReady(true); (window as unknown as { __mapReady?: boolean }).__mapReady = true; requestAnimationFrame(() => requestAnimationFrame(() => dispatchEvent(new Event("clip:map-ready")))); }, []);
  const select = (m: string) => onActive(m);
  return (
    <div className="map-canvas absolute inset-0">
      <Canvas key={real ? "real" : "leonida"} dpr={[1, 1.5]} camera={{ position: MIAMI ? (small ? [0, 3.2, 1.6] : [0, 2.4, 2.2]) : small ? [0, 9.5, 4.5] : [0, 9.5, 7], fov: 42, near: MIAMI ? 0.01 : 0.1, far: MIAMI ? 2000 : 260 }} gl={{ antialias: true }} shadows onPointerMissed={() => onActive(null)}>
        <fog attach="fog" args={[MODES.dusk.fog, MIAMI ? 150 : 18, MIAMI ? 1200 : 60]} />
        <FogCtl mode={mode} />
        <Sky mode={mode} />
        <Sun mode={mode} />
        {MIAMI ? <><MiamiTiles onReady={onReady} onCredits={setCredits} /><Clouds mode={mode} count={5} /></>
          : <><Suspense fallback={null}><Ground onReady={onReady} mode={mode} /></Suspense>
        {ready && <><DistrictLabels toWorld={toWorld} /><CityLight mode={mode} api={api} />{!small && <TileLayer mode={mode} planeW={PLANE_W} planeH={PLANE_H} api={api} />}</>}</>}
        {ready && entities.map((e) => <Beacon key={e.coin.mint} e={e} active={active === e.coin.mint || hovered === e.coin.mint} onHover={setHovered} onSelect={() => select(e.coin.mint)} />)}
        {ready && !MIAMI && entities.filter((e) => !e.coin.ring).map((e) => { const [x, , z] = toWorld(e.plot.u, e.plot.v); return <group key={`b${e.coin.mint}`} position-y={LAND_Y}><ClipBoard coin={e.coin} x={x} z={z} main={e.main} active={active === e.coin.mint || hovered === e.coin.mint} onHover={setHovered} onSelect={() => select(e.coin.mint)} /></group>; })}
        {/* agents walk the map: no open lots */}
        <Controls entities={entities} selected={active} api={api} onWorld={setReal} />
        <PinLayout entities={entities} slots={slots} hovered={hovered} selected={active} />
      </Canvas>
      <MapPoster hidden={ready} />
      <Pins entities={entities} slots={slots} hovered={hovered} selected={active} onHover={setHovered} onSelect={select} />
      <div className="map-vignette" aria-hidden="true" />
      {MIAMI && <MiamiCredits credits={credits} />}
      {lotTip && <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-[10px] bg-white px-2.5 py-1.5 text-center text-[12px] font-bold text-[#1a0b26] shadow-lg" style={{ left: lotTip.x, top: lotTip.y }}>Open plot · {lotTip.plot.district}<br /><span className="font-semibold opacity-80">Launch a clip to claim it</span></div>}
      <div className="absolute bottom-[18px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 max-md:bottom-3 max-md:left-auto max-md:right-3 max-md:translate-x-0">
        <button type="button" onClick={() => api.current?.zoom(1.35)} className="grid size-9 place-items-center rounded-full border border-line bg-night/70 text-lg font-bold text-ink hover:bg-night/90" aria-label="Zoom out">−</button>
        <span className="whitespace-nowrap rounded-full border border-line bg-night/70 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-haze max-xl:hidden">Drag to pan · scroll to zoom · click a beacon</span>
        <button type="button" onClick={() => api.current?.zoom(0.74)} className="grid size-9 place-items-center rounded-full border border-line bg-night/70 text-lg font-bold text-ink hover:bg-night/90" aria-label="Zoom in">+</button>
      </div>
      {children}
    </div>
  );
}
