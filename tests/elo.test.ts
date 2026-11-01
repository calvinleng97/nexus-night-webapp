import { describe, expect, it } from "vitest";
import { DEFAULT_ELO, computeLeagueElo, expectedScore } from "@/lib/domain/elo";
import type { MatchKind, MatchStatus, NexusEvent, Pairing, Round } from "@/lib/domain/types";

interface MatchSpec {
  a: string;
  b: string | null;
  ga?: number;
  gb?: number;
  kind?: MatchKind;
  status?: MatchStatus;
}

/** One event, each match in its own round, in the order given. */
function makeEvent(matches: MatchSpec[], id = "ev_1", at = "2026-01-01T00:00:00.000Z"): NexusEvent {
  const rounds: Round[] = matches.map((m, i) => {
    const kind: MatchKind = m.kind ?? (m.b === null ? "bye" : "played");
    const status: MatchStatus = m.status ?? "confirmed";
    const pairing: Pairing = {
      id: `${id}-m${i}`,
      roundNumber: i + 1,
      a: m.a,
      b: m.b,
      kind,
      status,
      rematch: false,
      report:
        kind === "bye" || m.ga === undefined
          ? null
          : { score: { a: m.ga, b: m.gb ?? 0 }, submittedBy: m.a, submittedAt: at },
      confirmedBy: null,
      overriddenBy: null,
      disputedBy: null,
      resolvedAt: `2026-01-01T00:0${i}:00.000Z`,
    };
    return { number: i + 1, pairings: [pairing], createdAt: at, closedAt: at };
  });
  return {
    id,
    leagueId: "lg_1",
    name: "Test",
    status: "complete",
    totalRounds: matches.length,
    createdBy: "mgr",
    managerIds: ["mgr"],
    players: [],
    rounds,
    seed: 1,
    createdAt: at,
    startedAt: at,
    completedAt: at,
  };
}

const by = (rows: ReturnType<typeof computeLeagueElo>, id: string) =>
  rows.find((r) => r.userId === id)!;

describe("expected score", () => {
  it("is even between equal ratings", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 10);
  });

  it("gives a 400-point favourite about 91%", () => {
    expect(expectedScore(1600, 1200)).toBeCloseTo(10 / 11, 6);
  });

  it("is symmetric", () => {
    expect(expectedScore(1500, 1300) + expectedScore(1300, 1500)).toBeCloseTo(1, 10);
  });
});

describe("rating a single match", () => {
  it("moves equal players by half the K factor", () => {
    const rows = computeLeagueElo([makeEvent([{ a: "x", b: "y", ga: 2, gb: 0 }])], ["x", "y"]);
    // Both start unrated, so both use provisionalK: 40 * (1 - 0.5) = 20.
    expect(by(rows, "x").rating).toBe(DEFAULT_ELO.base + 20);
    expect(by(rows, "y").rating).toBe(DEFAULT_ELO.base - 20);
    expect(by(rows, "x").lastDelta).toBe(20);
    expect(by(rows, "y").lastDelta).toBe(-20);
  });

  it("leaves equal players unchanged on a draw", () => {
    const rows = computeLeagueElo([makeEvent([{ a: "x", b: "y", ga: 1, gb: 1 }])], ["x", "y"]);
    expect(by(rows, "x").rating).toBe(DEFAULT_ELO.base);
    expect(by(rows, "y").rating).toBe(DEFAULT_ELO.base);
    expect(by(rows, "x").draws).toBe(1);
  });

  it("ignores game margin: 2-0 and 2-1 move ratings identically", () => {
    const clean = computeLeagueElo([makeEvent([{ a: "x", b: "y", ga: 2, gb: 0 }])], ["x", "y"]);
    const close = computeLeagueElo([makeEvent([{ a: "x", b: "y", ga: 2, gb: 1 }])], ["x", "y"]);
    expect(by(clean, "x").rating).toBe(by(close, "x").rating);
  });

  it("is zero-sum when both players share a K factor", () => {
    const rows = computeLeagueElo([makeEvent([{ a: "x", b: "y", ga: 2, gb: 0 }])], ["x", "y"]);
    const total = rows.reduce((s, r) => s + r.rating, 0);
    expect(total).toBe(DEFAULT_ELO.base * 2);
  });

  it("rewards an underdog more than a favourite", () => {
    // Give "fav" a head start, then compare what a win is worth to each side.
    const warmup: MatchSpec[] = [
      { a: "fav", b: "filler", ga: 2, gb: 0 },
      { a: "fav", b: "filler", ga: 2, gb: 0 },
    ];
    const favWins = computeLeagueElo(
      [makeEvent([...warmup, { a: "fav", b: "dog", ga: 2, gb: 0 }])],
      ["fav", "dog"],
    );
    const dogWins = computeLeagueElo(
      [makeEvent([...warmup, { a: "fav", b: "dog", ga: 0, gb: 2 }])],
      ["fav", "dog"],
    );
    const favGain = by(favWins, "fav").lastDelta!;
    const dogGain = by(dogWins, "dog").lastDelta!;
    expect(dogGain).toBeGreaterThan(favGain);
  });
});

describe("what is excluded", () => {
  it("does not rate byes", () => {
    const rows = computeLeagueElo([makeEvent([{ a: "x", b: null }])], ["x"]);
    expect(by(rows, "x").games).toBe(0);
    expect(by(rows, "x").rating).toBe(DEFAULT_ELO.base);
    expect(by(rows, "x").lastDelta).toBeNull();
  });

  it("does not rate forfeits from a drop", () => {
    const rows = computeLeagueElo(
      [makeEvent([{ a: "x", b: "y", ga: 2, gb: 0, kind: "forfeit" }])],
      ["x", "y"],
    );
    expect(by(rows, "x").games).toBe(0);
    expect(by(rows, "y").rating).toBe(DEFAULT_ELO.base);
  });

  it("does not rate results that are not confirmed yet", () => {
    for (const status of ["pending", "awaiting_confirmation", "disputed"] as const) {
      const rows = computeLeagueElo(
        [makeEvent([{ a: "x", b: "y", ga: 2, gb: 0, status }])],
        ["x", "y"],
      );
      expect(by(rows, "x").games, status).toBe(0);
    }
  });
});

describe("the table", () => {
  it("lists members who have never played, at the base rating", () => {
    const rows = computeLeagueElo([makeEvent([{ a: "x", b: "y", ga: 2, gb: 0 }])], [
      "x",
      "y",
      "newcomer",
    ]);
    expect(rows).toHaveLength(3);
    expect(by(rows, "newcomer").rating).toBe(DEFAULT_ELO.base);
    expect(by(rows, "newcomer").games).toBe(0);
  });

  it("is ordered by rating, with shared ranks for ties", () => {
    const rows = computeLeagueElo([makeEvent([{ a: "x", b: "y", ga: 2, gb: 0 }])], [
      "x",
      "y",
      "p",
      "q",
    ]);
    expect(rows.map((r) => r.userId)).toEqual(["x", "p", "q", "y"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("counts a player as provisional until they have enough rated matches", () => {
    const many: MatchSpec[] = Array.from({ length: DEFAULT_ELO.provisionalGames }, (_, i) => ({
      a: "x",
      b: `opp${i}`,
      ga: 2,
      gb: 0,
    }));
    const partial = computeLeagueElo([makeEvent(many.slice(0, 3))], ["x"]);
    expect(by(partial, "x").provisional).toBe(true);

    const full = computeLeagueElo([makeEvent(many)], ["x"]);
    expect(by(full, "x").games).toBe(DEFAULT_ELO.provisionalGames);
    expect(by(full, "x").provisional).toBe(false);
  });

  it("tracks a peak that a later loss cannot lower", () => {
    const rows = computeLeagueElo(
      [
        makeEvent(
          [
            { a: "x", b: "y", ga: 2, gb: 0 },
            { a: "x", b: "y", ga: 0, gb: 2 },
            { a: "x", b: "y", ga: 0, gb: 2 },
          ],
          "ev_1",
        ),
      ],
      ["x", "y"],
    );
    const x = by(rows, "x");
    expect(x.peak).toBeGreaterThan(x.rating);
    expect(x.wins).toBe(1);
    expect(x.losses).toBe(2);
  });

  it("orders matches across events chronologically", () => {
    // The same two results in the opposite file order must rate identically.
    const early = makeEvent([{ a: "x", b: "y", ga: 2, gb: 0 }], "ev_a", "2026-01-01T00:00:00.000Z");
    const late = makeEvent([{ a: "x", b: "y", ga: 0, gb: 2 }], "ev_b", "2026-02-01T00:00:00.000Z");
    const forwards = computeLeagueElo([early, late], ["x", "y"]);
    const backwards = computeLeagueElo([late, early], ["x", "y"]);
    expect(by(forwards, "x").rating).toBe(by(backwards, "x").rating);
  });
});
