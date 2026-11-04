import { describe, expect, it } from "vitest";
import { deckVersions, diffDecks, recordByVersion, sameCards } from "@/lib/domain/deck-versions";
import type { DeckOuting } from "@/lib/domain/league-decks";
import type { Deck, DeckCard } from "@/lib/domain/types";

const list = (over: Partial<Record<"champions" | "mainDeck" | "battlefields" | "runes" | "sideboard", DeckCard[]>> & { legend?: string | null } = {}) => ({
  legend: "Azir, Emperor of the Sands",
  champions: [{ count: 1, name: "Azir, Sovereign" }],
  mainDeck: [
    { count: 3, name: "Arise!" },
    { count: 1, name: "Charm" },
  ],
  battlefields: [],
  runes: [{ count: 6, name: "Calm Rune" }],
  sideboard: [],
  ...over,
});

describe("diffDecks", () => {
  it("reports per-section copy changes, removals before additions", () => {
    const d = diffDecks(
      list(),
      list({ mainDeck: [{ count: 2, name: "Arise!" }, { count: 1, name: "Charm" }, { count: 2, name: "Defy" }] }),
    );
    expect(d.legend).toBeNull();
    expect(d.cards).toEqual([
      { section: "Main deck", name: "Arise!", delta: -1 },
      { section: "Main deck", name: "Defy", delta: 2 },
    ]);
  });

  it("treats card order and split lines as the same list", () => {
    const a = list();
    const b = list({ mainDeck: [{ count: 1, name: "Charm" }, { count: 2, name: "Arise!" }, { count: 1, name: "Arise!" }] });
    expect(sameCards(a, b)).toBe(true);
  });

  it("calls out a Legend swap and a card moving to the sideboard", () => {
    const d = diffDecks(
      list(),
      list({ legend: "Riven, The Exile", mainDeck: [{ count: 3, name: "Arise!" }], sideboard: [{ count: 1, name: "Charm" }] }),
    );
    expect(d.legend).toEqual(["Azir, Emperor of the Sands", "Riven, The Exile"]);
    expect(d.cards).toEqual([
      { section: "Main deck", name: "Charm", delta: -1 },
      { section: "Sideboard", name: "Charm", delta: 1 },
    ]);
  });
});

describe("deckVersions and recordByVersion", () => {
  it("lists the current version first, then history newest first", () => {
    const deck = {
      ...list(),
      id: "dk_x",
      ownerId: "u",
      name: "x",
      source: "",
      createdAt: "2026-11-01T00:00:00.000Z",
      version: 3,
      revisedAt: "2026-11-03T00:00:00.000Z",
      history: [
        { ...list(), version: 1, savedAt: "2026-11-01T00:00:00.000Z", source: "" },
        { ...list(), version: 2, savedAt: "2026-11-02T00:00:00.000Z", source: "" },
      ],
    } satisfies Deck;
    expect(deckVersions(deck).map((v) => [v.version, v.current])).toEqual([
      [3, true],
      [2, false],
      [1, false],
    ]);
  });

  it("reads an old deck without versions as version 1", () => {
    const deck = { ...list(), id: "dk_y", ownerId: "u", name: "y", source: "", createdAt: "2026-11-01T00:00:00.000Z" } satisfies Deck;
    expect(deckVersions(deck)).toEqual([expect.objectContaining({ version: 1, current: true, savedAt: deck.createdAt })]);
  });

  it("sums each version's nights", () => {
    const o = (version: number, wins: number, losses: number): DeckOuting => ({
      eventId: `e${version}${wins}`,
      eventName: "n",
      at: "2026-11-01",
      status: "complete",
      version,
      wins,
      losses,
      draws: 0,
      byes: 0,
    });
    const r = recordByVersion([o(1, 1, 2), o(2, 2, 1), o(2, 3, 0)]);
    expect(r.get(1)).toEqual({ wins: 1, losses: 2, draws: 0, nights: 1 });
    expect(r.get(2)).toEqual({ wins: 5, losses: 1, draws: 0, nights: 2 });
  });
});
