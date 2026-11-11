"use client";
/**
 * Real Miami: Google Photorealistic 3D Tiles streamed with 3d-tiles-renderer, re-centred on downtown (ORIGIN) with Y up
 * and scaled so 1 world unit = 1 km, which matches the rest of the scene (ocean, sky, pins, open plots).
 * Needs NEXT_PUBLIC_GOOGLE_MAPS_KEY (Map Tiles API enabled). Attribution is mandatory: see MiamiCredits.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TilesRenderer } from "3d-tiles-renderer";
import { GoogleCloudAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin, TileCompressionPlugin } from "3d-tiles-renderer/plugins";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { ORIGIN, WU_PER_M } from "./georef";

export const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export function MiamiTiles({ onReady, onCredits }: { onReady: () => void; onCredits?: (c: string) => void }) {
  const { camera, gl } = useThree();
  const group = useRef<THREE.Group>(null);
  const tiles = useMemo(() => {
    if (!GOOGLE_KEY) return null;
    try {
    const t = new TilesRenderer();
    t.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: GOOGLE_KEY, autoRefreshToken: true }));
    const draco = new DRACOLoader(); draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    t.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
    t.registerPlugin(new TileCompressionPlugin());
    t.registerPlugin(new ReorientationPlugin({ up: "+y", lat: ORIGIN.lat * Math.PI / 180, lon: ORIGIN.lon * Math.PI / 180, height: 0, recenter: true }));
    t.errorTarget = 8;
    t.addEventListener("load-error", ((e: { error?: unknown; url?: string }) => console.warn("[tiles] load-error", e.url, e.error)) as EventListener);
    t.addEventListener("load-tile-set", (() => console.info("[tiles] tileset loaded")) as EventListener);
    (window as unknown as { __tiles?: TilesRenderer }).__tiles = t;
    return t;
    } catch (e) { console.error("[tiles] init failed", e); return null; }
  }, []);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!tiles || !group.current) return;
    group.current.scale.setScalar(WU_PER_M); // scale the parent, the plugin rewrites tiles.group's own transform
    group.current.add(tiles.group);
    tiles.setCamera(camera); tiles.setResolutionFromRenderer(camera, gl);
    const onLoad = () => { if (!ready) { setReady(true); onReady(); } };
    tiles.addEventListener("load-model", onLoad as EventListener);
    return () => { tiles.removeEventListener("load-model", onLoad as EventListener); tiles.dispose(); };
  }, [tiles, camera, gl]); // eslint-disable-line react-hooks/exhaustive-deps
  const tick = useRef(0);
  useFrame(() => {
    if (!tiles) return;
    tiles.setResolutionFromRenderer(camera, gl);
    tiles.update();
    if (onCredits && ++tick.current % 60 === 0) {
      const attr = (tiles as unknown as { getAttributions?: () => { value: string }[] }).getAttributions?.() ?? [];
      onCredits(attr.map((a) => a.value).join(" · "));
    }
  });
  return <group ref={group} />;
}

/** Google's required on-screen attribution. */
export function MiamiCredits({ credits }: { credits: string }) {
  return (
    <div className="pointer-events-none absolute bottom-[18px] right-6 z-20 flex max-w-[40%] items-center gap-2 text-[11px] text-ink/80 max-md:right-3 max-md:bottom-3">
      <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-bold text-[#4285f4]">Google</span>
      <span className="truncate">Map data ©{new Date().getFullYear()} Google {credits ? `· ${credits}` : ""}</span>
    </div>
  );
}
