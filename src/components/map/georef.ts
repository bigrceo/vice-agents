/**
 * Game ↔ real Miami. gtadb.org pairs 1 134 landmarks with both their in-game coordinates and their real-world lat/lon
 * (CC BY 4.0). Vice City is a non-uniform compression of Miami, so a global affine fit is 700 m off: instead each point is
 * mapped with a local affine fitted on its nearest landmarks (inverse-distance weighted least squares).
 */
import pairs from "../../../public/map/georef.json";

const P = pairs as [number, number, number, number][]; // gameX, gameY, lat, lon
const X0 = 21, Y0 = 21, NX = 58, NY = 79;             // island crop of the Yanis V17 tiles
export const ORIGIN = { lat: 25.7782, lon: -80.196 };  // downtown Vice City ≈ downtown Miami
export const WU_PER_M = 1 / 1000;                       // 1 world unit = 1 km in the photoreal scene
const DEG = Math.PI / 180;

/** Map image u/v → game coordinates (gtadb tile projection). */
export function uvToGame(u: number, v: number): [number, number] {
  return [(u * NX + X0) * 256 - 16384, 16384 - (v * NY + Y0) * 256];
}
export function gameToUv(x: number, y: number): [number, number] {
  return [((x + 16384) / 256 - X0) / NX, ((16384 - y) / 256 - Y0) / NY];
}

/** Local affine from the K nearest landmark pairs. */
export function gameToLatLon(x: number, y: number, K = 14): [number, number] {
  const near = P.map((p) => ({ p, d: Math.hypot(p[0] - x, p[1] - y) })).sort((a, b) => a.d - b.d).slice(0, K);
  // weighted least squares for lat = a x + b y + c, lon = d x + e y + f
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0, slat = 0, slon = 0, sxlat = 0, sylat = 0, sxlon = 0, sylon = 0;
  for (const { p, d } of near) {
    const w = 1 / (d * d + 2500);
    sw += w; sx += w * p[0]; sy += w * p[1]; sxx += w * p[0] * p[0]; sxy += w * p[0] * p[1]; syy += w * p[1] * p[1];
    slat += w * p[2]; slon += w * p[3]; sxlat += w * p[0] * p[2]; sylat += w * p[1] * p[2]; sxlon += w * p[0] * p[3]; sylon += w * p[1] * p[3];
  }
  // solve 3x3 normal equations for each output
  const M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, sw]];
  const solve = (r: number[]) => {
    const [[a, b, c], [d, e, f], [g, h, i]] = M;
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (Math.abs(det) < 1e-12) return null;
    const inv = [
      [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
      [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
      [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
    ];
    return inv.map((row) => row[0] * r[0] + row[1] * r[1] + row[2] * r[2]);
  };
  const A = solve([sxlat, sylat, slat]), B = solve([sxlon, sylon, slon]);
  if (!A || !B) { const n = near[0].p; return [n[2], n[3]]; }
  return [A[0] * x + A[1] * y + A[2], B[0] * x + B[1] * y + B[2]];
}

/** lat/lon → scene position (east/north in world units, Y up, from ORIGIN). */
export function latLonToWorld(lat: number, lon: number): [number, number, number] {
  const east = (lon - ORIGIN.lon) * DEG * 6378137 * Math.cos(ORIGIN.lat * DEG);
  const north = (lat - ORIGIN.lat) * DEG * 6356752;
  return [east * WU_PER_M, 0, -north * WU_PER_M];
}
export function uvToWorldMiami(u: number, v: number): [number, number, number] {
  const [x, y] = uvToGame(u, v); const [lat, lon] = gameToLatLon(x, y); return latLonToWorld(lat, lon);
}
