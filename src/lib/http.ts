import { NextResponse } from "next/server";
export const ok = (d: unknown, init?: ResponseInit) => NextResponse.json(d, init);
export const fail = (e: unknown, status = 400) => NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
export const ipOf = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
