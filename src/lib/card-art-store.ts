/**
 * The server's own copy of every card image.
 *
 * Each card is fetched from the League wiki the first time anyone needs it
 * and kept on disk from then on, so the wiki is asked once per card — not
 * once per size the optimizer makes, and not at all once the copy exists.
 * `scripts/preheat-card-art.ts` fills the whole store up front.
 *
 * Files live in `.next/cache/card-art` by default: `next build` keeps
 * `.next/cache` across deploys, and the service may already write there.
 * NEXUS_CARD_ART_DIR overrides it.
 */
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CARD_FILES } from "./domain/card-images";

const WIKI = "https://wiki.leagueoflegends.com/en-us/images";
/** A card file is a few hundred KB; anything wildly bigger is not one. */
const MAX_BYTES = 8 * 1024 * 1024;

export function cardArtDir(): string {
  return process.env.NEXUS_CARD_ART_DIR
    ? resolve(process.env.NEXUS_CARD_ART_DIR)
    : resolve(/* turbopackIgnore: true */ process.cwd(), ".next/cache/card-art");
}

/** Only files the card map names, so the route can never be used as a proxy. */
export function isCardFile(file: string): boolean {
  return CARD_FILES.has(file);
}

const inflight = new Map<string, Promise<Buffer>>();

async function fetchAndStore(file: string, path: string): Promise<Buffer> {
  const res = await fetch(`${WIKI}/${encodeURIComponent(file)}`, {
    headers: { "User-Agent": "nexus-night-webapp card-art store" },
  });
  if (!res.ok) throw new Error(`Wiki answered ${res.status} for ${file}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new Error(`Wiki sent ${type || "no type"} for ${file}`);
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length === 0 || body.length > MAX_BYTES) throw new Error(`Bad size for ${file}`);

  await mkdir(cardArtDir(), { recursive: true });
  // Temp file then rename(2), so a half-written file is never served.
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, body);
  await rename(tmp, path);
  return body;
}

/**
 * The bytes of one card file, from disk if we have it, else from the wiki
 * (once — concurrent first requests share a single download).
 */
export async function getCardArt(file: string): Promise<Buffer> {
  if (!isCardFile(file)) throw new Error(`Not a card file: ${file}`);
  const path = join(cardArtDir(), file);
  try {
    return await readFile(path);
  } catch {
    // Not stored yet.
  }
  let pending = inflight.get(file);
  if (!pending) {
    pending = fetchAndStore(file, path).finally(() => inflight.delete(file));
    inflight.set(file, pending);
  }
  return pending;
}

export async function hasCardArt(file: string): Promise<boolean> {
  try {
    return (await stat(join(cardArtDir(), file))).size > 0;
  } catch {
    return false;
  }
}
