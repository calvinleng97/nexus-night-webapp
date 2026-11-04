import type { NextConfig } from "next";

const config: NextConfig = {
  // The JSON/JSONL store touches node:fs at request time, so every route that
  // reads it must stay on the Node runtime (the default for route handlers and
  // server components here).
  reactStrictMode: true,
  images: {
    // Card images come from the League wiki as print-size PNGs (~600 KB);
    // the optimizer serves them as WebP at the size each spot needs.
    remotePatterns: [new URL("https://wiki.leagueoflegends.com/en-us/images/**")],
    qualities: [75],
    formats: ["image/webp"],
    // Fetched from the wiki once per size, then served from .next/cache/images
    // (which `next build` keeps). A printed card never changes, so the copy is
    // good for a year — this also becomes the browser's Cache-Control max-age.
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
};

export default config;
