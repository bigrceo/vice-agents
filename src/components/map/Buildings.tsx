"use client";
/**
 * 3D city: building footprints classified from the Yanis V17 raster (public/map/buildings.json, [cx, cy, w, d, rot, area] in
 * image u/v) extruded as InstancedMeshes (bodies + roofs), plus the 107 landmark towers triangulated by Robert Luxemburg
 * (public domain, github.com/rolux/gtamaplib-vc) at their real height. Vice City palette: art-deco pastels on the beach,
 * glass teal downtown, warm industrial at the port, white and wood on the keys. Roofs carry neon trims that light up at dusk.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MODES, type Mode } from "./Atmosphere";
import { DISTRICTS, districtOf } from "./districts";

type Fp = [number, number, number, number, number, number];
type Lm = { name: string; u: number; v: number; h: number; w: number; shape: string };
const METER = 16 / 14848;        // plane width 16 wu = 58 tiles × 256 game units
const HEIGHT_SCALE = 1.5;        // stylised: real metres × 1.5
const CORES = DISTRICTS.filter((d) => ["Vice City", "Vice Beach"].includes(d.name));

/** Palettes by area: saturated, Vice. */
const PALETTES: Record<string, string[]> = {
  beach:    ["#ff8fb8", "#ffb86b", "#7de3c9", "#8fd3ff", "#fff07a", "#c9a7ff", "#ff7f98", "#ffffff", "#ffd1dc", "#9ff2e4"],
  downtown: ["#39c6ea", "#4fd1c5", "#6c9dff", "#7ee8fa", "#b388ff", "#ff6fa8", "#e8f1ff", "#ffffff", "#5fb8ff", "#ffb3d9"],
  port:     ["#ff9f45", "#ffd166", "#ef6351", "#f4e1b5", "#8ecae6", "#c77dff", "#ffb703", "#e9ecef"],
  keys:     ["#ffffff", "#fff3c4", "#bde0a8", "#ffd6e7", "#c8f0ff", "#ffe29a", "#b9f6ca", "#ffb3ab"],
  rural:    ["#fff1d0", "#ffd9b3", "#ffc8dd", "#cfe9b7", "#e0d4ff", "#ffffff", "#ffe6a7"],
};
const ROOFS = ["#ff2d95", "#19f5e3", "#ffe14d", "#ff6a3d", "#b56cff", "#2affc6", "#ff8fcf", "#ffffff"];
function paletteFor(district: string) {
  if (/Beach|Dalton|Rialto|Starfish|Waning|Gloriana|Catalan|Leaf/.test(district)) return PALETTES.beach;
  if (/Vice City|Port Vice|Airport/.test(district)) return PALETTES.downtown;
  if (/Gellhorn|Capri|Kelly/.test(district)) return PALETTES.port;
  if (/Key|Mariana|Hamlet|Watson/.test(district)) return PALETTES.keys;
  return PALETTES.rural;
}
const hash = (a: number, b: number) => Math.abs((Math.sin(a * 9731.7 + b * 5113.3) * 43758.5453) % 1);

function windowsTexture() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 256; const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, 128, 256);
  for (let y = 3; y < 256; y += 6) for (let x = 3; x < 128; x += 6) { if (Math.random() < 0.5) { g.fillStyle = Math.random() < 0.75 ? "#ffd27a" : "#9fe8ff"; g.fillRect(x, y, 3, 3); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function facadeTexture() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 256; const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 6) { g.fillStyle = "rgba(20,10,40,.22)"; g.fillRect(0, y, 128, 1); }
  for (let x = 0; x < 128; x += 8) { g.fillStyle = "rgba(20,10,40,.10)"; g.fillRect(x, 0, 1, 256); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Vertical gradient on the body: darker base, brighter crown. */
function gradientShader(mat: THREE.Material) {
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nvarying float vLocalY;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocalY = position.y;");
    s.fragmentShader = s.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vLocalY;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.62, 1.12, smoothstep(0.0, 1.0, vLocalY));");
  };
}

export function Buildings({ mode, planeW, planeH }: { mode: Mode; planeW: number; planeH: number }) {
  const [data, setData] = useState<{ fps: Fp[]; lms: Lm[] } | null>(null);
  useEffect(() => {
    Promise.all([fetch("/map/buildings.json").then((r) => r.json()), fetch("/map/landmarks.json").then((r) => r.json())])
      .then(([fps, lms]) => setData({ fps, lms })).catch(() => setData({ fps: [], lms: [] }));
  }, []);
  const body = useRef<THREE.InstancedMesh>(null), roof = useRef<THREE.InstancedMesh>(null);
  const bodyMat = useRef<THREE.MeshLambertMaterial>(null), roofMat = useRef<THREE.MeshBasicMaterial>(null);
  const emissive = useMemo(() => windowsTexture(), []);
  const facade = useMemo(() => facadeTexture(), []);
  const geo = useMemo(() => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; }, []);
  const roofGeo = useMemo(() => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; }, []);
  const count = data?.fps.length ?? 0;
  useEffect(() => {
    const m = body.current, r = roof.current; if (!m || !r || !data) return;
    const o = new THREE.Object3D(), col = new THREE.Color(), rc = new THREE.Color();
    const toX = (u: number) => (u - 0.5) * planeW, toZ = (v: number) => (v - 0.5) * planeH;
    const lmPts = data.lms.map((l) => [l.u, l.v, l.h] as const);
    let i = 0;
    const place = (cu: number, cv: number, w: number, d: number, rot: number, h: number, c: THREE.Color, roofC: THREE.Color) => {
      const hh = h * METER * HEIGHT_SCALE;
      o.position.set(toX(cu), 0, toZ(cv)); o.rotation.set(0, -rot, 0); o.scale.set(w, hh, d); o.updateMatrix();
      m.setMatrixAt(i, o.matrix); m.setColorAt(i, c);
      // roof: a thin slab in a neon accent, slightly inset
      o.position.y = hh; o.scale.set(w * 0.96, Math.max(hh * 0.025, 0.0015), d * 0.96); o.updateMatrix();
      r.setMatrixAt(i, o.matrix); r.setColorAt(i, roofC); i++;
    };
    for (const [cu, cv, w, d, rot, area] of data.fps) {
      let h = 0, under = false;
      for (const [lu, lv] of lmPts) if (Math.abs(lu - cu) < 0.003 && Math.abs(lv - cv) < 0.003) under = true;
      if (under) continue;
      const district = districtOf(cu, cv);
      if (!h) {
        const core = Math.min(...CORES.map((c) => Math.hypot((c.u - cu) * 0.73, c.v - cv)));
        const urban = THREE.MathUtils.clamp(1 - core / 0.07, 0, 1);
        h = 6 + Math.sqrt(area) * 0.7 + urban * (18 + hash(cu, cv) * 55);
        if (area > 1500) h = Math.min(h, 14);
      }
      const pal = paletteFor(district);
      col.set(pal[Math.floor(hash(cv, cu) * pal.length) % pal.length]);
      if (h > 90) col.lerp(new THREE.Color("#8fe3ff"), 0.45);
      rc.set(ROOFS[Math.floor(hash(cu * 3, cv * 7) * ROOFS.length) % ROOFS.length]);
      place(cu, cv, Math.max(w * planeW, 0.012), Math.max(d * planeH, 0.012), rot, h, col, rc);
    }
    m.count = i; r.count = i;
    m.instanceMatrix.needsUpdate = true; r.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true; if (r.instanceColor) r.instanceColor.needsUpdate = true;
    m.computeBoundingSphere(); r.computeBoundingSphere();
  }, [data, planeW, planeH]);
  useFrame(() => {
    const target = MODES[mode].neon;
    if (bodyMat.current) { bodyMat.current.emissiveIntensity += (target * 0.9 - bodyMat.current.emissiveIntensity) * 0.05; bodyMat.current.color.lerp(new THREE.Color(MODES[mode].tint), 0.05); }
    if (roofMat.current) { roofMat.current.color.lerp(new THREE.Color().setScalar(0.75 + target * 0.9), 0.05); }
  });
  if (!data) return null;
  return (
    <>
      <instancedMesh ref={body} args={[geo, undefined, Math.max(count, 1)]} frustumCulled={false} renderOrder={2}>
        <meshLambertMaterial ref={bodyMat} color="#ffffff" map={facade} emissive="#ffffff" emissiveMap={emissive} emissiveIntensity={0} onUpdate={(mat) => { if (!mat.userData.grad) { mat.userData.grad = true; gradientShader(mat); mat.needsUpdate = true; } }} />
      </instancedMesh>
      <instancedMesh ref={roof} args={[roofGeo, undefined, Math.max(count, 1)]} frustumCulled={false} renderOrder={3}>
        <meshBasicMaterial ref={roofMat} color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </>
  );
}

/** Sun (with a shadow camera that follows the view) + ambient + room environment for PBR, following the mode. */
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useThree } from "@react-three/fiber";
export function CityLight({ mode, api }: { mode: Mode; api?: React.MutableRefObject<{ target: THREE.Vector3 } | null> }) {
  const sun = useRef<THREE.DirectionalLight>(null), amb = useRef<THREE.AmbientLight>(null);
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  useFrame(() => {
    const m = MODES[mode];
    const s = sun.current;
    if (s) {
      s.color.lerp(new THREE.Color(m.sun), 0.05); s.intensity += ((mode === "night" ? 0.3 : mode === "dusk" ? 2.2 : 3.0) - s.intensity) * 0.05;
      const t = api?.current?.target ?? new THREE.Vector3();
      s.target.position.copy(t); s.target.updateMatrixWorld();
      s.position.copy(t).add(new THREE.Vector3(4, m.sunY * 0.9 + 3, -5)); s.shadow.camera.updateProjectionMatrix();
    }
    if (amb.current) { amb.current.intensity += ((mode === "night" ? 0.7 : 1.1) - amb.current.intensity) * 0.05; amb.current.color.lerp(new THREE.Color(mode === "night" ? "#5a62c9" : "#ffffff"), 0.05); }
  });
  return (
    <>
      <ambientLight ref={amb} intensity={1.1} />
      <directionalLight ref={sun} position={[6, 8, -8]} intensity={2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-3.5} shadow-camera-right={3.5} shadow-camera-top={3.5} shadow-camera-bottom={-3.5} shadow-camera-near={0.5} shadow-camera-far={40} />
    </>
  );
}
