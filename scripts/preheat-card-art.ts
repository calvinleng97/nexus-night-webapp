/**
 * Fills the server's card-art store and image cache ahead of time, so nobody
 * waits on the wiki the first time they open a deck.
 *
 *   npm run preheat:cards                        # against http://127.0.0.1:3000
 *   npm run preheat:cards -- http://host:port    # against another running server
 *   npm run preheat:cards -- --limit=5           # just the first few, to try it
 *
 * For each card in src/lib/domain/card-images.json it asks the running app for
 *   1. /card-art/<file>        → the original, downloaded from the wiki once
 *   2. /_next/image?…&w=<w>    → each configured width, resized locally
 * Originals are fetched one at a time with a pause, to be gentle on a
 * volunteer-run wiki; resizing is local, so it runs a few at a time. Re-runs
 * are cheap: whatever is already stored answers straight from disk.
 */
import images from "../src/lib/domain/card-images.json";
import config from "../next.config";

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? Infinity);
const WIDTHS = [...(config.images?.imageSizes ?? []), ...(config.images?.deviceSizes ?? [])];
const QUALITY = config.images?.qualities?.[0] ?? 75;
const WIKI_PAUSE_MS = 150;
const RESIZE_CONCURRENCY = 4;

const files = [
  ...new Set(
    Object.values(images as Record<string, string>).map(
      (v) => `RB_card_${v.endsWith(":l") ? v.slice(0, -2) : v}.png`,
    ),
  ),
].sort().slice(0, LIMIT);

async function get(url: string): Promise<{ status: number; cache: string | null }> {
  const res = await fetch(url, { headers: { Accept: "image/webp,image/*" } });
  await res.arrayBuffer(); // drain, so the connection is reused
  return { status: res.status, cache: res.headers.get("x-nextjs-cache") };
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) await fn(items[i++]!);
    }),
  );
}

async function main() {
  console.log(`Preheating ${files.length} cards × ${WIDTHS.length} widths against ${BASE}`);
  const started = Date.now();
  let fetched = 0;
  let failed = 0;
  let resized = 0;
  let alreadyCached = 0;

  for (const [n, file] of files.entries()) {
    const t = Date.now();
    const original = await get(`${BASE}/card-art/${file}`);
    if (original.status !== 200) {
      failed += 1;
      console.warn(`  ✗ ${file}: HTTP ${original.status}`);
      continue;
    }
    // A fresh download takes a moment; a stored copy answers in a few ms.
    if (Date.now() - t > 50) {
      fetched += 1;
      await new Promise((r) => setTimeout(r, WIKI_PAUSE_MS));
    }

    const src = encodeURIComponent(`/card-art/${file}`);
    await pool(WIDTHS, RESIZE_CONCURRENCY, async (w) => {
      const r = await get(`${BASE}/_next/image?url=${src}&w=${w}&q=${QUALITY}`);
      if (r.status !== 200) {
        failed += 1;
        console.warn(`  ✗ ${file} @${w}: HTTP ${r.status}`);
      } else if (r.cache === "HIT") alreadyCached += 1;
      else resized += 1;
    });

    if ((n + 1) % 50 === 0 || n + 1 === files.length)
      console.log(
        `  ${n + 1}/${files.length} cards · ${fetched} downloaded · ${resized} resized · ${alreadyCached} already cached · ${failed} failed · ${Math.round((Date.now() - started) / 1000)}s`,
      );
  }

  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
