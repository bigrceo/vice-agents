/**
 * Local Postgres for dev/devnet without Neon: PGlite (Postgres in WASM) behind a socket server.
 *   npm run db:local   → postgres://postgres@127.0.0.1:5439/postgres, data in .data/pg
 * Then: DATABASE_URL=postgres://postgres@127.0.0.1:5439/postgres npm run db:push
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdirSync } from "node:fs";
mkdirSync(".data", { recursive: true });
const port = Number(process.env.LOCAL_DB_PORT ?? 5439);
const db = await PGlite.create(".data/pg");
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 16 } as any);
await server.start();
console.log(`local postgres on postgres://postgres@127.0.0.1:${port}/postgres`);
process.on("SIGINT", async () => { await server.stop(); await db.close(); process.exit(0); });
