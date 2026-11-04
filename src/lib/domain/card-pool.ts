/**
 * The card pool, as the deck editor uses it: every card with its type,
 * domains, cost and tags (`card-pool.json`, from `npm run sync:cards`), plus
 * its image. Tokens and other non-deck cards are left out.
 */
import pool from "./card-pool.json";
import { cardImage } from "./card-images";

interface RawCard {
  n?: string;
  t: string;
  d: string[];
  e?: number;
  m?: number;
  g?: string[];
  r?: string;
  b?: 1;
}

export type Slot = "legend" | "champion" | "main" | "battlefield" | "rune";

export interface PoolCard {
  /** As a decklist writes it, e.g. "Azir, Emperor of the Sands". */
  name: string;
  type: string;
  /** Where it goes: Legends, Battlefields and Runes have their own sections. */
  slot: Slot;
  domains: string[];
  energy: number | null;
  might: number | null;
  tags: string[];
  /** A champion's Signature cards may only go with that champion's Legend. */
  signature: boolean;
  /** A Champion Unit, which can fill the Chosen Champion slot. */
  champion: boolean;
  rarity: string | null;
  banned: boolean;
  image: string | null;
  landscape: boolean;
}

function slotOf(type: string): Slot | null {
  if (/Token$/.test(type) || type === "Other") return null;
  if (type === "Legend") return "legend";
  if (type === "Battlefield") return "battlefield";
  if (type === "Rune") return "rune";
  return "main";
}

let cached: PoolCard[] | null = null;

/** Every card that can go in a deck, by name. */
export function cardPool(): PoolCard[] {
  if (cached) return cached;
  const out: PoolCard[] = [];
  for (const [page, raw] of Object.entries(pool as Record<string, RawCard>)) {
    const slot = slotOf(raw.t);
    if (!slot) continue;
    const name = raw.n ?? page;
    const image = cardImage(page);
    out.push({
      name,
      type: raw.t,
      slot,
      domains: raw.d,
      energy: raw.e ?? null,
      might: raw.m ?? null,
      tags: raw.g ?? [],
      signature: raw.t.startsWith("Signature"),
      champion: raw.t === "Champion Unit",
      rarity: raw.r ?? null,
      banned: raw.b === 1,
      image: image?.src ?? null,
      landscape: image?.landscape ?? false,
    });
  }
  cached = out.sort((a, b) => a.name.localeCompare(b.name));
  return cached;
}

/** The pool by decklist name. */
export function poolByName(): Map<string, PoolCard> {
  return new Map(cardPool().map((c) => [c.name, c]));
}
