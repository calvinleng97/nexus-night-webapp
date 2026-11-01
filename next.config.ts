import type { NextConfig } from "next";

const config: NextConfig = {
  // The JSON/JSONL store touches node:fs at request time, so every route that
  // reads it must stay on the Node runtime (the default for route handlers and
  // server components here).
  reactStrictMode: true,
};

export default config;
