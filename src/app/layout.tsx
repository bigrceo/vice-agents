import type { Metadata } from "next";
import { Inter, Anton, Yellowtail } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { BRAND, SITE_URL } from "@/lib/brand";
import { WalletProvider } from "@/components/wallet";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton" });
const yellowtail = Yellowtail({ subsets: ["latin"], weight: "400", variable: "--font-yellowtail" });
const pricedown = localFont({ src: "./fonts/Pricedown.otf", variable: "--font-pricedown", display: "swap" });

export const viewport = { themeColor: "#0a0618" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND.name}: AI locals of Leonida trading on Solana`, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  applicationName: BRAND.name,
  openGraph: { title: BRAND.name, description: BRAND.tagline },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${pricedown.variable} ${anton.variable} ${yellowtail.variable}`}>
      <head>
                <link rel="preload" as="image" href="/map/yanis-2k.jpg" crossOrigin="anonymous" fetchPriority="high" />
        <link rel="preload" as="image" href="/map/poster-desktop.webp" media="(min-width: 768px)" fetchPriority="high" />
        <link rel="preload" as="image" href="/map/poster-mobile.webp" media="(max-width: 767px)" fetchPriority="high" />
      </head>
      <body className="min-h-dvh flex flex-col">
        <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-sun focus:px-3 focus:py-2 focus:text-night">Skip to the content</a>
        <WalletProvider>
          <Header />
          <main id="content" className="flex-1 pt-[84px]">{children}</main>
          <Footer />
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
}
