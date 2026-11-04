import { describe, expect, it } from "vitest";
import { COMBAT_TRICKS, HIDDEN_CARDS, cardKey, deckWatchlist } from "@/lib/domain/tricks";

describe("deckWatchlist", () => {
  it("finds tricks and Hidden cards despite punctuation differences", () => {
    const { tricks, hidden } = deckWatchlist({
      champions: [{ count: 1, name: "Shen - Kinkou" }],
      mainDeck: [
        { count: 3, name: "Get Excited" },
        { count: 2, name: "Block" },
        { count: 3, name: "Pakaa Cub" },
        { count: 3, name: "Premonition" },
      ],
      sideboard: [{ count: 2, name: "zhonya's hourglass" }],
    });
    expect(tricks.map((c) => [c.name, c.speed, c.sideboard])).toEqual([
      ["Shen - Kinkou", "reaction", false],
      ["Get Excited", "action", false],
      ["Block", "action", false],
    ]);
    expect(hidden.map((c) => [c.name, c.count, c.sideboard])).toEqual([
      ["Block", 2, false],
      ["Pakaa Cub", 3, false],
      ["zhonya's hourglass", 2, true],
    ]);
  });

  it("tolerates missing sections", () => {
    expect(deckWatchlist({})).toEqual({ tricks: [], hidden: [] });
  });

  it("has no two names that collapse to the same key", () => {
    const keys = [...Object.keys(COMBAT_TRICKS), ...HIDDEN_CARDS].map(cardKey);
    expect(new Set(Object.keys(COMBAT_TRICKS).map(cardKey)).size).toBe(Object.keys(COMBAT_TRICKS).length);
    expect(new Set(HIDDEN_CARDS.map(cardKey)).size).toBe(HIDDEN_CARDS.length);
    expect(keys.every((k) => k.length > 0)).toBe(true);
  });
});
