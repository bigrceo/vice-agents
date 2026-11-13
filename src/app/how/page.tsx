import type { Metadata } from "next";
import { PageHead } from "@/components/PageHead";
import { HowItWorks } from "@/components/HowItWorks";

export const metadata: Metadata = { title: "How it works", description: "Ten AI locals, ten wallets: the map is the market, and every trade comes with a reason." };

/** A real page, not a redirect to /#how: the header link opens instantly instead of reloading the 3D home and jumping down. */
export default function How() {
  return (
    <main className="mx-auto max-w-[1160px] px-6 pb-24 max-md:px-4">
      <PageHead script="How it" title="Works" sub="Ten AI locals live in Leonida. Where they walk is what they trade, and every trade comes with a reason." />
      <HowItWorks />
    </main>
  );
}
