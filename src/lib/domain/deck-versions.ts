/**
 * Versions of a saved deck: what changed between them, and how each one did.
 *
 * A deck keeps its earlier lists (Deck.history) and every event registration
 * records which version was played, so "did that change help?" has an answer.
 */
import { cardTotal } from "./deck";
import type { DeckOuting } from "./league-decks";
import type { Deck, DeckCard } from "./types";

const SECTIONS = [
  ["champions", "Champions"],
  ["mainDeck", "Main deck"],
  ["battlefields", "Battlefields"],
  ["runes", "Runes"],
  ["sideboard", "Sideboard"],
] as const;

type Cards = { legend: string | null } & Record<(typeof SECTIONS)[number][0], DeckCard[]>;

export interface DeckVersion extends Cards {
  version: number;
  savedAt: string;
  current: boolean;
}

/** Every version of a deck, newest first; the first is the current list. */
export function deckVersions(deck: Deck): DeckVersion[] {
  const current: DeckVersion = {
    version: deck.version ?? 1,
    savedAt: deck.revisedAt ?? deck.createdAt,
    current: true,
    legend: deck.legend,
    champions: deck.champions,
    mainDeck: deck.mainDeck,
    battlefields: deck.battlefields,
    runes: deck.runes,
    sideboard: deck.sideboard,
  };
  const past = [...(deck.history ?? [])]
    .reverse()
    .map((r) => ({ ...r, current: false }) satisfies DeckVersion);
  return [current, ...past];
}

function counts(cards: DeckCard[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cards) m.set(c.name, (m.get(c.name) ?? 0) + c.count);
  return m;
}

export interface CardChange {
  section: string;
  name: string;
  /** Copies added (positive) or removed (negative). */
  delta: number;
}

/**
 * What changed from one list to the next, section by section: "+1 Arise!",
 * "−2 Charm". A Legend swap is reported as its own change. Within a section,
 * removals come before additions, then by name.
 */
export function diffDecks(from: Cards, to: Cards): { legend: [string | null, string | null] | null; cards: CardChange[] } {
  const cards: CardChange[] = [];
  for (const [key, label] of SECTIONS) {
    const a = counts(from[key]);
    const b = counts(to[key]);
    const names = [...new Set([...a.keys(), ...b.keys()])];
    const changes = names
      .map((name) => ({ section: label, name, delta: (b.get(name) ?? 0) - (a.get(name) ?? 0) }))
      .filter((c) => c.delta !== 0)
      .sort((x, y) => Math.sign(x.delta) - Math.sign(y.delta) || x.name.localeCompare(y.name));
    cards.push(...changes);
  }
  const legend = from.legend === to.legend ? null : ([from.legend, to.legend] as [string | null, string | null]);
  return { legend, cards };
}

/** True when two lists have exactly the same cards (order doesn't matter). */
export function sameCards(a: Cards, b: Cards): boolean {
  const d = diffDecks(a, b);
  return d.legend === null && d.cards.length === 0;
}

/** A version's results, from the outings that registered it. */
export function recordByVersion(outings: DeckOuting[]): Map<number, { wins: number; losses: number; draws: number; nights: number }> {
  const m = new Map<number, { wins: number; losses: number; draws: number; nights: number }>();
  for (const o of outings) {
    const r = m.get(o.version) ?? { wins: 0, losses: 0, draws: 0, nights: 0 };
    r.wins += o.wins;
    r.losses += o.losses;
    r.draws += o.draws;
    r.nights += 1;
    m.set(o.version, r);
  }
  return m;
}

/** Main-deck size, for a version row. */
export function mainCount(v: Cards): number {
  return cardTotal(v.mainDeck);
}
