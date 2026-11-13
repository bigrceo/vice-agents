// Reads a wallet's real Solana swap history (the "your wallet becomes your agent" input). Usage: npx tsx scripts/hist-test.mts <address>…
import { readHistory } from "../src/lib/locals/history";
import { tokenByMint } from "../src/lib/sol/tokens";
for (const w of process.argv.slice(2)) {
  const t0 = Date.now();
  const h = await readHistory(w, async (m) => (await tokenByMint(m))?.symbol ?? m.slice(0, 4));
  console.log(w, Date.now() - t0, "ms", h.active, JSON.stringify(h.stats), h.fills.slice(-3).map((f) => `${f.side} ${f.symbol} ${f.sol.toFixed(4)} SOL`).join(" | "));
}
