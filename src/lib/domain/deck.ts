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
