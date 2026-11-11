/** Leonida areas on the Yanis V17 map (island crop: tiles x 21..78, y 21..99), centres averaged from the gtadb.org landmark database. */
export const DISTRICTS: { name: string; sub: string; u: number; v: number; big?: boolean }[] = [
  { name: "Vice City", sub: "downtown", u: 0.676, v: 0.552, big: true },
  { name: "Vice Beach", sub: "ocean drive", u: 0.853, v: 0.487, big: true },
  { name: "Port Gellhorn", sub: "west coast", u: 0.297, v: 0.364, big: true },
  { name: "Key Lento", sub: "the keys", u: 0.57, v: 0.838, big: true },
  { name: "Hamlet", sub: "south of the city", u: 0.559, v: 0.704 },
  { name: "Ambrosia", sub: "sugar country", u: 0.554, v: 0.349, big: true },
  { name: "Mariana County", sub: "the keys", u: 0.431, v: 0.801 },
  { name: "Rialto Islands", sub: "the bay", u: 0.776, v: 0.482 },
  { name: "Capri", sub: "west coast", u: 0.298, v: 0.547 },
  { name: "Watson Bay", sub: "south west", u: 0.405, v: 0.71 },
  { name: "Kelly County", sub: "north west", u: 0.391, v: 0.376 },
  { name: "Dalton Island", sub: "south beach", u: 0.858, v: 0.611 },
  { name: "VC Intl Airport", sub: "airport", u: 0.571, v: 0.575 },
  { name: "Waning Sands", sub: "north beach", u: 0.726, v: 0.339 },
  { name: "Lummox County", sub: "mount kalaga", u: 0.479, v: 0.184, big: true },
  { name: "Port Vice City", sub: "cruise port", u: 0.792, v: 0.569 },
  { name: "Gloriana Key", sub: "the keys", u: 0.786, v: 0.63 },
  { name: "Catalan Key", sub: "the keys", u: 0.721, v: 0.65 },
  { name: "Leaf Links", sub: "golf", u: 0.763, v: 0.425 },
];
export function districtOf(u: number, v: number) {
  let best = DISTRICTS[0], bd = Infinity;
  for (const d of DISTRICTS) { const dd = (d.u - u) ** 2 + ((d.v - v) * 1.36) ** 2; if (dd < bd) { bd = dd; best = d; } }
  return best.name;
}
