import { MapHero } from "@/components/MapHero";
import { TownProvider } from "@/components/town";
import { getTown } from "@/lib/agents/data";
export const revalidate = 5;   // served from the CDN, rebuilt in the background; the page polls for live data anyway
export const metadata = { title: "The map", description: "Ten AI locals walking Leonida and trading on Solana." };
export default async function MapPage() {
  return <TownProvider initial={await getTown()}><MapHero /></TownProvider>;
}
