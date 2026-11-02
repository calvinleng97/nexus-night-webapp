/**
 * Decklist parsing for the plain-text format RiftAtlas and similar sites
 * export:
 *
 *   Legend:
 *   1 Riven, The Exile
 *
 *   MainDeck:
 *   3 Astral Heron
 *   ...
 *
 * Deliberately lenient about casing, spacing, blank lines, CRLF and section
 * order, and deliberately strict about anything it cannot interpret: a
 * silently dropped line would mean someone registers a deck that is not the
 * deck they pasted.
 */

export interface DeckCard {
  count: number;
  name: string;
}

export interface ParsedDeck {
  /** The single Legend card, or null if the list has no Legend section. */
  legend: string | null;
  champions: DeckCard[];
  mainDeck: DeckCard[];
  battlefields: DeckCard[];
  runes: DeckCard[];
  sideboard: DeckCard[];
}

export type DeckParseResult =
  | { ok: true; deck: ParsedDeck }
  | { ok: false; error: string; line?: number };

type SectionKey = "legend" | "champions" | "mainDeck" | "battlefields" | "runes" | "sideboard";

/** Accepted spellings for each section, normalised to lower case, no spaces. */
const SECTIONS: Record<string, SectionKey> = {
  legend: "legend",
  legends: "legend",
  champion: "champions",
  champions: "champions",
  maindeck: "mainDeck",
  main: "mainDeck",
  deck: "mainDeck",
  battlefield: "battlefields",
  battlefields: "battlefields",
  rune: "runes",
  runes: "runes",
  sideboard: "sideboard",
  side: "sideboard",
};

const SECTION_NAMES = "Legend, Champion, MainDeck, Battlefields, Runes, Sideboard";

/** "3 Astral Heron", "3x Astral Heron", "10 Calm Rune". */
const CARD_LINE = /^(\d{1,2})\s*[xX]?\s+(\S.*)$/;

export function parseDecklist(input: string): DeckParseResult {
  if (typeof input !== "string" || input.trim() === "")
    return { ok: false, error: "Paste a decklist first." };

  const deck: ParsedDeck = {
    legend: null,
    champions: [],
    mainDeck: [],
    battlefields: [],
    runes: [],
    sideboard: [],
  };

  // Cards before any header are treated as the main deck, since some exports
  // omit the header when the list has only one section.
  let current: SectionKey = "mainDeck";
  let sawHeader = false;
  const seenSections = new Set<SectionKey>();
  let legendCard: DeckCard | null = null;

  const lines = input.replace(/\r\n?/g, "\n").split("\n");

  for (const [i, raw] of lines.entries()) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#") || line.startsWith("//")) continue;

    if (line.endsWith(":")) {
      const key = line.slice(0, -1).trim().toLowerCase().replace(/[\s_-]/g, "");
      const section = SECTIONS[key];
      if (!section)
        return {
          ok: false,
          error: `Unknown section "${line.slice(0, -1).trim()}". Expected one of: ${SECTION_NAMES}.`,
          line: i + 1,
        };
      if (seenSections.has(section))
        return { ok: false, error: `The ${line} section appears twice.`, line: i + 1 };
      seenSections.add(section);
      current = section;
      sawHeader = true;
      continue;
    }

    const m = CARD_LINE.exec(line);
    if (!m)
      return {
        ok: false,
        error: `Could not read "${line}". Each card line looks like "3 Astral Heron".`,
        line: i + 1,
      };

    const count = Number(m[1]);
    const name = m[2]!.trim();
    if (!Number.isInteger(count) || count < 1)
      return { ok: false, error: `"${line}" needs a count of at least 1.`, line: i + 1 };

    if (current === "legend") {
      if (legendCard)
        return { ok: false, error: "A deck can only have one Legend.", line: i + 1 };
      legendCard = { count, name };
      continue;
    }
    deck[current].push({ count, name });
  }

  deck.legend = legendCard?.name ?? null;

  if (deck.mainDeck.length === 0)
    return {
      ok: false,
      error: sawHeader
        ? "That list has no MainDeck cards."
        : `No cards found. Sections look like "MainDeck:" followed by lines like "3 Astral Heron".`,
    };

  return { ok: true, deck };
}

export function cardTotal(cards: DeckCard[]): number {
  return cards.reduce((sum, c) => sum + c.count, 0);
}

/** A short label for a deck that has no explicit name. */
export function suggestDeckName(deck: ParsedDeck): string {
  if (deck.legend) return deck.legend;
  if (deck.champions[0]) return deck.champions[0].name;
  return "Untitled deck";
}

/** Just the character part of "Riven, The Exile" — for cramped places. */
export function shortLegend(legend: string | null): string | null {
  if (!legend) return null;
  const comma = legend.indexOf(",");
  return comma > 0 ? legend.slice(0, comma).trim() : legend;
}

// ------------------------------------------------- snapshots and sections

/**
 * The five card sections of a deck, in the order they are shown.
 *
 * Tolerant of a missing array so a record written by an older schema can be
 * read without special-casing at every call site.
 */
export interface DeckSection {
  key: "champions" | "mainDeck" | "battlefields" | "runes" | "sideboard";
  /** How the section is titled in the UI. */
  label: string;
  /** How the section is spelled in the plain-text format. */
  header: string;
  cards: DeckCard[];
}

interface DeckLike {
  legend?: string | null;
  champions?: DeckCard[];
  mainDeck?: DeckCard[];
  battlefields?: DeckCard[];
  runes?: DeckCard[];
  sideboard?: DeckCard[];
}

export function deckSections(deck: DeckLike): DeckSection[] {
  const all: DeckSection[] = [
    { key: "champions", label: "Champions", header: "Champion", cards: deck.champions ?? [] },
    { key: "mainDeck", label: "Main deck", header: "MainDeck", cards: deck.mainDeck ?? [] },
    {
      key: "battlefields",
      label: "Battlefields",
      header: "Battlefields",
      cards: deck.battlefields ?? [],
    },
    { key: "runes", label: "Runes", header: "Runes", cards: deck.runes ?? [] },
    { key: "sideboard", label: "Sideboard", header: "Sideboard", cards: deck.sideboard ?? [] },
  ];
  return all.filter((s) => s.cards.length > 0);
}

/** False when a record names a deck but has no cards — see RegisteredDeck.source. */
export function hasCardList(deck: DeckLike): boolean {
  return deckSections(deck).length > 0;
}

/**
 * Freeze a saved deck into the form an event stores.
 *
 * The cards are copied, not referenced: editing or deleting the deck later
 * must not change what the event says was played.
 */
export function snapshotDeck(
  deck: {
    id: string;
    name: string;
    legend: string | null;
    champions: DeckCard[];
    mainDeck: DeckCard[];
    battlefields: DeckCard[];
    runes: DeckCard[];
    sideboard: DeckCard[];
    source: string;
  },
  now: string = new Date().toISOString(),
): {
  deckId: string;
  name: string;
  legend: string | null;
  champions: DeckCard[];
  mainDeck: DeckCard[];
  battlefields: DeckCard[];
  runes: DeckCard[];
  sideboard: DeckCard[];
  source: string;
  registeredAt: string;
} {
  return {
    deckId: deck.id,
    name: deck.name,
    legend: deck.legend,
    champions: deck.champions.map((c) => ({ ...c })),
    mainDeck: deck.mainDeck.map((c) => ({ ...c })),
    battlefields: deck.battlefields.map((c) => ({ ...c })),
    runes: deck.runes.map((c) => ({ ...c })),
    sideboard: deck.sideboard.map((c) => ({ ...c })),
    source: deck.source,
    registeredAt: now,
  };
}

/** Render a deck back out as plain text, so a list can be copied elsewhere. */
export function decklistText(deck: DeckLike): string {
  const parts: string[] = [];
  if (deck.legend) parts.push(`Legend:\n1 ${deck.legend}`);
  for (const section of deckSections(deck))
    parts.push(
      `${section.header}:\n${section.cards.map((c) => `${c.count} ${c.name}`).join("\n")}`,
    );
  return parts.join("\n\n");
}
