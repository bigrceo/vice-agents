"use client";
/**
 * Port of the stateofleonida.xyz map (React Three Fiber): the extended map on a tilted plane in a teal ocean,
 * the 4K core blended on top with its mask, one beacon (halo, pulsing ring, beam, sphere) per coin, HTML pins
 * projected from the scene that dodge the hero card and the rail, OrbitControls kept inside the island.
 */
import type { Plot } from "./plots";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CAST } from "@/lib/agents/cast";
import { CityNeon, Clouds, DistrictLabels, MODES, Ocean, Sky, Sun, type Mode } from "./map/Atmosphere";
import { CityLight } from "./map/Buildings";
import { TileLayer } from "./map/TileLayer";
import { Island, LAND_Y } from "./map/Island";
import { ClipBoard } from "./map/ClipBoards";
import { RealCity } from "./map/RealCity";
void RealCity;
import { districtOf, DISTRICTS } from "./map/districts";
import { beamHeight, layoutPins, walkTo, type Entity, type LayoutState, type Slot } from "./map/pins";

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

function Beacon({ e, active, onHover, onSelect }: { e: Entity; active: boolean; onHover: (m: string | null) => void; onSelect: () => void }) {
  const beam = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const g = useRef<THREE.Group>(null);
  const [x, , z] = toWorld(e.plot.u, e.plot.v);
  const h = beamHeight(e), col = e.coin.ring ?? beamColor(e), dist = DISTRICT_COLOR[e.plot.district] ?? "#fff";
  const speed = 1 + Math.min(1, (e.coin.volumeEth ?? 0) / Math.max(e.coin.mcapUsd, 1) / 0.02);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (g.current) { const p = walkTo(e, dt, toWorld); g.current.position.x = p.x; g.current.position.z = p.z; }
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

// ---- pins: the shell renders them from the first paint; the scene only feeds its live camera ----
function PinLayout({ entities, slots, selected, root }: { entities: Entity[]; slots: Map<string, Slot>; selected: string | null; root: React.RefObject<HTMLDivElement | null> }) {
  const camera = useThree((s) => s.camera), size = useThree((s) => s.size);
  const v = useMemo(() => new THREE.Vector3(), []);
  const st = useRef<LayoutState>({ frame: 0, obstaclesAt: -99, obstacles: [] });
  useFrame(() => {
    if (!root.current) return;
    layoutPins(entities, slots, selected, root.current, size, st.current, (x, y, z) => { v.set(x, y, z).project(camera); return { sx: (v.x + 1) / 2 * size.width, sy: (1 - v.y) / 2 * size.height, front: v.z < 1 }; });
  });
  return null;
}

/** Stops drawing when nobody can see the map: hidden tab, or scrolled past it. */
function Throttle({ root }: { root: React.RefObject<HTMLDivElement | null> }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    let inView = true;
    const apply = () => setFrameloop(inView && !document.hidden ? "always" : "never");
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; apply(); });
    if (root.current) io.observe(root.current);
    document.addEventListener("visibilitychange", apply);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", apply); };
  }, [root, setFrameloop]);
  return null;
}

export type SceneApi = Api;
/** The 3D part of the map, loaded after the page: the poster and the pins are already on screen, it fades in under them. */
export function MapScene({ entities, slots, active, hovered, onHover, onActive, api, root, onReady: ready0 }: {
  entities: Entity[]; slots: Map<string, Slot>; active: string | null; hovered: string | null; onHover: (m: string | null) => void; onActive: (m: string | null) => void;
  api: React.MutableRefObject<Api | null>; root: React.RefObject<HTMLDivElement | null>; onReady: () => void;
}) {
  const small = typeof window !== "undefined" && window.innerWidth < 700;
  const [ready, setReady] = useState(false);
  const [mode] = useState<Mode>("day");
  const onReady = useMemo(() => () => { setReady(true); ready0(); (window as unknown as { __mapReady?: boolean }).__mapReady = true; requestAnimationFrame(() => requestAnimationFrame(() => dispatchEvent(new Event("clip:map-ready")))); }, [ready0]);
  const select = (m: string) => onActive(m);
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: small ? [0, 9.5, 4.5] : [0, 9.5, 7], fov: 42, near: 0.1, far: 260 }} gl={{ antialias: !small, powerPreference: "high-performance" }} shadows={!small} onPointerMissed={() => onActive(null)}
      style={{ opacity: ready ? 1 : 0, transition: "opacity .6s" }}>
      <fog attach="fog" args={[MODES.dusk.fog, 18, 60]} />
      <Throttle root={root} />
      <FogCtl mode={mode} />
      <Sky mode={mode} />
      <Sun mode={mode} />
      <Suspense fallback={null}><Ground onReady={onReady} mode={mode} /></Suspense>
      {ready && <><DistrictLabels toWorld={toWorld} /><CityLight mode={mode} api={api} />{!small && <TileLayer mode={mode} planeW={PLANE_W} planeH={PLANE_H} api={api} />}</>}
      {ready && entities.map((e) => <Beacon key={e.coin.mint} e={e} active={active === e.coin.mint || hovered === e.coin.mint} onHover={onHover} onSelect={() => select(e.coin.mint)} />)}
      {ready && entities.filter((e) => !e.coin.ring).map((e) => { const [x, , z] = toWorld(e.plot.u, e.plot.v); return <group key={`b${e.coin.mint}`} position-y={LAND_Y}><ClipBoard coin={e.coin} x={x} z={z} main={e.main} active={active === e.coin.mint || hovered === e.coin.mint} onHover={onHover} onSelect={() => select(e.coin.mint)} /></group>; })}
      <Controls entities={entities} selected={active} api={api} onWorld={() => {}} />
      <PinLayout entities={entities} slots={slots} selected={active} root={root} />
    </Canvas>
  );
}
