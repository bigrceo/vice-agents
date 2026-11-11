"use client";
/**
 * Every clip on the map is a game piece: a standing board with the clip's still on a thin post, turned toward the camera
 * (upright, never tilted) so it reads at any zoom. Click → open the coin.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Coin } from "@/lib/types";

const loader = new THREE.TextureLoader();
loader.setCrossOrigin("anonymous");
const cache = new Map<string, THREE.Texture>();
function still(url: string) {
  let t = cache.get(url);
  if (!t) { t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; cache.set(url, t); }
  return t;
}

export function ClipBoard({ coin, x, z, main, active, onHover, onSelect }: { coin: Coin; x: number; z: number; main: boolean; active: boolean; onHover: (m: string | null) => void; onSelect: () => void }) {
  const g = useRef<THREE.Group>(null);
  const tex = useMemo(() => still(coin.still), [coin.still]);
  const s = main ? 1.35 : 1, w = 0.46 * s, h = 0.26 * s, post = 0.3 * s;
  useFrame(({ camera }) => {
    const gr = g.current; if (!gr) return;
    gr.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
    const k = active ? 1.12 : 1; gr.scale.lerp(new THREE.Vector3(k, k, k), 0.15);
  });
  const ev = {
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onHover(coin.mint); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { onHover(null); document.body.style.cursor = ""; },
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onSelect(); },
  };
  const frame = main ? "#ff5fa8" : "#1a0b26";
  return (
    <group ref={g} position={[x, 0, z]}>
      <mesh position-y={post / 2} castShadow><cylinderGeometry args={[0.012 * s, 0.016 * s, post, 8]} /><meshStandardMaterial color="#2a1a3a" /></mesh>
      <group position-y={post + h / 2} {...ev}>
        <mesh position-z={-0.004} castShadow><boxGeometry args={[w + 0.04 * s, h + 0.04 * s, 0.012]} /><meshStandardMaterial color={frame} roughness={0.5} /></mesh>
        <mesh position-z={0.004}><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      </group>
    </group>
  );
}
