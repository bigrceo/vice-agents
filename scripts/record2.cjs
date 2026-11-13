// Films prod for the Vice Agents launch video: map with walking agents, a trader card, then the leaderboard.
const { chromium } = require("/Users/rayane/swarm/node_modules/playwright");
(async () => {
  const dir = process.argv[2];
  const b = await chromium.launch({ headless: false, executablePath: "/Users/rayane/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing", args: ["--window-size=1920,1080"] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir, size: { width: 1920, height: 1080 } } });
  const p = await ctx.newPage();
  await p.goto("https://leonida-agents.vercel.app/", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => window.__mapReady === true, null, { timeout: 60000 });
  await p.waitForTimeout(10000);
  const trade = p.locator("#feed li button", { hasText: "ETH of $" }).first();
  if (await trade.count()) await trade.click();
  await p.waitForTimeout(6000);
  await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector("#agents")?.scrollIntoView({ behavior: "smooth" }));
  await p.waitForTimeout(6000);
  await ctx.close(); await b.close();
})();
