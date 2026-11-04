/**
 * Refreshes src/lib/domain/card-images.json from the League wiki.
 *
 *   npm run sync:cards
 *
 * The wiki keeps one page per Riftbound card in its `Riftbound:` namespace,
 * and each page's lead image is the card itself (RB_card_<SET>-<NUM>.png,
 * 744×1039). This walks every page in that namespace and records which card
 * image belongs to which title, so the app can show a card without asking
 * anyone at request time. Pages without a card image (keyword and rules
 * pages) are skipped.
 *
 * Run it again when a new set lands; the diff is the new cards.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API = "https://wiki.leagueoflegends.com/en-us/api.php";
const NAMESPACE = 3008; // Riftbound:
// Run from the project root, like the other scripts (npm run sets the cwd).
const OUT = resolve(process.cwd(), "src/lib/domain/card-images.json");
const CARD_FILE = /^RB_card_([A-Z0-9]+-[0-9A-Za-z*]+)\.png$/;

interface Page {
  title: string;
  pageimage?: string;
  original?: { width: number; height: number };
}

async function main() {
  const map: Record<string, string> = {};
  let cont: Record<string, string> = {};
  let requests = 0;

  for (;;) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "allpages",
      gapnamespace: String(NAMESPACE),
      gaplimit: "max",
      prop: "pageimages",
      piprop: "original|name",
      pilimit: "max",
      ...cont,
    });
    const res = await fetch(`${API}?${params}`, {
      headers: { "User-Agent": "nexus-night-webapp card-image sync" },
    });
    if (!res.ok) throw new Error(`Wiki answered ${res.status}`);
    const body = (await res.json()) as {
      continue?: Record<string, string>;
      query?: { pages?: Record<string, Page> };
    };
    requests += 1;

    for (const page of Object.values(body.query?.pages ?? {})) {
      const m = page.pageimage ? CARD_FILE.exec(page.pageimage) : null;
      if (!m) continue;
      const title = page.title.replace(/^Riftbound:/, "");
      // Battlefields are printed sideways; mark them so the preview is too.
      const landscape = page.original && page.original.width > page.original.height;
      map[title] = landscape ? `${m[1]}:l` : m[1]!;
    }

    if (!body.continue) break;
    cont = body.continue;
    // Be a polite client of a volunteer-run wiki.
    await new Promise((r) => setTimeout(r, 300));
  }

  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 0).replace(/,"/g, ',\n"')}\n`);
  console.log(`${Object.keys(sorted).length} cards from ${requests} requests → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
