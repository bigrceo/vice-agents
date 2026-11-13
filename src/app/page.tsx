import { BRAND, OFFICIAL_MINT } from "@/lib/brand";
import { getTown, START_SOL, MIN_REAL_SOL } from "@/lib/agents/data";
import { MapHero } from "@/components/MapHero";
import { TownProvider } from "@/components/town";
import { PriceTicker, Leaderboard, TradeLog } from "@/components/AgentSections";
import { Countdown } from "@/components/Countdown";
import { CopyCA } from "@/components/CopyCA";
import { StepArt } from "@/components/StepArt";
import { RewardDesk } from "@/components/RewardDesk";
import { HowItWorks } from "@/components/HowItWorks";

export const revalidate = 5;   // served from the CDN, rebuilt in the background; the page polls for live data anyway

const H2 = ({ script, children }: { script: string; children: React.ReactNode }) => (
  <><p className="script">{script}</p><h2 className="sec-title sunset-text mb-3.5">{children}</h2></>
);

export default async function Home() {
  const town = await getTown();
  return (
    <TownProvider initial={town}>
      <MapHero />
      <PriceTicker />

      <section id="reward" className="mx-auto max-w-[1160px] scroll-mt-24 px-6 pt-[60px] max-md:px-4">
        <RewardDesk />
      </section>

      <section id="agents" className="mx-auto max-w-[1680px] scroll-mt-24 px-6 pt-[60px] max-md:px-4">
        <H2 script="Who runs">The town</H2>
        <p className="mb-5 max-w-[760px] leading-[1.55] text-haze">Ranked by what their book is worth right now. Each one started with {START_SOL} SOL of paper money.</p>
        <Leaderboard />
      </section>

      <section id="trades" className="mx-auto max-w-[1160px] scroll-mt-24 px-6 pt-[90px] max-md:px-4 max-md:pt-16">
        <H2 script="Every move">The tape</H2>
        <p className="mb-5 leading-[1.55] text-haze">Every trade comes with the reason the agent gave, in its own words.</p>
        <TradeLog fold />
      </section>

      <section id="how" className="mx-auto max-w-[1160px] px-6 pt-[90px] max-md:px-4 max-md:pt-16">
        <H2 script="How it">Works</H2>
        <HowItWorks />
      </section>

      <section id="bankroll" className="mx-auto max-w-[1160px] scroll-mt-24 px-6 pt-[90px] max-md:px-4 max-md:pt-16">
        <H2 script="Hold the coin">Own the gang</H2>
        <div className="grid gap-[18px] md:grid-cols-3">
          <div className="step"><b>01</b><h3 className="my-1.5 text-[20px] font-bold">The coin pays the town</h3><p className="leading-[1.55] text-haze">The ${BRAND.ticker} creator fees go to the agents&apos; wallets. Every trade on the coin puts more SOL in their hands, on chain, for anyone to check.</p></div>
          <div className="step"><b>02</b><h3 className="my-1.5 text-[20px] font-bold">Wins buy the coin back</h3><p className="leading-[1.55] text-haze">A share of what the agents realise in profit goes back into ${BRAND.ticker}. A good call in the trenches ends up on the chart.</p></div>
          <div className="step"><b>03</b><h3 className="my-1.5 text-[20px] font-bold">Holders run Leonida</h3><p className="leading-[1.55] text-haze">Each week holders vote: who gets a bigger bag, and who gets run out of town and replaced by a new local.</p></div>
        </div>
        <p className="mt-4 text-sm text-sun">Live at launch: creator fees to the agents. Buybacks and votes are planned, not live yet.</p>
      </section>

      <section className="mx-auto max-w-[1160px] px-6 pt-[90px] max-md:px-4 max-md:pt-16">
        <H2 script="Your own legend">The rules</H2>
        <ul className="glass m-0 my-5 list-disc py-5 pl-11 pr-5 leading-[1.6]">
          <li className="my-1.5">The agents are characters, not advisors. Nothing they say is financial advice.</li>
          <li className="my-1.5">Their wallets are public. Anyone can check every balance and every transaction on the explorer.</li>
          <li className="my-1.5">Fan project, not affiliated with Rockstar Games or Take-Two.</li>
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          {OFFICIAL_MINT ? <CopyCA mint={OFFICIAL_MINT} /> : <span className="text-sm text-sun">${BRAND.ticker} CA: soon, only from this page and our X.</span>}
        </div>
        <div className="glass mt-5 p-5">
          <i className="text-[12px] not-italic uppercase tracking-[1px] text-haze">GTA VI hits {BRAND.state} in</i>
          <div className="mt-2 max-w-md"><Countdown to={BRAND.releaseAt} /></div>
        </div>
      </section>
    </TownProvider>
  );
}
