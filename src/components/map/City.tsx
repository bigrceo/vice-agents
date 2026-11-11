"use client";
/**
 * Procedural Leonida, SimCity style: every urban block of the Yanis V17 map is cut into lots (scratch citygen.py) and each lot
 * gets a typed building (house, mid-rise, stepped tower, art-deco, shed) sized by district, plus park trees and coast palms.
 * One InstancedMesh per archetype, so ~20k buildings and ~38k trees cost 7 draw calls.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MODES, type Mode } from "./Atmosphere";
import { buildFacades, FLOOR_METERS, TILE_FLOORS, type Facade } from "./facades";

const METER = 16 / 14848;
const HEIGHT_SCALE = 0.42; // ~2.4 m per map pixel: real metres scaled to the island
const PALETTE = ["#f5f2ec", "#ebe6dc", "#e2ddd3", "#f0ece4", "#d9d6cf", "#e8e2d4", "#f3eee6", "#ffffff", "#e6e9ee", "#dfe4ea", "#cfd6de", "#e9e4da", "#f1ebe0", "#ddd8cf", "#f6f1e8", "#e4e0d8"];

/** Unit archetypes: footprint 1×1, total height 1; roof faces carry a darker vertex colour. */
function box(w: number, h: number, d: number, y: number, x = 0, z = 0, shade = 1) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  const nrm = g.attributes.normal;
  for (let i = 0; i < n; i++) { const up = nrm.getY(i) > 0.5; const v = up ? 0.78 * shade : shade; col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); return g;
}
function roofKit(parts: THREE.BufferGeometry[], w: number, y: number, n: number) {
  // parapet rim + a few AC units / a water tank
  const t = 0.04;
  parts.push(box(w, 0.025, t, y, 0, w / 2 - t / 2, 0.9), box(w, 0.025, t, y, 0, -w / 2 + t / 2, 0.9), box(t, 0.025, w, y, w / 2 - t / 2, 0, 0.9), box(t, 0.025, w, y, -w / 2 + t / 2, 0, 0.9));
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.7; parts.push(box(0.1, 0.04, 0.1, y, Math.cos(a) * w * 0.28, Math.sin(a) * w * 0.28, 0.75)); }
  if (n >= 3) { const tank = new THREE.CylinderGeometry(0.07, 0.07, 0.08, 10); tank.translate(0, y + 0.04, 0); const c = new Float32Array(tank.attributes.position.count * 3).fill(0.8); tank.setAttribute("color", new THREE.BufferAttribute(c, 3)); parts.push(tank); }
}
function archetype(kind: number) {
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 0) { parts.push(box(1, 0.9, 1, 0), box(1.08, 0.1, 1.08, 0.9, 0, 0, 0.9)); }                       // house with a lipped roof
  else if (kind === 1) { parts.push(box(1, 0.82, 1, 0), box(0.82, 0.18, 0.82, 0.82)); roofKit(parts, 1, 0.82, 2); }   // mid-rise with a penthouse
  else if (kind === 2) { parts.push(box(1, 0.58, 1, 0), box(0.8, 0.24, 0.8, 0.58), box(0.6, 0.12, 0.6, 0.82), box(0.1, 0.06, 0.1, 0.94, 0, 0, 1.2)); roofKit(parts, 1, 0.58, 3); roofKit(parts, 0.8, 0.82, 0); } // stepped tower + spire
  else if (kind === 3) { parts.push(box(1, 0.68, 1, 0), box(0.86, 0.12, 0.86, 0.68), box(0.7, 0.1, 0.7, 0.8), box(0.52, 0.1, 0.52, 0.9)); roofKit(parts, 1, 0.68, 0); } // art-deco crown
  else { parts.push(box(1, 0.9, 1.0, 0), box(0.2, 0.1, 1.0, 0.9, 0, 0, 0.85)); }                               // shed with a ridge
  const g = mergeGeometries(parts, false)!; parts.forEach((p) => p.dispose()); return g;
}
function treeGeo(palm: boolean) {
  const parts: THREE.BufferGeometry[] = [];
  if (palm) {
    parts.push(box(0.12, 0.8, 0.12, 0, 0, 0, 0.55));
    for (let i = 0; i < 5; i++) { const f = new THREE.BoxGeometry(0.9, 0.05, 0.22); f.translate(0.4, 0, 0); f.rotateZ(-0.35); f.rotateY((i / 5) * Math.PI * 2); f.translate(0, 0.8, 0); const n = f.attributes.position.count; const c = new Float32Array(n * 3).fill(1); f.setAttribute("color", new THREE.BufferAttribute(c, 3)); parts.push(f); }
  } else {
    parts.push(box(0.14, 0.3, 0.14, 0, 0, 0, 0.55));
    const c = new THREE.ConeGeometry(0.5, 0.75, 6); c.translate(0, 0.65, 0); const n = c.attributes.position.count; const col = new Float32Array(n * 3).fill(1); c.setAttribute("color", new THREE.BufferAttribute(col, 3)); parts.push(c);
  }
  const g = mergeGeometries(parts, false)!; parts.forEach((p) => p.dispose()); return g;
}

type Data = { lots: Float32Array; trees: Float32Array };

/** Scale UVs by the instance size so one texture tile = TILE_FLOORS floors / ~6.8 m, on every face; roofs sample plain wall. */
function floorUvShader(mat: THREE.Material) {
  const tileH = FLOOR_METERS * TILE_FLOORS * METER * HEIGHT_SCALE, tileW = 6.8 * METER * HEIGHT_SCALE;
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTile = { value: new THREE.Vector2(tileW, tileH) };
    s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nuniform vec2 uTile;")
      .replace("#include <uv_vertex>", `
      float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz), sz = length(instanceMatrix[2].xyz);
      float side = abs(normal.x) > 0.5 ? sz : sx;
      vec2 uvS = abs(normal.y) > 0.5 ? vec2(0.03, 0.03) : vec2(uv.x * side / uTile.x, uv.y * sy / uTile.y);
      #if defined( USE_MAP )
      vMapUv = ( mapTransform * vec3( uvS, 1 ) ).xy;
      #endif
      #ifdef USE_NORMALMAP
      vNormalMapUv = ( normalMapTransform * vec3( uvS, 1 ) ).xy;
      #endif
      #ifdef USE_EMISSIVEMAP
      vEmissiveMapUv = ( emissiveMapTransform * vec3( uvS, 1 ) ).xy;
      #endif`);
  };
}

export function City({ mode, planeW, planeH }: { mode: Mode; planeW: number; planeH: number }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    Promise.all([fetch("/map/city.bin").then((r) => r.arrayBuffer()), fetch("/map/trees.bin").then((r) => r.arrayBuffer())])
      .then(([a, b]) => setData({ lots: new Float32Array(a), trees: new Float32Array(b) })).catch(() => null);
  }, []);
  const geos = useMemo(() => [0, 1, 2, 3, 4].map(archetype), []);
  const tgeos = useMemo(() => [treeGeo(false), treeGeo(true)], []);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const trefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const facades = useMemo<Facade[]>(() => buildFacades(), []);
  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0]; if (data) for (let i = 0; i < data.lots.length; i += 8) c[data.lots[i + 6] | 0]++;
    const t = [0, 0]; if (data) for (let i = 0; i < data.trees.length; i += 4) t[data.trees[i + 3] | 0]++;
    return { c, t };
  }, [data]);
  useEffect(() => {
    if (!data) return;
    const o = new THREE.Object3D(), col = new THREE.Color();
    const idx = [0, 0, 0, 0, 0];
    for (let i = 0; i < data.lots.length; i += 8) {
      const [u, v, w, d, rot, h, kind, ci] = Array.from(data.lots.subarray(i, i + 8));
      const m = refs.current[kind | 0]; if (!m) continue;
      o.position.set((u - 0.5) * planeW, 0, (v - 0.5) * planeH); o.rotation.set(0, -rot, 0);
      o.scale.set(Math.max(w * planeW, 0.006), h * METER * HEIGHT_SCALE, Math.max(d * planeH, 0.006)); o.updateMatrix();
      const k = idx[kind | 0]++; m.setMatrixAt(k, o.matrix);
      col.set(PALETTE[(ci | 0) % PALETTE.length]); if (h > 90) col.lerp(new THREE.Color("#8fe3ff"), 0.5); m.setColorAt(k, col);
    }
    refs.current.forEach((m, k) => { if (!m) return; m.count = idx[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); });
    const tidx = [0, 0];
    for (let i = 0; i < data.trees.length; i += 4) {
      const [u, v, s, kind] = Array.from(data.trees.subarray(i, i + 4));
      const m = trefs.current[kind | 0]; if (!m) continue;
      const size = (kind ? 16 : 11) * METER * s * 0.7;
      o.position.set((u - 0.5) * planeW, 0, (v - 0.5) * planeH); o.rotation.set(0, u * 97, 0); o.scale.set(size, size * 1.3, size); o.updateMatrix();
      const k = tidx[kind | 0]++; m.setMatrixAt(k, o.matrix);
      col.set(kind ? "#2fbf71" : ["#2e9e5b", "#4fb86b", "#1f8a4c"][k % 3]); m.setColorAt(k, col);
    }
    trefs.current.forEach((m, k) => { if (!m) return; m.count = tidx[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); });
  }, [data, planeW, planeH]);
  useFrame(() => {
    const t = new THREE.Color(MODES[mode].tint), neon = MODES[mode].neon;
    for (const m of mats.current) { if (!m) continue; m.color.lerp(t, 0.05); if (m.emissiveMap) m.emissiveIntensity += (neon * 0.8 - m.emissiveIntensity) * 0.05; }
  });
  if (!data) return null;
  return (
    <group>
      {geos.map((g, k) => (
        <instancedMesh key={k} ref={(el) => { refs.current[k] = el; }} args={[g, undefined, Math.max(counts.c[k], 1)]} frustumCulled={false} renderOrder={2} castShadow receiveShadow>
          <meshStandardMaterial ref={(el) => { if (el) mats.current[k] = el; }} vertexColors color="#ffffff" map={facades[k].map} normalMap={facades[k].normal} normalScale={new THREE.Vector2(0.9, 0.9)}
            emissive="#ffffff" emissiveMap={facades[k].emissive} emissiveIntensity={0} roughness={k === 2 ? 0.35 : 0.75} metalness={k === 2 ? 0.3 : 0.02} envMapIntensity={0.7}
            onUpdate={(m) => { if (!m.userData.uv) { m.userData.uv = true; floorUvShader(m); m.needsUpdate = true; } }} />
        </instancedMesh>
      ))}
      {tgeos.map((g, k) => (
        <instancedMesh key={`t${k}`} ref={(el) => { trefs.current[k] = el; }} args={[g, undefined, Math.max(counts.t[k], 1)]} frustumCulled={false} renderOrder={2} castShadow>
          <meshStandardMaterial ref={(el) => { if (el) mats.current[5 + k] = el; }} vertexColors color="#ffffff" roughness={0.9} />
        </instancedMesh>
      ))}
    </group>
  );
}
