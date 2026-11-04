import type { NextConfig } from "next";

const config: NextConfig = {
  // The JSON/JSONL store touches node:fs at request time, so every route that
  // reads it must stay on the Node runtime (the default for route handlers and
  // server components here).
  reactStrictMode: true,
  images: {
    // Card images are the server's own copies (app/card-art/[file]), mirrored
    // from the League wiki on first use; the optimizer resizes them to WebP.
    localPatterns: [{ pathname: "/card-art/**", search: "" }],
    qualities: [75],
    formats: ["image/webp"],
    // Only the widths the app's `sizes` actually resolve to, so the cache has a
    // known, finite set of variants and `npm run preheat:cards` can fill it.
    imageSizes: [256, 384],
    deviceSizes: [640, 750, 1080, 1200, 1920],
    // A resized copy is kept for a year: a card never changes under its name,
    // and this also becomes the browser's Cache-Control max-age.
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
};

export default config;
