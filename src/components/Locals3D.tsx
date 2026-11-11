"use client";
/**
 * Meet the Locals, in 3D: fan-made GTA VI character models (glTF, CC BY, see LOCALS[].credit) spinning in their own
 * card. Each model only loads when its card scrolls into view; a card whose file is missing shows a silhouette.
 */
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { PalmBackdrop } from "./PalmBackdrop";
import { ChromaticAberration, EffectComposer, N8AO, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction, type ChromaticAberrationEffect, type NoiseEffect, type VignetteEffect } from "postprocessing";

import { LOCALS, type Local } from "@/lib/locals";
export { LOCALS, type Local };





if (typeof window !== "undefined") {
  for (const l of LOCALS) useLoader.preload(GLTFLoader, l.file, setupLoader);
}

/** Backdrop shader: two mirrored copies around the cylinder, plus horizontal motion streaks during slow-mo
 *  (bright lights smear further than the rest, like the trails in GTA's slow-motion shots). */
const STREAK_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const STREAK_FS = `
  uniform sampler2D map; uniform float uStreak; varying vec2 vUv;
  vec3 tap(float u, float v) { u = mod(u * 2.0, 2.0); u = u > 1.0 ? 2.0 - u : u; return texture2D(map, vec2(u, v)).rgb; }
  void main() {
    vec3 c = tap(vUv.x, vUv.y);
    if (uStreak > 0.0005) {
      vec3 acc = c; float w = 1.0;
      for (int i = 1; i <= 14; i++) {
        float o = float(i) / 14.0 * uStreak; float k = 1.0 - float(i) / 15.0;
        vec3 a = tap(vUv.x + o, vUv.y), b = tap(vUv.x - o * 0.35, vUv.y);
        float la = dot(a, vec3(0.3, 0.59, 0.11)), lb = dot(b, vec3(0.3, 0.59, 0.11));
        acc += a * k * (1.0 + la * 1.5) + b * k * 0.5 * (1.0 + lb * 1.5); w += k * (1.0 + la * 1.5) + k * 0.5 * (1.0 + lb * 1.5);
      }
      c = acc / w;
    }
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

/** GTA-style slow motion: 5 s at normal speed, ease into 2 s of slow-mo, ease out. 0 = normal, 1 = full slow-mo. */
const CYCLE = 9.5;
function slowmo(t: number) {
  const x = t % CYCLE, e = (v: number) => v * v * (3 - 2 * v);
  if (x < 5) return 0; if (x < 6) return e(x - 5); if (x < 8.2) return 1; if (x < 9.5) return 1 - e((x - 8.2) / 1.3); return 0;
}
const speed = (t: number) => 1 - 0.88 * slowmo(t);

const BREATH = { value: 0 };

const SUN = new THREE.Vector3(-2.2, 1.1, 2.8);

function setupLoader(l: GLTFLoader) {
  const draco = new DRACOLoader(); draco.setDecoderPath("/draco/"); draco.setDecoderConfig({ type: "wasm" }); draco.preload();
  l.setDRACOLoader(draco); l.setMeshoptDecoder(MeshoptDecoder);
}

/** Skin shading: wrap lighting (soft terminator), red subsurface bleed where light grazes, matte base with a faint oily
 *  clearcoat on the highlights and a soft sheen. Applied to the whole bust (one material per generated model). */
function skinMaterial(src: THREE.MeshStandardMaterial, dim: number, objScale = 1, phase = 0, shell = 0) {
  if (!src.isMeshStandardMaterial) return src;
  const m = new THREE.MeshPhysicalMaterial({ map: src.map, bumpMap: src.map, bumpScale: 0.0035, color: new THREE.Color("#ffffff"), roughness: 0.74, metalness: 0, envMapIntensity: 0.35,
    sheen: 0.12, sheenRoughness: 0.85, sheenColor: new THREE.Color("#f2d6cc"), clearcoat: 0.06, clearcoatRoughness: 0.6, specularIntensity: 0.45, side: THREE.DoubleSide }); // double-sided: thin hair shells no longer open onto the backdrop
  void dim;
  m.onBeforeCompile = (sh) => {
    // world position for the hair mask (hair = dark, brownish, upper part of the bust)
    sh.uniforms.uBreath = BREATH; sh.uniforms.uPhase = { value: phase }; sh.uniforms.uObjScale = { value: objScale }; sh.uniforms.uShell = { value: shell };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vOPos;\nuniform float uBreath; uniform float uPhase; uniform float uObjScale; uniform float uShell;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vOPos = position;
        {
          // breathing: ~15 breaths a minute, chest swells outward, shoulders and head rise a few millimetres
          float wy = (modelMatrix * vec4(position, 1.0)).y;
          float b = sin((uBreath + uPhase) * 6.2832 / 4.2); b = b * 0.5 + 0.5; b = b * b * (3.0 - 2.0 * b);
          float chest = smoothstep(-0.5, -0.3, wy) * (1.0 - smoothstep(-0.12, 0.05, wy));
          float lift = smoothstep(-0.42, -0.05, wy);
          transformed += objectNormal * (0.0045 * chest * b) / uObjScale;
          transformed.y += (0.0028 * lift * b) / uObjScale;
          transformed -= objectNormal * uShell / uObjScale;   // inner hair layers that plug gaps in the generated mesh
        }
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
      varying vec3 vWPos;
      float hairMask = 0.0;
      float clothMask = 0.0;
      float metalMask = 0.0;
      float thinMask = 0.0;
      varying vec3 vOPos; uniform float uObjScale; uniform float uShell;
      #define uShellF uShell
      float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vnoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      vec3 transl(vec3 base, vec3 L, vec3 V, float thin) {
        float back = pow(saturate(dot(V, -L)), 3.0);                 // light coming through toward the camera
        return base * vec3(1.0, 0.42, 0.26) * back * thin * 1.6;      // blood-red glow, like ears against the sun
      }
      uniform vec3 uKeyPos;`);
    sh.uniforms.uKeyPos = { value: SUN };
    sh.fragmentShader = sh.fragmentShader.replace("#include <lights_physical_pars_fragment>", `#include <lights_physical_pars_fragment>
      vec3 sssBleed(vec3 base, float dotNLraw) {
        float t = pow(saturate(1.0 - abs(dotNLraw)), 2.5);          // strongest where light grazes the skin
        return base * vec3(1.0, 0.45, 0.35) * t * 0.3;
      }
      // Kajiya-Kay: hair strands run downwards; two shifted highlights slide along the strands as the head turns
      float hairSpec(vec3 T, vec3 H, float shift, float power) {
        vec3 Ts = normalize(T + shift * normalize(cross(cross(T, H), T)));
        float dotTH = dot(Ts, H);
        float sinTH = sqrt(max(0.0, 1.0 - dotTH * dotTH));
        return pow(sinTH, power) * smoothstep(-1.0, 0.0, dotTH);
      }`);
    // hair mask from the albedo, computed right after the texture lookup; darker roots toward the crown
    sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      {
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float brown = step(diffuseColor.b * 1.08, diffuseColor.r) * step(diffuseColor.b, diffuseColor.g + 0.06);
        float high = smoothstep(-0.05, 0.12, vWPos.y);
        hairMask = (1.0 - smoothstep(0.16, 0.34, lum)) * brown * high;
        float sat = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
        float low = 1.0 - smoothstep(-0.18, -0.02, vWPos.y);                       // below the collarbones
        clothMask = (1.0 - smoothstep(0.10, 0.22, lum)) * (1.0 - smoothstep(0.04, 0.10, sat)) * low * (1.0 - hairMask);   // dark neutral = tank top
        metalMask = smoothstep(0.40, 0.60, lum) * (1.0 - smoothstep(0.04, 0.09, sat)) * low;                               // bright neutral = chain
        diffuseColor.rgb *= 1.0 - hairMask * 0.22 * smoothstep(0.1, 0.45, vWPos.y);   // roots a touch darker near the crown
        if (uShellF > 0.0) { if (hairMask < 0.3 && smoothstep(-0.05, 0.12, vWPos.y) < 0.5) discard; diffuseColor.rgb *= 0.72; }
        // thin skin (ears, nostrils, eyelids) = where the surface curves fast relative to its size on screen
        float curv = length(fwidth(normalize(vNormal))) / max(length(fwidth(vWPos)), 1e-5);
        thinMask = smoothstep(18.0, 45.0, curv) * (1.0 - hairMask) * (1.0 - clothMask) * (1.0 - metalMask) * smoothstep(-0.05, 0.1, vWPos.y);
      }`);
    // micro relief: pores on skin, ribbed knit on the tank top (object space, so it sticks to the surface as it turns)
    sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      {
        vec3 p = vOPos * uObjScale;
        float sk = (1.0 - hairMask) * (1.0 - clothMask) * (1.0 - metalMask);
        float h = sk * (vnoise(p * 520.0) * 0.65 + vnoise(p * 1500.0) * 0.35) * 0.00022
                + clothMask * ((sin((p.x + p.z) * 950.0) * 0.5 + 0.5) * 0.0003 + vnoise(p * 2400.0) * 0.00012);
        vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
        vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
        vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
        normal = normalize(abs(det) * normal - grad);
      }`);
    // bump (strand micro-relief) only on hair
    sh.fragmentShader = sh.fragmentShader.replace("dHdxy_fwd()", "dHdxy_fwd() * hairMask");
    // hair: rougher base, no clearcoat
    sh.fragmentShader = sh.fragmentShader.replace("material.roughness = max( roughnessFactor, 0.045 );", "material.roughness = max( roughnessFactor, 0.045 ); material.roughness = mix( material.roughness, 0.85, hairMask ); material.roughness = mix( material.roughness, 0.97, clothMask ); material.roughness = mix( material.roughness, 0.28, metalMask );");
    sh.fragmentShader = sh.fragmentShader.replace("material.clearcoat = clearcoat;", "material.clearcoat = clearcoat * ( 1.0 - hairMask ) * ( 1.0 - clothMask ) * ( 1.0 - metalMask );");
    // chain: metallic; tank top: no specular, strong fabric sheen; skin keeps its sheen
    sh.fragmentShader = sh.fragmentShader.replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n\tmetalnessFactor = mix( metalnessFactor, 0.9, metalMask );");
    sh.fragmentShader = sh.fragmentShader.replace("material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );",
      "material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );\n\tmaterial.specularColor *= ( 1.0 - clothMask * 0.92 );\n\tmaterial.specularColor = mix( material.specularColor, max( material.specularColor, vec3( 0.75 ) ), metalMask );");
    sh.fragmentShader = sh.fragmentShader.replace("material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );",
      "material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );\n\tmaterial.sheenColor = mix( material.sheenColor, vec3( 0.35 ), clothMask ) * ( 1.0 - metalMask ) * ( 1.0 - hairMask );\n\tmaterial.sheenRoughness = mix( material.sheenRoughness, 1.0, clothMask );");
    // wrap the diffuse term and add the bleed (RE_Direct_Physical is reached through lights_fragment_begin)
    sh.fragmentShader = sh.fragmentShader.replace(
      "float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tvec3 irradiance = dotNL * directLight.color;",
      "float dotNLraw = dot( geometryNormal, directLight.direction );\n\tfloat dotNL = saturate( ( dotNLraw + 0.3 ) / 1.3 );\n\tvec3 irradiance = dotNL * directLight.color;\n\treflectedLight.directDiffuse += sssBleed( material.diffuseColor, dotNLraw ) * directLight.color * 0.6 * ( 1.0 - hairMask ) * ( 1.0 - clothMask ) * ( 1.0 - metalMask );\n\treflectedLight.directDiffuse += transl( material.diffuseColor, directLight.direction, geometryViewDir, thinMask ) * directLight.color;");
    // anisotropic hair highlights from the key light, added at the end of lighting
    sh.fragmentShader = sh.fragmentShader.replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
      reflectedLight.indirectDiffuse *= 1.0 - clothMask * 0.55;     // black cotton drinks the ambient light
      reflectedLight.indirectSpecular *= 1.0 + metalMask * 1.5;     // the chain mirrors the neon and the sun
      if (hairMask > 0.001) {
        vec3 nW = normalize(transpose(mat3(viewMatrix)) * normal);
        vec3 vW = normalize(cameraPosition - vWPos);
        vec3 lW = normalize(uKeyPos - vWPos);
        vec3 up = vec3(0.0, -1.0, 0.0);
        vec3 T = normalize(up - nW * dot(up, nW));
        vec3 H = normalize(lW + vW);
        float s1 = hairSpec(T, H, -0.08, 110.0);
        float s2 = hairSpec(T, H,  0.12, 40.0);
        vec3 tint = mix(vec3(1.0, 0.70, 0.40), diffuseColor.rgb * 2.2, 0.5);
        reflectedLight.directSpecular += hairMask * (s1 * 0.05 + s2 * 0.05 * diffuseColor.rgb * 3.0) * tint;
      }`);
  };
  m.customProgramCacheKey = () => "skin-hair-cloth-metal-thin-micro-breath-shell" + (shell > 0 ? "1" : "0");
  return m;
}

function Model({ url, height = 1.8, view = "full", lift = 0, dim = 1, onReady }: { url: string; height?: number; view?: "full" | "bust"; lift?: number; dim?: number; onReady?: () => void }) {
  const gltf = useLoader(GLTFLoader, url, setupLoader);
  // useLoader caches by URL: two cards showing the same file each need their own copy of the scene graph
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  const g = useRef<THREE.Group>(null);
  const [fit, setFit] = useState<{ s: number; y: number } | null>(null);
  useEffect(() => {
    scene.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(scene); const size = new THREE.Vector3(); box.getSize(size); const c = new THREE.Vector3(); box.getCenter(c);
    const s = height / Math.max(size.y, 1e-3);
    scene.position.set(-c.x, -box.min.y, -c.z);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = true;
      // Skin and hair must not read as metal: converted models often ship metallic 1 / roughness 0 → white hot spots.
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = mats.length === 1 ? skinMaterial(mats[0] as THREE.MeshStandardMaterial, dim, s, url.includes("jason") ? 1.9 : 0) : mats.map((m) => skinMaterial(m as THREE.MeshStandardMaterial, dim, s, url.includes("jason") ? 1.9 : 0));
    });
    if (url.includes("lucia")) {
      // the generated ponytail is full of small open gaps: two inner layers of the same hair, a few millimetres in, fill them
      const meshes: THREE.Mesh[] = []; scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.shell) meshes.push(o as THREE.Mesh); });
      for (const mesh of meshes) for (const off of [0.0035, 0.008]) {
        const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshPhysicalMaterial;
        const base = new THREE.MeshStandardMaterial({ map: src.map });
        const sm = skinMaterial(base, dim, s, 0, off) as THREE.Material;
        const shellMesh = new THREE.Mesh(mesh.geometry, sm); shellMesh.userData.shell = true; shellMesh.castShadow = false; shellMesh.receiveShadow = true;
        shellMesh.position.copy(mesh.position); shellMesh.quaternion.copy(mesh.quaternion); shellMesh.scale.copy(mesh.scale);
        mesh.parent?.add(shellMesh);
      }
    }
    setFit({ s, y: 0 }); onReady?.();
  }, [scene, height, dim, url]);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime; BREATH.value = t;
    if (!g.current) return; g.current.rotation.y += dt * 0.45 * speed(t);
    g.current.rotation.x = 0.008 * Math.sin(t * 0.61) + 0.004 * Math.sin(t * 1.7);   // the body is never perfectly still
    g.current.rotation.z = 0.006 * Math.sin(t * 0.47 + 1.3);
  });
  if (!fit) return null;
  // full: whole body centred; bust: the top ~32 % of the model (head and shoulders) centred, the rest fades out below
  return <group ref={g} scale={fit.s} position-y={(view === "bust" ? -height * 0.72 : -height / 2) + lift}><primitive object={scene} /></group>;
}

function studioHDR() {
  const w = 1024, h = 512, c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!;
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#3a2a5c"); sky.addColorStop(0.5, "#2a1836"); sky.addColorStop(0.62, "#4a1f3c"); sky.addColorStop(1, "#0a0710");
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const box = (x: number, y: number, bw: number, bh: number, col: string, blur: number) => { g.save(); g.filter = `blur(${blur}px)`; g.fillStyle = col; g.fillRect(x, y, bw, bh); g.restore(); };
  const sun = g.createRadialGradient(w * 0.2, h * 0.5, 0, w * 0.2, h * 0.5, w * 0.16);   // one low sun, front-left, golden
  sun.addColorStop(0, "rgba(255,196,120,0.9)"); sun.addColorStop(0.35, "rgba(255,150,80,0.45)"); sun.addColorStop(1, "rgba(255,120,80,0)");
  g.fillStyle = sun; g.fillRect(0, 0, w, h);
  box(0, h * 0.5, w, h * 0.2, "rgba(255,110,90,0.25)", 40);   // horizon glow all around
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Sky only (sun and everything else live on the rotating cylinders). */
function skyTexture() {
  const w = 16, h = 512, c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!;
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#2b0f55"); sky.addColorStop(0.34, "#6a1d8f"); sky.addColorStop(0.6, "#d6298b"); sky.addColorStop(0.86, "#ff8c46"); sky.addColorStop(1, "#ffc46b");
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** A real photo panorama of the shore wrapped around the bust, turning with it so orbiting the character orbits the place.
 *  The photo is mirrored once around the cylinder so the loop has no seam. */
/** Real photo wrapped around the bust. It is blurred like a portrait lens (shallow depth of field), it lights the bust
 *  (reflections and ambient come from the same photo) and it carries the sun: the key light sits where the sun is in the
 *  picture and turns with it, so the lit side of the face always matches the sky behind. */
function Panorama({ src, sun, sunColor }: { src: string; sun: [number, number]; sunColor: string }) {
  // backdrop pre-blurred offline (lens blur + bokeh discs + haze in one file): nothing to compute on load
  const tex = useLoader(THREE.TextureLoader, src.replace(/\.jpg$/, "-bokeh.jpg"));
  const img = tex.image as HTMLImageElement;
  const gl = useThree((st) => st.gl);
  const scene = useThree((st) => st.scene);
  useMemo(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.MirroredRepeatWrapping; tex.repeat.x = 2; tex.needsUpdate = true; }, [tex]);
  useEffect(() => {
    // The cylinder shows [photo | mirrored photo]; three's equirect lookup reads u = 0.75 − cylinder u, so build the
    // environment as that strip flipped and shifted by a quarter turn: every direction lights the bust with the exact
    // pixel the backdrop shows there (neon from the neon, sun from the sun, sea from the sea).
    const W = img.width, H = img.height, EW = 2048, EH = 1024;
    const strip = document.createElement("canvas"); strip.width = W * 2; strip.height = H; const sg = strip.getContext("2d")!;
    sg.filter = "brightness(1.25) contrast(1.1)"; sg.drawImage(img, 0, 0); sg.save(); sg.translate(W * 2, 0); sg.scale(-1, 1); sg.drawImage(img, 0, 0); sg.restore();
    const ec = document.createElement("canvas"); ec.width = EW; ec.height = EH; const eg = ec.getContext("2d")!;
    // photo spans elevation +37° … −30° → v 0.29 … 0.67; stretch its first and last rows to the poles
    const top = Math.round(EH * 0.29), bot = Math.round(EH * 0.67), bh = bot - top;
    const drawFlipped = (sy: number, shh: number, dy: number, dh: number) => {
      eg.save(); eg.translate(EW, 0); eg.scale(-1, 1);
      eg.drawImage(strip, 0, sy, W * 2, shh, -EW * 0.25, dy, EW, dh); eg.drawImage(strip, 0, sy, W * 2, shh, EW * 0.75, dy, EW, dh);
      eg.restore();
    };
    drawFlipped(0, 2, 0, top); drawFlipped(0, H, top, bh); drawFlipped(H - 2, 2, bot, EH - bot);
    const e = new THREE.CanvasTexture(ec); e.colorSpace = THREE.SRGBColorSpace; e.mapping = THREE.EquirectangularReflectionMapping;
    const p = new THREE.PMREMGenerator(gl);
    const env = p.fromEquirectangular(e).texture; scene.environment = env; scene.environmentIntensity = 1.25; p.dispose(); e.dispose();
    return () => { env.dispose(); };
  }, [tex, gl, scene]);
  const g = useRef<THREE.Group>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  // cylinder: radius 7, height 9.4 centred at y 0.6, image u = f / 2 (two mirrored copies) → angle π·f
  const th = Math.PI * sun[0], sy = Math.max(0.5, 0.6 + 4.7 - sun[1] * 9.4);
  const key: [number, number, number] = [Math.sin(th) * 4, sy * 0.6, Math.cos(th) * 4];
  const fill: [number, number, number] = [-key[0], 0.8, -key[2]];
  const streak = useMemo(() => ({ value: 0 }), []);
  useFrame((st, dt) => {
    if (!g.current) return; g.current.rotation.y += dt * 0.45 * speed(st.clock.elapsedTime);
    streak.value = slowmo(st.clock.elapsedTime) * 0.034;
    scene.environmentRotation.y = g.current.rotation.y;
    keyRef.current?.getWorldPosition(SUN);
  });
  return (
    <group ref={g}>
      <mesh position-y={0.6} renderOrder={-2}><cylinderGeometry args={[7, 7, 9.4, 128, 1, true]} /><shaderMaterial side={THREE.BackSide} depthWrite={false} toneMapped={false} uniforms={{ map: { value: tex }, uStreak: streak }} vertexShader={STREAK_VS} fragmentShader={STREAK_FS} /></mesh>
      <directionalLight ref={keyRef} position={key} intensity={5.6} color={sunColor} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.01}
        shadow-camera-left={-1.2} shadow-camera-right={1.2} shadow-camera-top={1.2} shadow-camera-bottom={-1.2} />
      <directionalLight position={fill} intensity={1.1} color="#c8c4ff" />
    </group>
  );
}

function Env() {
  useFrame(({ gl, scene }) => {
    if (!scene.environment) { const p = new THREE.PMREMGenerator(gl); scene.environment = p.fromEquirectangular(studioHDR()).texture; scene.environmentIntensity = 0.9; p.dispose(); }
    if (!scene.background) scene.background = skyTexture();
  });
  return null;
}

const CA_OFFSET = new THREE.Vector2(0, 0);
function SlowmoFX({ ca, noise, vig }: { ca: React.RefObject<ChromaticAberrationEffect | null>; noise: React.RefObject<NoiseEffect | null>; vig: React.RefObject<VignetteEffect | null> }) {
  useFrame((st) => {
    const k = slowmo(st.clock.elapsedTime);
    ca.current?.offset.set(0.0035 * k, 0.0012 * k);
    if (noise.current) noise.current.blendMode.opacity.value = 0.2 + 0.25 * k;
    if (vig.current) vig.current.darkness = 0.4 + 0.25 * k;
  });
  return null;
}

/** Compiles every shader of the scene off the main thread where the browser allows it (KHR_parallel_shader_compile),
 *  so the first visible frame does not stall. */
function Precompile() {
  const gl = useThree((st) => st.gl), scene = useThree((st) => st.scene), camera = useThree((st) => st.camera), invalidate = useThree((st) => st.invalidate);
  useEffect(() => { const r = gl as THREE.WebGLRenderer & { compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown> }; r.compileAsync?.(scene, camera).then(() => invalidate()).catch(() => null); }, [gl, scene, camera, invalidate]);
  return null;
}

function Viewer({ local, active }: { local: Local; active: boolean }) {
  const caRef = useRef<ChromaticAberrationEffect>(null), noiseRef = useRef<NoiseEffect>(null), vigRef = useRef<VignetteEffect>(null);
  const [shown, setShown] = useState(false);
  return (
    <div className="absolute inset-0 transition-opacity duration-700 ease-out" style={{ opacity: shown ? 1 : 0 }}>
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, local.view === "bust" ? 0.02 : 0.1, local.cam ?? 4.5], fov: 30 }} frameloop={active ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }} shadows="soft" style={{ background: "transparent" }}>
      <Env />
      <Suspense fallback={null}><Panorama src={local.bg ?? "/locals/ocean-drive.jpg"} sun={local.sun ?? [0.05, 0.5]} sunColor={local.sunColor ?? "#ffc48a"} /></Suspense>
      {/* portrait lighting: warm key from the front-left, cool fill from the right, sunset rim from behind */}
      <ambientLight intensity={0.34} color="#d8d2e6" />
      <Suspense fallback={null}><Precompile /><Model url={local.file} height={local.height} view={local.view} lift={local.lift} dim={local.dim} onReady={() => setTimeout(() => setShown(true), 120)} /></Suspense>
      {!local.fade && <mesh rotation-x={-Math.PI / 2} position-y={-0.9} receiveShadow><circleGeometry args={[1.1, 48]} /><shadowMaterial transparent opacity={0.35} /></mesh>}
      <SlowmoFX ca={caRef} noise={noiseRef} vig={vigRef} />
      <EffectComposer multisampling={4}>
        <N8AO aoRadius={0.3} intensity={0.9} distanceFalloff={0.6} quality="performance" />
        <ChromaticAberration ref={caRef} offset={CA_OFFSET} radialModulation modulationOffset={0.35} />
        <Noise ref={noiseRef} premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.2} />
        <Vignette ref={vigRef} eskil={false} offset={0.3} darkness={0.4} />
      </EffectComposer>
    </Canvas>
    </div>
  );
}

function Card({ local, compact = false, hero = false }: { local: Local; compact?: boolean; hero?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);
  // the map comes first: the 3D portraits warm up once it is on screen (or as soon as the section nears the viewport)
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    // start the portraits two frames after the map has painted (never on top of its first frames); 1.5 s safety
    let done = false; const go = () => { if (!done) { done = true; setWarm(true); } };
    if ((window as unknown as { __mapReady?: boolean }).__mapReady || !document.querySelector("#map")) setTimeout(go, 60);
    addEventListener("clip:map-ready", go, { once: true });
    const t = setTimeout(go, 1500);
    return () => { removeEventListener("clip:map-ready", go); clearTimeout(t); };
  }, []);
  useEffect(() => { fetch(local.file, { method: "HEAD", cache: "no-store" }).then((r) => setExists(r.ok)).catch(() => setExists(false)); }, [local.file]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setVisible(true); }, { rootMargin: "900px", threshold: 0 });
    const t = setTimeout(() => { const r = el.getBoundingClientRect(); if (r.bottom > -300 && r.top < innerHeight + 300) setVisible(true); }, 800);
    io.observe(el); return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  return (
    <div ref={ref} className={compact ? "relative min-h-0 flex-1 overflow-hidden rounded-[14px] border border-white/10" : hero ? "relative h-full overflow-hidden rounded-[22px] border border-white/10" : "glass overflow-hidden"}>
      <div className={compact || hero ? "absolute inset-0 overflow-hidden" : "relative aspect-[4/5] overflow-hidden"}>
        {local.bg
          ? <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${local.bg.replace(/\.jpg$/, "-bokeh.jpg")})` }} aria-hidden="true" />
          : <PalmBackdrop />}
        {exists !== false && (compact ? warm : visible || warm) && <Viewer local={local} active={visible} />}
        {local.fade && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]" style={{ background: "linear-gradient(to bottom, transparent, rgba(13,7,32,.92) 70%, #0d0720)" }} aria-hidden="true" />}
      </div>
      {hero ? null : compact ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
          <p className="label !text-[10px] text-sun">${local.ticker} · {local.role}</p>
          <h3 className="font-sign text-[30px] uppercase leading-none">{local.name}</h3>
        </div>
      ) : (
      <div className="p-[18px]">
        <p className="label text-sun">${local.ticker} · {local.role}</p>
        <h3 className="sec-title mt-1 !text-[42px]">{local.name}</h3>
        <p className="mt-2 leading-[1.55] text-haze">{local.bio}</p>
        {local.credit !== "getclip.fun" && <p className="mt-3 text-[11px] text-haze/70">3D model: <a href={local.creditUrl} target="_blank" rel="noopener noreferrer" className="underline">{local.credit}</a> (CC BY 4.0)</p>}
      </div>
      )}
    </div>
  );
}

export function Locals3D({ compact = false, only }: { compact?: boolean; only?: string }) {
  if (only) { const l = LOCALS.find((x) => x.id === only); return l ? <Card local={l} hero /> : null; }
  if (compact) return (
    <div className="flex h-full flex-col gap-2.5">
      {LOCALS.map((l) => <Link key={l.id} href={`/locals/${l.id}`} className="local-link relative flex min-h-0 flex-1" aria-label={`${l.name}: profile`}><Card local={l} compact /></Link>)}
    </div>
  );
  return (
    <div className="mx-auto grid max-w-[760px] gap-[18px] md:grid-cols-2">
      {LOCALS.map((l) => <Link key={l.id} href={`/locals/${l.id}`} className="local-link block" aria-label={`${l.name}: profile`}><Card local={l} /></Link>)}
    </div>
  );
}
