/**
 * Procedural facade textures, one style per archetype: colour map (wall is near-white so the instance colour tints it),
 * emissive map (lit windows at night) and a normal map embossed from the window insets. Each texture tiles vertically every
 * 4 floors; the shader scales UVs by the instance size so floors stay 3.4 m tall whatever the building height.
 */
import * as THREE from "three";

export type Facade = { map: THREE.Texture; emissive: THREE.Texture; normal: THREE.Texture };
const W = 256, H = 512, FLOORS = 4;

function make(draw: (g: CanvasRenderingContext2D, height: CanvasRenderingContext2D, em: CanvasRenderingContext2D) => void): Facade {
  const c = document.createElement("canvas"), h = document.createElement("canvas"), e = document.createElement("canvas");
  c.width = h.width = e.width = W; c.height = h.height = e.height = H;
  const g = c.getContext("2d")!, hg = h.getContext("2d")!, eg = e.getContext("2d")!;
  g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, W, H);
  hg.fillStyle = "#808080"; hg.fillRect(0, 0, W, H);
  eg.fillStyle = "#000"; eg.fillRect(0, 0, W, H);
  draw(g, hg, eg);
  // normal from height (Sobel)
  const hd = hg.getImageData(0, 0, W, H).data, n = document.createElement("canvas"); n.width = W; n.height = H;
  const ng = n.getContext("2d")!, out = ng.createImageData(W, H);
  const at = (x: number, y: number) => hd[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
    const l = Math.hypot(dx, dy, 1); const i = (y * W + x) * 4;
    out.data[i] = ((-dx / l) * 0.5 + 0.5) * 255; out.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l) * 0.5 * 255 + 127; out.data[i + 3] = 255;
  }
  ng.putImageData(out, 0, 0);
  const tex = (cv: HTMLCanvasElement, srgb: boolean) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: tex(c, true), emissive: tex(e, true), normal: tex(n, false) };
}

/** Window helper: glass with frame, inset in the height map, randomly lit in the emissive map. */
function win(g: CanvasRenderingContext2D, hg: CanvasRenderingContext2D, eg: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, glass = "#3b4a63", lit = 0.45) {
  g.fillStyle = "#dedede"; g.fillRect(x - 2, y - 2, w + 4, h + 4);
  const grd = g.createLinearGradient(x, y, x + w, y + h); grd.addColorStop(0, glass); grd.addColorStop(0.5, "#6f85a8"); grd.addColorStop(1, glass);
  g.fillStyle = grd; g.fillRect(x, y, w, h);
  g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x + 2, y + 2, w * 0.35, h * 0.3);
  hg.fillStyle = "#3a3a3a"; hg.fillRect(x, y, w, h);
  if (Math.random() < lit) { eg.fillStyle = Math.random() < 0.8 ? "#ffd27a" : "#bfe9ff"; eg.fillRect(x + 1, y + 1, w - 2, h - 2); }
}

export function buildFacades(): Facade[] {
  const fh = H / FLOORS; // 128 px per floor
  return [
    // 0 house: siding + a few windows + door, 2 floors drawn twice
    make((g, hg, eg) => {
      for (let y = 0; y < H; y += 8) { g.fillStyle = y % 16 ? "#e9e4da" : "#f4f0e8"; g.fillRect(0, y, W, 8); hg.fillStyle = y % 16 ? "#7a7a7a" : "#868686"; hg.fillRect(0, y, W, 8); }
      for (let f = 0; f < FLOORS; f++) { const y = f * fh + 30; win(g, hg, eg, 40, y, 44, 60, "#4a6a8a", 0.35); win(g, hg, eg, 172, y, 44, 60, "#4a6a8a", 0.35); if (f % 2 === 1) { g.fillStyle = "#6b4a2b"; g.fillRect(112, y + 10, 34, 70); hg.fillStyle = "#5a5a5a"; hg.fillRect(112, y + 10, 34, 70); } }
    }),
    // 1 mid-rise: balconies + windows
    make((g, hg, eg) => {
      for (let f = 0; f < FLOORS; f++) {
        const y = f * fh;
        for (let i = 0; i < 4; i++) win(g, hg, eg, 14 + i * 62, y + 22, 40, 56, "#35506e", 0.5);
        g.fillStyle = "#cfcfcf"; g.fillRect(0, y + 88, W, 10); hg.fillStyle = "#c0c0c0"; hg.fillRect(0, y + 84, W, 14); // balcony slab
        g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, y + 98, W, 8);
        for (let x = 6; x < W; x += 12) { g.fillStyle = "#b9b9b9"; g.fillRect(x, y + 60, 2, 28); } // railing
      }
    }),
    // 2 tower: curtain wall glass grid
    make((g, hg, eg) => {
      g.fillStyle = "#9fb7cf"; g.fillRect(0, 0, W, H);
      for (let f = 0; f < FLOORS; f++) for (let i = 0; i < 6; i++) { const x = i * 42 + 4, y = f * fh + 6; win(g, hg, eg, x, y, 36, fh - 14, "#2f4b6e", 0.55); }
      for (let x = 0; x < W; x += 42) { g.fillStyle = "#e4ecf4"; g.fillRect(x, 0, 4, H); hg.fillStyle = "#9a9a9a"; hg.fillRect(x, 0, 4, H); }
      for (let f = 0; f <= FLOORS; f++) { g.fillStyle = "#d8e2ec"; g.fillRect(0, f * fh - 3, W, 6); hg.fillStyle = "#9a9a9a"; hg.fillRect(0, f * fh - 3, W, 6); }
    }),
    // 3 art deco: vertical pilasters, tall windows, horizontal bands
    make((g, hg, eg) => {
      g.fillStyle = "#f6efe4"; g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 64) { g.fillStyle = "#ffffff"; g.fillRect(x, 0, 12, H); hg.fillStyle = "#a0a0a0"; hg.fillRect(x, 0, 12, H); g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(x + 12, 0, 4, H); }
      for (let f = 0; f < FLOORS; f++) { const y = f * fh; for (let i = 0; i < 4; i++) win(g, hg, eg, i * 64 + 22, y + 18, 30, 80, "#2d4a6a", 0.4); g.fillStyle = "#e3d6c3"; g.fillRect(0, y + 108, W, 12); hg.fillStyle = "#909090"; hg.fillRect(0, y + 108, W, 12); }
    }),
    // 4 shed: corrugated metal + big door + skylights
    make((g, hg, eg) => {
      for (let x = 0; x < W; x += 6) { g.fillStyle = x % 12 ? "#d9dde2" : "#eef1f4"; g.fillRect(x, 0, 6, H); hg.fillStyle = x % 12 ? "#707070" : "#8e8e8e"; hg.fillRect(x, 0, 6, H); }
      for (let f = 0; f < FLOORS; f++) { const y = f * fh; g.fillStyle = "#6c7480"; g.fillRect(70, y + 50, 110, 76); hg.fillStyle = "#5a5a5a"; hg.fillRect(70, y + 50, 110, 76); win(g, hg, eg, 20, y + 16, 34, 20, "#4b5b6e", 0.25); win(g, hg, eg, 200, y + 16, 34, 20, "#4b5b6e", 0.25); }
    }),
  ];
}
export const FLOOR_METERS = 3.4;
export const TILE_FLOORS = FLOORS;
