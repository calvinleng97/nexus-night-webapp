import { describe, expect, it } from "vitest";
import {
  cardTotal,
  deckSections,
  decklistText,
  hasCardList,
  parseDecklist,
  shortLegend,
  snapshotDeck,
  suggestDeckName,
} from "@/lib/domain/deck";

const SAMPLE = `Legend:
1 Riven, The Exile

Champion:
1 Riven, Broken Blade

MainDeck:
3 Astral Heron
1 Baron Nashor
3 Bedeviling Stranger
3 Blade of the Exile
1 Blitzcrank, Impassive
3 Defy
1 Discipline
3 Gust
1 Hush
2 Rebuke
2 Reckless Innovator
3 Scuttle Crab
1 Star-Crossed
2 Stellacorn Herder
2 Switcheroo
2 Tideturner
2 Traveling Merchant
1 Vex, Apathetic
3 Zhonya's Hourglass

Battlefields:
1 Emperor's Dais
1 Hunters' Circle
1 Star Spring

Runes:
6 Calm Rune
6 Chaos Rune

Sideboard:
`;

function ok(input: string) {
  const res = parseDecklist(input);
  if (!res.ok) throw new Error(`expected parse to succeed: ${res.error}`);
  return res.deck;
}

describe("the RiftAtlas sample", () => {
  const deck = ok(SAMPLE);

  it("reads the legend", () => {
    expect(deck.legend).toBe("Riven, The Exile");
  });

  it("reads each section", () => {
    expect(deck.champions).toEqual([{ count: 1, name: "Riven, Broken Blade" }]);
    expect(deck.mainDeck).toHaveLength(19);
    expect(deck.battlefields).toHaveLength(3);
    expect(deck.runes).toEqual([
      { count: 6, name: "Calm Rune" },
      { count: 6, name: "Chaos Rune" },
    ]);
  });

  it("treats a trailing empty section as empty, not an error", () => {
    expect(deck.sideboard).toEqual([]);
  });

  it("keeps commas and apostrophes in card names", () => {
    expect(deck.mainDeck).toContainEqual({ count: 1, name: "Blitzcrank, Impassive" });
    expect(deck.mainDeck).toContainEqual({ count: 3, name: "Zhonya's Hourglass" });
    expect(deck.battlefields).toContainEqual({ count: 1, name: "Emperor's Dais" });
  });

  it("counts cards", () => {
    // The pasted sample sums to 39, not the 40 a full list would have.
    expect(cardTotal(deck.mainDeck)).toBe(39);
    expect(cardTotal(deck.runes)).toBe(12);
  });
});

describe("tolerated variation", () => {
  it("accepts CRLF line endings", () => {
    expect(ok(SAMPLE.replace(/\n/g, "\r\n")).legend).toBe("Riven, The Exile");
  });

  it("accepts odd casing and spacing in headers", () => {
    const deck = ok("  legend :\n1 Riven, The Exile\n\n  MAIN DECK:\n3 Gust\n");
    expect(deck.legend).toBe("Riven, The Exile");
    expect(deck.mainDeck).toEqual([{ count: 3, name: "Gust" }]);
  });

  it("accepts the 3x form", () => {
    expect(ok("MainDeck:\n3x Gust\n2 Defy\n").mainDeck).toEqual([
      { count: 3, name: "Gust" },
      { count: 2, name: "Defy" },
    ]);
  });

  it("accepts two-digit counts", () => {
    expect(ok("MainDeck:\n12 Calm Rune\n").mainDeck).toEqual([{ count: 12, name: "Calm Rune" }]);
  });

  it("treats a bare list with no headers as the main deck", () => {
    expect(ok("3 Gust\n2 Defy\n").mainDeck).toHaveLength(2);
  });

  it("ignores comment lines", () => {
    expect(ok("# my brew\nMainDeck:\n3 Gust\n// swap later\n").mainDeck).toHaveLength(1);
  });

  it("accepts sections in any order", () => {
    const deck = ok("Runes:\n6 Calm Rune\n\nMainDeck:\n3 Gust\n\nLegend:\n1 Riven, The Exile\n");
    expect(deck.legend).toBe("Riven, The Exile");
    expect(deck.runes).toHaveLength(1);
  });
});

describe("rejected input", () => {
  it("rejects an empty paste", () => {
    for (const v of ["", "   ", "\n\n"]) {
      const res = parseDecklist(v);
      expect(res.ok, JSON.stringify(v)).toBe(false);
    }
  });

  it("rejects a line it cannot read, naming it", () => {
    const res = parseDecklist("MainDeck:\n3 Gust\nAstral Heron\n");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("Astral Heron");
    expect(res.line).toBe(3);
  });

  it("rejects an unknown section rather than dropping its cards", () => {
    const res = parseDecklist("Tokens:\n3 Gust\n");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("Tokens");
    expect(res.error).toContain("MainDeck");
  });

  it("rejects a duplicated section", () => {
    const res = parseDecklist("MainDeck:\n3 Gust\nMainDeck:\n2 Defy\n");
    expect(res.ok).toBe(false);
  });

  it("rejects two legends", () => {
    const res = parseDecklist("Legend:\n1 Riven, The Exile\n1 Vex, Apathetic\n\nMainDeck:\n3 Gust\n");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/one Legend/i);
  });

  it("rejects a list with no main deck", () => {
    const res = parseDecklist("Legend:\n1 Riven, The Exile\n\nSideboard:\n2 Defy\n");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/MainDeck/i);
  });

  it("rejects a zero count", () => {
    expect(parseDecklist("MainDeck:\n0 Gust\n").ok).toBe(false);
  });
});

describe("naming helpers", () => {
  it("names a deck after its legend", () => {
    expect(suggestDeckName(ok(SAMPLE))).toBe("Riven, The Exile");
  });

  it("falls back to the champion, then to a placeholder", () => {
    expect(suggestDeckName(ok("Champion:\n1 Riven, Broken Blade\n\nMainDeck:\n3 Gust\n"))).toBe(
      "Riven, Broken Blade",
    );
    expect(suggestDeckName(ok("MainDeck:\n3 Gust\n"))).toBe("Untitled deck");
  });

  it("shortens a legend to the character name", () => {
    expect(shortLegend("Riven, The Exile")).toBe("Riven");
    expect(shortLegend("Jinx")).toBe("Jinx");
    expect(shortLegend(null)).toBeNull();
  });
});

describe("snapshots", () => {
  const saved = { id: "dk_1", name: "Riven list", ...ok(SAMPLE), source: SAMPLE };

  it("copies the cards rather than sharing them", () => {
    const snap = snapshotDeck(saved, "2026-05-01T00:00:00.000Z");
    expect(snap.deckId).toBe("dk_1");
    expect(snap.registeredAt).toBe("2026-05-01T00:00:00.000Z");
    expect(snap.mainDeck).toEqual(saved.mainDeck);

    // Mutating the snapshot must not reach back into the saved deck.
    snap.mainDeck[0]!.count = 99;
    snap.mainDeck.push({ count: 1, name: "Intruder" });
    expect(saved.mainDeck[0]!.count).not.toBe(99);
    expect(saved.mainDeck.some((c) => c.name === "Intruder")).toBe(false);
  });

  it("lists only the sections a deck has, in a fixed order", () => {
    expect(deckSections(ok(SAMPLE)).map((s) => s.key)).toEqual([
      "champions",
      "mainDeck",
      "battlefields",
      "runes",
    ]);
    expect(deckSections(ok("MainDeck:\n3 Gust\n")).map((s) => s.key)).toEqual(["mainDeck"]);
  });

  it("treats a record with no cards as having no list", () => {
    expect(hasCardList(ok(SAMPLE))).toBe(true);
    expect(
      hasCardList({
        legend: "Riven, The Exile",
        champions: [],
        mainDeck: [],
        battlefields: [],
        runes: [],
        sideboard: [],
      }),
    ).toBe(false);
  });

  it("renders back to text that parses to the same deck", () => {
    const deck = ok(SAMPLE);
    const round = parseDecklist(decklistText(deck));
    expect(round.ok).toBe(true);
    if (round.ok) expect(round.deck).toEqual(deck);
  });
});
