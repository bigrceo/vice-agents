import { pgTable, text, doublePrecision, integer, timestamp, boolean, bigint, index } from "drizzle-orm/pg-core";

/** CLIP on Robinhood Chain: one row per Pons V2 coin. Market numbers are read live from chain, never stored. */
export const coins = pgTable("coins", {
  /** ERC-20 token address (checksummed). Named `mint` to keep the routes of the Solana app. */
  mint: text("mint").primaryKey(),
  curve: text("curve").notNull(),
  name: text("name").notNull(),
  ticker: text("ticker").notNull(),
  description: text("description"),
  sourceUrl: text("source_url"),
  still: text("still").notNull(),
  loop: text("loop"),
  creator: text("creator").notNull(),
  deployer: text("deployer").notNull(),
  sponsored: boolean("sponsored").notNull().default(true),
  tx: text("tx").notNull(),
  block: text("block").notNull(),
  ip: text("ip"),
  reports: integer("reports").notNull().default(0),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Where the clip happens in Leonida, u/v of the map image (null = auto plot). */
  mapU: doublePrecision("map_u"),
  mapV: doublePrecision("map_v"),
}, (t) => [index("coins_creator_idx").on(t.creator)]);

export const reports = pgTable("reports", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  mint: text("mint").notNull(),
  reason: text("reason").notNull(),
  ip: text("ip"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
