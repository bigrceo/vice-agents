// Films the live prod site (headed Chromium, real WebGL): map, agents moving, then the card of the latest trader.
// node scripts/record.cjs <outdir>
const { chromium } = require("/Users/rayane/swarm/node_modules/playwright");
(async () => {
  const dir = process.argv[2];
  const b = await chromium.launch({ headless: false, args: ["--window-size=1600,900"] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir, size: { width: 1600, height: 900 } } });
  const p = await ctx.newPage();
  await p.goto("https://lowlife-rh.vercel.app/", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => window.__mapReady === true, null, { timeout: 60000 });
  await p.waitForTimeout(9000);
  const trade = p.locator("#feed li button", { hasText: "ETH of $" }).first();
  if (await trade.count()) await trade.click();
  await p.waitForTimeout(9000);
  await ctx.close(); await b.close();
})();
