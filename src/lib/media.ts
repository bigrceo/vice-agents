import "server-only";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegPath from "ffmpeg-static";
import { tmpDir } from "./storage";

function run(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg binary missing"));
    const p = spawn(ffmpegPath, ["-hide_banner", "-y", ...args]);
    let stderr = "";
    p.stderr.on("data", (d) => { stderr += d; if (stderr.length > 200_000) stderr = stderr.slice(-50_000); });
    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

export async function probe(file: string) {
  const { stderr } = await run(["-i", file]);
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr);
  const v = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(stderr);
  return {
    duration: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0,
    width: v ? +v[1] : 0, height: v ? +v[2] : 0,
    hasVideo: Boolean(v),
  };
}

export type Crop = { x: number; y: number; size: number; start: number; length: number };

/** Square crop (fractions of the frame) → still.jpg (512px) + silent loop.mp4 (360px, ≤ 6 s). */
export async function renderClip(video: Buffer, crop: Crop) {
  const dir = path.join(tmpDir(), randomUUID());
  await mkdir(dir, { recursive: true });
  try {
    const src = path.join(dir, "src");
    await writeFile(src, video);
    const info = await probe(src);
    if (!info.hasVideo) throw new Error("That file has no video track.");
    const side = Math.floor(Math.min(info.width, info.height) * Math.min(1, Math.max(0.1, crop.size)) / 2) * 2;
    const x = Math.round(Math.max(0, Math.min(info.width - side, crop.x * info.width)));
    const y = Math.round(Math.max(0, Math.min(info.height - side, crop.y * info.height)));
    const start = Math.max(0, Math.min(crop.start, Math.max(0, info.duration - 0.5)));
    const length = Math.max(1, Math.min(6, crop.length || 4));
    const cropF = `crop=${side}:${side}:${x}:${y}`;
    const still = path.join(dir, "still.jpg"), loop = path.join(dir, "loop.mp4");
    const a = await run(["-ss", String(start), "-i", src, "-frames:v", "1", "-vf", `${cropF},scale=512:512`, "-q:v", "3", still]);
    if (a.code) throw new Error("Could not extract a frame.");
    const b = await run(["-ss", String(start), "-t", String(length), "-i", src, "-an", "-vf", `${cropF},scale=360:360,fps=24`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", loop]);
    if (b.code) throw new Error("Could not render the loop.");
    return { still: await readFile(still), loop: await readFile(loop), info };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Demo media: an animated gradient (no third-party content). */
export async function demoClip(seed: number) {
  const dir = path.join(tmpDir(), randomUUID());
  await mkdir(dir, { recursive: true });
  try {
    const loop = path.join(dir, "loop.mp4"), still = path.join(dir, "still.jpg");
    const hues = ["0xff4d2e", "0xffc531", "0x37e0c8", "0x7a5cff", "0xff3d8b", "0x2ea8ff"];
    const c0 = hues[seed % 6], c1 = hues[(seed + 2) % 6], c2 = hues[(seed + 4) % 6];
    await run(["-f", "lavfi", "-i", `gradients=s=360x360:d=4:speed=0.02:c0=${c0}:c1=${c1}:c2=${c2}:n=3:seed=${seed}`,
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", loop]);
    await run(["-i", loop, "-frames:v", "1", "-q:v", "4", still]);
    return { loop: await readFile(loop), still: await readFile(still) };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
