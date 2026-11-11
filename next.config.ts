import type { NextConfig } from "next";
const forever = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
const day = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
const config: NextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: { "/api/**": ["./node_modules/ffmpeg-static/ffmpeg"] },
  // heavy static assets: versioned models and the decoder never change; map and backdrops change rarely
  async headers() {
    return [
      { source: "/models/:path*", headers: forever },
      { source: "/draco/:path*", headers: forever },
      { source: "/locals/:file(.+\\.(?:jpg|jpeg|png|webp|mp4))", headers: day },
      { source: "/map/:path*", headers: day },
      { source: "/brand/:path*", headers: day },
    ];
  },
};
export default config;
