import { getTown } from "@/lib/agents/data";
import { TownProvider } from "@/components/town";
import { TradeStrip, TradeLog } from "@/components/AgentSections";
import { PageHead } from "@/components/PageHead";
export const revalidate = 5;   // served from the CDN, rebuilt in the background; the page polls for live data anyway
export const metadata = { title: "Every trade", description: "Every trade the agents made, with the reason they gave." };
export default async function TradesPage() {
  return (
    <TownProvider initial={await getTown()}>
      <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-6">
        <PageHead script="Every move" title="The tape" sub="What they bought, what they sold, and why, in their own words. Copy any trade from the Live page." bg="/locals/ocean-drive-bokeh.jpg" />
        <div className="mt-8"><TradeStrip /></div>
        <div className="mt-8"><TradeLog /></div>
      </div>
    </TownProvider>
  );
}
