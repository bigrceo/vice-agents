import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Neon (serverless http) for *.neon.tech URLs; any other postgres:// URL (local Postgres / `npm run db:local`) via postgres-js. */
export const isNeonUrl = (url: string) => /\.neon\.tech/.test(url);

type DB = ReturnType<typeof drizzleNeon<typeof schema>>;
let _db: DB | null | undefined;
/** null when DATABASE_URL is unset: the site then runs on demo data. */
export function db(): DB | null {
  if (_db !== undefined) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) return (_db = null);
  _db = isNeonUrl(url)
    ? drizzleNeon(neon(url), { schema })
    : (drizzlePg(postgres(url, { max: 1, prepare: false }), { schema }) as unknown as DB);
  return _db;
}

/** Tagged-template SQL client for scripts (grinder, indexer). Both drivers return an array of rows. */
export function sqlClient(url = process.env.DATABASE_URL!): (s: TemplateStringsArray, ...v: any[]) => Promise<any[]> {
  if (isNeonUrl(url)) return neon(url) as any;
  // one pool per URL for the whole process: a new pool per request leaks connections (and kills the local PGlite socket)
  const g = globalThis as any; g.__pg ??= new Map();
  const pg: ReturnType<typeof postgres> = g.__pg.get(url) ?? postgres(url, { max: 3, prepare: false }); g.__pg.set(url, pg);
  return ((s: TemplateStringsArray, ...v: any[]) => pg(s, ...v).then((r: any) => [...r])) as any;
}
export { schema };
