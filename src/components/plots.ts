/** Plots on the Leonida map: plain data, no 3D, so pages can use it without loading three.js. */
import type { Coin } from "@/lib/types";
import { districtOf } from "./map/districts";

export type Plot = { id: string; district: string; u: number; v: number };
export const PLOTS: Plot[] = [
  { id: "hq", district: "Vice City", u: 0.676, v: 0.552 },
  { id: "vic-0", district: "Vice City", u: 0.665, v: 0.538 },
  { id: "vic-1", district: "Vice City", u: 0.685, v: 0.535 },
  { id: "vic-2", district: "Vice City", u: 0.678, v: 0.547 },
  { id: "vic-3", district: "Vice City", u: 0.649, v: 0.552 },
  { id: "vic-0-2", district: "Vice Beach", u: 0.825, v: 0.484 },
  { id: "vic-1-2", district: "Vice Beach", u: 0.827, v: 0.471 },
  { id: "vic-2-2", district: "Vice Beach", u: 0.848, v: 0.5 },
  { id: "vic-3-2", district: "Vice Beach", u: 0.83, v: 0.476 },
  { id: "por-0", district: "Port Gellhorn", u: 0.305, v: 0.382 },
  { id: "por-1", district: "Port Gellhorn", u: 0.302, v: 0.36 },
  { id: "por-2", district: "Port Gellhorn", u: 0.326, v: 0.346 },
  { id: "por-3", district: "Port Gellhorn", u: 0.319, v: 0.356 },
  { id: "key-0", district: "Key Lento", u: 0.549, v: 0.823 },
  { id: "key-1", district: "Key Lento", u: 0.559, v: 0.851 },
  { id: "key-2", district: "Key Lento", u: 0.551, v: 0.841 },
  { id: "key-3", district: "Key Lento", u: 0.578, v: 0.833 },
  { id: "ham-0", district: "Hamlet", u: 0.562, v: 0.687 },
  { id: "ham-1", district: "Hamlet", u: 0.533, v: 0.692 },
  { id: "amb-0", district: "Ambrosia", u: 0.565, v: 0.346 },
  { id: "amb-1", district: "Ambrosia", u: 0.543, v: 0.352 },
  { id: "amb-2", district: "Ambrosia", u: 0.551, v: 0.341 },
  { id: "amb-3", district: "Ambrosia", u: 0.572, v: 0.357 },
  { id: "mar-0", district: "Mariana County", u: 0.416, v: 0.804 },
  { id: "mar-1", district: "Mariana County", u: 0.433, v: 0.816 },
  { id: "ria-0", district: "Rialto Islands", u: 0.79, v: 0.474 },
  { id: "ria-1", district: "Rialto Islands", u: 0.805, v: 0.467 },
  { id: "cap-0", district: "Capri", u: 0.293, v: 0.557 },
  { id: "cap-1", district: "Capri", u: 0.277, v: 0.547 },
  { id: "wat-0", district: "Watson Bay", u: 0.377, v: 0.717 },
  { id: "wat-1", district: "Watson Bay", u: 0.421, v: 0.713 },
  { id: "kel-0", district: "Kelly County", u: 0.414, v: 0.369 },
  { id: "kel-1", district: "Kelly County", u: 0.403, v: 0.38 },
  { id: "dal-0", district: "Dalton Island", u: 0.863, v: 0.609 },
  { id: "dal-1", district: "Dalton Island", u: 0.878, v: 0.629 },
  { id: "vc -0", district: "VC Intl Airport", u: 0.569, v: 0.582 },
  { id: "vc -1", district: "VC Intl Airport", u: 0.545, v: 0.583 },
  { id: "wan-0", district: "Waning Sands", u: 0.735, v: 0.359 },
  { id: "wan-1", district: "Waning Sands", u: 0.745, v: 0.33 },
  { id: "lum-0", district: "Lummox County", u: 0.472, v: 0.191 },
  { id: "lum-1", district: "Lummox County", u: 0.45, v: 0.182 },
  { id: "lum-2", district: "Lummox County", u: 0.459, v: 0.169 },
  { id: "lum-3", district: "Lummox County", u: 0.453, v: 0.195 },
  { id: "por-0-2", district: "Port Vice City", u: 0.77, v: 0.559 },
  { id: "por-1-2", district: "Port Vice City", u: 0.785, v: 0.584 },
  { id: "glo-0", district: "Gloriana Key", u: 0.761, v: 0.628 },
  { id: "glo-1", district: "Gloriana Key", u: 0.789, v: 0.645 },
  { id: "cat-0", district: "Catalan Key", u: 0.74, v: 0.665 },
  { id: "cat-1", district: "Catalan Key", u: 0.708, v: 0.647 },
  { id: "lea-0", district: "Leaf Links", u: 0.755, v: 0.44 },
  { id: "lea-1", district: "Leaf Links", u: 0.79, v: 0.411 },
];
export function plotFor(c: Coin, i: number): Plot {
  if (c.mapU != null && c.mapV != null) return { id: `drop:${c.mint}`, district: districtOf(c.mapU, c.mapV), u: c.mapU, v: c.mapV };
  if (c.official) return PLOTS[0];
  let h = 0; for (const ch of c.mint) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const free = PLOTS.slice(1);
  return free[(h + i) % free.length];
}
