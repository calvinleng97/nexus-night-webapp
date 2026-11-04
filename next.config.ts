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
    // A printed card never changes, so a resized copy is good for a month.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default config;
