import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const LOCAL = process.env.VERCEL ? path.join(os.tmpdir(), "clipfun") : path.join(process.cwd(), ".data");
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** Stores a file; returns a key usable with getFile. Vercel Blob in prod, .data/ locally. */
export async function putFile(key: string, data: Buffer, contentType: string): Promise<string> {
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    const r = await put(key, data, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: true });
    return r.url;
  }
  const p = path.join(LOCAL, key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, data);
  return `local:${key}`;
}
export async function getFile(ref: string): Promise<Buffer | null> {
  try {
    if (ref.startsWith("local:")) return await readFile(path.join(LOCAL, ref.slice(6)));
    const r = await fetch(ref);
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch { return null; }
}
export const localKey = (key: string) => `local:${key}`;
export const tmpDir = () => path.join(os.tmpdir(), "clipfun-work");
