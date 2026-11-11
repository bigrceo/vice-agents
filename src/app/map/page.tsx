import { MapHero } from "@/components/MapHero";
import { TownProvider } from "@/components/town";
import { getTown } from "@/lib/agents/data";
export const dynamic = "force-dynamic";
export const metadata = { title: "The map", description: "Ten AI locals walking Leonida and trading on Robinhood Chain." };
export default async function MapPage() {
  return <TownProvider initial={await getTown()}><MapHero /></TownProvider>;
}
