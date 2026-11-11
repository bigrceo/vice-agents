"use client";
/**
 * Real buildings on Leonida: South-Florida footprints (Overture Maps, ODbL/CDLA) warped onto the island with the same
 * degree-2 fit as the satellite ground (scratch bldwarp.py → public/map/realbld.bin, 8 float32 per building:
 * u, v, w, d, rot, height_m, class, pad). Rendered as one InstancedMesh per class with light, Google-Earth-like
 * untextured walls (floor lines, windows that light up at night).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MODES, type Mode } from "./Atmosphere";
import { buildFacades, FLOOR_METERS, TILE_FLOORS, type Facade } from "./facades";

const METER = 16 / 14848;
const HEIGHT_SCALE = 1.0;        // real metres: the satellite ground is to scale
const NCLASS = 6;
const FACADE_OF = [0, 1, 2, 2, 4, 1]; // house, apartments, commercial, office, industrial, hotel
const TINT = ["#f4f1ea", "#efe9e0", "#e6e9ee", "#dfe8f2", "#e3e3e0", "#f2eadf"];

function floorUvShader(mat: THREE.Material) {
  const tileH = FLOOR_METERS * TILE_FLOORS * METER * HEIGHT_SCALE, tileW = 6.8 * METER;
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

export function RealCity({ mode, planeW, planeH }: { mode: Mode; planeW: number; planeH: number }) {
  const [data, setData] = useState<Float32Array | null>(null);
  useEffect(() => { fetch("/map/realbld.bin").then((r) => r.arrayBuffer()).then((b) => setData(new Float32Array(b))).catch(() => setData(new Float32Array())); }, []);
  const geo = useMemo(() => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); const n = g.attributes.position.count, col = new Float32Array(n * 3); const nrm = g.attributes.normal; for (let i = 0; i < n; i++) { const v = nrm.getY(i) > 0.5 ? 0.82 : 1; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; } g.setAttribute("color", new THREE.BufferAttribute(col, 3)); return g; }, []);
  const facades = useMemo<Facade[]>(() => buildFacades(), []);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const counts = useMemo(() => { const c = new Array(NCLASS).fill(0); if (data) for (let i = 0; i < data.length; i += 8) c[Math.min(NCLASS - 1, data[i + 6] | 0)]++; return c; }, [data]);
  useEffect(() => {
    if (!data) return;
    const o = new THREE.Object3D(), col = new THREE.Color(); const idx = new Array(NCLASS).fill(0);
    for (let i = 0; i < data.length; i += 8) {
      const u = data[i], v = data[i + 1], w = data[i + 2], d = data[i + 3], rot = data[i + 4], h = data[i + 5], k = Math.min(NCLASS - 1, data[i + 6] | 0);
      const m = refs.current[k]; if (!m) continue;
      o.position.set((u - 0.5) * planeW, 0, (v - 0.5) * planeH); o.rotation.set(0, -rot, 0);
      o.scale.set(Math.max(w * planeW, 0.002), Math.max(h, 3) * METER * HEIGHT_SCALE, Math.max(d * planeH, 0.002)); o.updateMatrix();
      const j = idx[k]++; m.setMatrixAt(j, o.matrix);
      col.set(TINT[k]); const hv = Math.abs((Math.sin(u * 9731 + v * 5113) * 43758.5) % 1); col.offsetHSL(0, 0, (hv - 0.5) * 0.08); m.setColorAt(j, col);
    }
    refs.current.forEach((m, k) => { if (!m) return; m.count = idx[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); });
  }, [data, planeW, planeH]);
  useFrame(() => { const t = new THREE.Color(MODES[mode].tint), neon = MODES[mode].neon; for (const m of mats.current) { if (!m) continue; m.color.lerp(t, 0.05); m.emissiveIntensity += (neon * 0.7 - m.emissiveIntensity) * 0.05; } });
  if (!data) return null;
  return (
    <group>
      {Array.from({ length: NCLASS }, (_, k) => (
        <instancedMesh key={k} ref={(el) => { refs.current[k] = el; }} args={[geo, undefined, Math.max(counts[k], 1)]} frustumCulled={false} renderOrder={2} castShadow receiveShadow>
          <meshStandardMaterial ref={(el) => { if (el) mats.current[k] = el; }} vertexColors color="#ffffff" map={facades[FACADE_OF[k]].map} normalMap={facades[FACADE_OF[k]].normal} normalScale={new THREE.Vector2(0.6, 0.6)}
            emissive="#ffffff" emissiveMap={facades[FACADE_OF[k]].emissive} emissiveIntensity={0} roughness={0.8} metalness={0.02} envMapIntensity={0.5}
            onUpdate={(m) => { if (!m.userData.uv) { m.userData.uv = true; floorUvShader(m); m.needsUpdate = true; } }} />
        </instancedMesh>
      ))}
    </group>
  );
}
