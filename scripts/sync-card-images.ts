/**
 * Refreshes src/lib/domain/card-images.json and card-pool.json from the
 * League wiki.
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
 * It then reads each card page's {{RB card}} info box for what the deck
 * editor needs to know about a card: its type, domains, cost, Might, tags
 * (which champion it belongs to), rarity and whether it is banned.
 *
 * Run it again when a new set lands; the diff is the new cards.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API = "https://wiki.leagueoflegends.com/en-us/api.php";
const NAMESPACE = 3008; // Riftbound:
// Run from the project root, like the other scripts (npm run sets the cwd).
const OUT = resolve(process.cwd(), "src/lib/domain/card-images.json");
const POOL_OUT = resolve(process.cwd(), "src/lib/domain/card-pool.json");
const UA = { "User-Agent": "nexus-night-webapp card sync" };
const pause = () => new Promise((r) => setTimeout(r, 300));

/** One card as the editor sees it; short keys keep the shipped JSON small. */
interface PoolCard {
  /** Name as a decklist writes it, when that differs from the page title (Legends). */
  n?: string;
  /** Type line, e.g. "Unit", "Champion Unit", "Signature Spell", "Legend". */
  t: string;
  /** Domains, e.g. ["Calm", "Order"]. */
  d: string[];
  /** Energy cost. */
  e?: number;
  /** Might. */
  m?: number;
  /** Tags, e.g. ["Azir", "Shurima"]: a champion's cards carry its name. */
  g?: string[];
  /** Rarity. */
  r?: string;
  /** Banned. */
  b?: 1;
}

function field(box: string, key: string): string {
  const m = new RegExp(`^\\|${key}\\s*=(.*)$`, "m").exec(box);
  return m ? m[1]!.trim() : "";
}
const list = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : undefined);

/** The {{RB card}} box at the top of a card page, as editor data. */
function parseBox(wikitext: string): PoolCard | null {
  const start = wikitext.indexOf("{{RB card");
  if (start < 0) return null;
  const end = wikitext.indexOf("\n}}", start);
  const box = wikitext.slice(start, end < 0 ? undefined : end);
  const t = field(box, "type");
  if (!t) return null;
  const card: PoolCard = { t, d: list(field(box, "domain")) };
  const e = num(field(box, "energy"));
  const m = num(field(box, "might"));
  const g = list(field(box, "tags"));
  const r = field(box, "rarity");
  if (e !== undefined) card.e = e;
  if (m !== undefined) card.m = m;
  if (g.length) card.g = g;
  if (r) card.r = r;
  if (field(box, "banned")) card.b = 1;
  // A Legend's page is its title alone; decklists write "Champion, Title".
  if (t === "Legend" && g[0]) card.n = `${g[0]}, ${field(box, "title")}`;
  return card;
}

/** Reads the info box of every card page, 50 titles to a request. */
async function syncPool(titles: string[]): Promise<number> {
  const pool: Record<string, PoolCard> = {};
  let requests = 0;
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: batch.map((t) => `Riftbound:${t}`).join("|"),
    });
    const res = await fetch(`${API}?${params}`, { headers: UA });
    if (!res.ok) throw new Error(`Wiki answered ${res.status}`);
    const body = (await res.json()) as {
      query?: { pages?: Array<{ title: string; revisions?: Array<{ slots?: { main?: { content?: string } } }> }> };
    };
    requests += 1;
    for (const page of body.query?.pages ?? []) {
      const text = page.revisions?.[0]?.slots?.main?.content;
      const card = text ? parseBox(text) : null;
      if (card) pool[page.title.replace(/^Riftbound:/, "")] = card;
    }
    await pause();
  }
  const sorted = Object.fromEntries(Object.entries(pool).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(POOL_OUT, `${JSON.stringify(sorted, null, 0).replace(/,"(?=[^"]+":\{)/g, ',\n"')}\n`);
  console.log(`${Object.keys(sorted).length} cards' details from ${requests} requests → ${POOL_OUT}`);
  return Object.keys(sorted).length;
}
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
    const res = await fetch(`${API}?${params}`, { headers: UA });
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
    await pause();
  }

  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 0).replace(/,"/g, ',\n"')}\n`);
  console.log(`${Object.keys(sorted).length} cards from ${requests} requests → ${OUT}`);
  await syncPool(Object.keys(sorted));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
