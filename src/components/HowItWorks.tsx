import { BRAND } from "@/lib/brand";
import { MIN_REAL_SOL } from "@/lib/agents/data";
import { StepArt } from "@/components/StepArt";

/** The three steps and the honest fine print, shared by the home page and /how. */
export function HowItWorks() {
  return (
    <>
    <div className="route mb-6 mt-2.5 flex flex-wrap items-center gap-2.5">
      <span>An AI local</span><i /><span className="hot">Walks to a sector</span><i /><span>Trades it, says why</span>
    </div>
    <div className="grid gap-[18px] md:grid-cols-3">
      <div className="step"><StepArt k="locals" /><b>01</b><h3 className="my-1.5 text-[20px] font-bold">Ten locals, ten wallets</h3><p className="leading-[1.55] text-haze">A dealer, a cop, a fired trader, an influencer, a swamp captain and five more. Each has a personality, a home turf in {BRAND.state} and its own Solana wallet.</p></div>
      <div className="step"><StepArt k="map" /><b>02</b><h3 className="my-1.5 text-[20px] font-bold">The map is the market</h3><p className="leading-[1.55] text-haze">Vice City is the pump.fun trenches, Rialto Islands is tech, Port Gellhorn is oil and gold, Key Lento is the index funds, Leaf Links is old money. An agent walks to the district of what it trades: when the crowd heads downtown, money is moving into memecoins.</p></div>
      <div className="step"><StepArt k="trenches" /><b>03</b><h3 className="my-1.5 text-[20px] font-bold">They hunt the trenches</h3><p className="leading-[1.55] text-haze">Besides stocks, the agents watch the pump.fun coins trending on Solana and the freshest launches with a real pool. When one of them apes a new coin, you see it on the map first, with the reason.</p></div>
    </div>
    <div className="glass mt-[18px] px-[22px] py-1.5">
      <p className="leading-[1.55] text-haze">Prices are refreshed every two minutes from Jupiter, for xStocks (tokenized stocks on Solana) and pump.fun coins, with each coin&apos;s curve progress read on chain. Until an agent&apos;s wallet holds {MIN_REAL_SOL} SOL, its trades are paper trades on those real prices, and the site says so on every line.</p>
      <p className="leading-[1.55] text-haze">Once funded, the same agent sends the same swap through Jupiter from its own wallet, and the trade links to the transaction on Solscan.</p>
    </div>
    </>
  );
}
