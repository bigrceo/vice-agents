"use client";
/**
 * Native-resolution detail (1 px = 1 game unit, same as map.stateofleonida.net): the island's 256 px tiles
 * (public/map/tiles/{row}_{col}.jpg) are prefetched in a wide ring around the camera target as soon as the camera comes
 * down, and a ring is only revealed once it is (almost) fully decoded, in one shared fade, so the map sharpens as a whole
 * instead of popping square by square.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MODES, type Mode } from "./Atmosphere";

const COLS = 58, ROWS = 79;
const loader = new THREE.TextureLoader();
const cache = new Map<string, { tex: THREE.Texture; ready: boolean }>();
const order: string[] = [];
const MAX_CACHE = 900;

function getTile(key: string, gl: THREE.WebGLRenderer) {
  let e = cache.get(key);
  if (e) return e;
  const entry = { tex: null as unknown as THREE.Texture, ready: false };
  entry.tex = loader.load(`/map/tiles/${key}.jpg`, () => { entry.ready = true; });
  entry.tex.colorSpace = THREE.SRGBColorSpace; entry.tex.anisotropy = gl.capabilities.getMaxAnisotropy();
  entry.tex.generateMipmaps = true; entry.tex.minFilter = THREE.LinearMipmapLinearFilter;
  cache.set(key, entry); order.push(key);
  if (order.length > MAX_CACHE) { const old = order.shift()!; cache.get(old)?.tex.dispose(); cache.delete(old); }
  e = entry; return e;
}

type T = { k: string; i: number; j: number };

export function TileLayer({ mode, planeW, planeH, api }: { mode: Mode; planeW: number; planeH: number; api: React.MutableRefObject<{ target: THREE.Vector3 } | null> }) {
  const camera = useThree((s) => s.camera), gl = useThree((s) => s.gl);
  const [shown, setShown] = useState<T[]>([]);
  const pending = useRef<{ tiles: T[]; since: number } | null>(null);
  const last = useRef({ at: 0, sig: "" });
  const tw = planeW / COLS, th = planeH / ROWS;
  const target = useMemo(() => new THREE.Vector3(), []);
  const fade = useRef(0);
  const mats = useRef(new Map<string, THREE.MeshBasicMaterial>());
  useFrame(({ clock }, dt) => {
    // shared fade: 0 while the layer is hidden, 1 once revealed
    const tint = new THREE.Color(MODES[mode].tint);
    const want = shown.length ? 1 : 0;
    fade.current += (want - fade.current) * Math.min(1, dt * 2.5);
    for (const m of mats.current.values()) { m.opacity = fade.current; m.color.lerp(tint, 0.1); }
    if (clock.elapsedTime - last.current.at < 0.2) return;
    // the first second and a half belongs to the base map: no tile downloads competing with it unless you zoom in
    if (clock.elapsedTime < 1.6 && camera.position.distanceTo(api.current?.target ?? target) > 6) return;
    last.current.at = clock.elapsedTime;
    if (api.current) target.copy(api.current.target);
    const dist = camera.position.distanceTo(target);
    // start fetching far out (the base map still looks fine there), reveal when close
    const r = dist < 2 ? 7 : dist < 3.5 ? 8 : dist < 6 ? 7 : 6; // always prefetching: the zoom-out cap keeps us near the map
    const ci = Math.floor((target.x + planeW / 2) / tw), cj = Math.floor((target.z + planeH / 2) / th);
    const sig = r ? `${r}:${ci}:${cj}` : "";
    if (sig !== last.current.sig) {
      last.current.sig = sig;
      if (!r) { pending.current = null; if (shown.length) setShown([]); return; }
      const next: (T & { d: number })[] = [];
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r - 3; i <= ci + r + 3; i++) {
        if (i < 0 || j < 0 || i >= COLS || j >= ROWS) continue;
        next.push({ k: `${j}_${i}`, i, j, d: (i - ci) ** 2 + (j - cj) ** 2 });
      }
      next.sort((a, b) => a.d - b.d);
      const tiles = next.slice(0, 260);
      tiles.forEach((t) => getTile(t.k, gl));
      pending.current = { tiles, since: clock.elapsedTime };
    }
    const p = pending.current;
    if (p && dist < 8.5) {
      const ready = p.tiles.filter((t) => cache.get(t.k)?.ready).length;
      // reveal only once every tile is decoded (no square-by-square), with a 3 s safety
      if (ready === p.tiles.length || clock.elapsedTime - p.since > 3) { setShown(p.tiles); pending.current = null; }
    }
  });
  useEffect(() => () => { mats.current.clear(); }, []);
  return (
    <group>
      {shown.map((t) => {
        const e = cache.get(t.k) ?? getTile(t.k, gl);
        return (
          <mesh key={t.k} rotation-x={-Math.PI / 2} position={[-planeW / 2 + (t.i + 0.5) * tw, 0.004, -planeH / 2 + (t.j + 0.5) * th]} renderOrder={1}>
            <planeGeometry args={[tw, th]} />
            <meshBasicMaterial ref={(m) => { if (m) mats.current.set(t.k, m); else mats.current.delete(t.k); }} map={e.tex} transparent opacity={0} depthWrite={false} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}
