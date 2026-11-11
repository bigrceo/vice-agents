"use client";
/**
 * The 107 real landmarks of Vice City (Opera Tower, Four Seasons, Freedom Tower…): position and height triangulated from the
 * trailers by Robert Luxemburg (public domain, github.com/rolux/gtamaplib-vc), each box wrapped in the in-game frame crop
 * of its facade, so the skyline shows the actual buildings of the game.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MODES, type Mode } from "./Atmosphere";

type Lm = { name: string; id: string; u: number; v: number; h: number; w: number; shape: string; tex: string | null };
const METER = 16 / 14848;
const HEIGHT_SCALE = 0.42; // ~2.4 m per map pixel: real metres scaled to the island
const loader = new THREE.TextureLoader();

function Tower({ l, planeW, planeH, mode }: { l: Lm; planeW: number; planeH: number; mode: Mode }) {
  const side = useRef<THREE.MeshBasicMaterial>(null), top = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => {
    if (!l.tex) return null;
    const t = loader.load(`/map/landmarks/${l.tex}`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }, [l.tex]);
  const mats = useMemo(() => {
    const s = new THREE.MeshBasicMaterial({ map: tex ?? undefined, color: tex ? "#ffffff" : "#8fd3ff", toneMapped: false });
    const t = new THREE.MeshBasicMaterial({ color: "#eaf2ff", toneMapped: false });
    side.current = s; top.current = t;
    return [s, s, t, t, s, s];
  }, [tex]);
  useFrame(() => {
    const m = MODES[mode];
    side.current?.color.lerp(new THREE.Color(m.tint).multiplyScalar(mode === "night" ? 1.35 : 1.0), 0.05);
    top.current?.color.lerp(new THREE.Color(m.tint).multiply(new THREE.Color("#eaf2ff")), 0.05);
  });
  const w = Math.max(l.w || 20, 18) * METER * 1.6, h = l.h * METER * HEIGHT_SCALE;
  const x = (l.u - 0.5) * planeW, z = (l.v - 0.5) * planeH;
  return (
    <mesh position={[x, h / 2, z]} material={mats} renderOrder={2} castShadow>
      {l.shape === "pyramid" ? <coneGeometry args={[w * 0.7, h, 4]} /> : <boxGeometry args={[w, h, w]} />}
    </mesh>
  );
}

export function Landmarks({ mode, planeW, planeH }: { mode: Mode; planeW: number; planeH: number }) {
  const [lms, setLms] = useState<Lm[]>([]);
  useEffect(() => { fetch("/map/landmarks.json").then((r) => r.json()).then(setLms).catch(() => setLms([])); }, []);
  return <group>{lms.filter((l) => l.shape !== "pyramid" && l.tex).map((l) => <Tower key={l.id} l={l} planeW={planeW} planeH={planeH} mode={mode} />)}</group>;
}
