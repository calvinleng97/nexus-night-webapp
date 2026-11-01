import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  pairRound,
  standingsOrder,
  type PairingPlayer,
  type PairingPriority,
} from "@/lib/domain/pairing";

const WIN = 3;

function player(id: string, pts = 0, opponents: string[] = [], byes = 0): PairingPlayer {
  return { userId: id, matchPoints: pts, opponents, byes };
}

/** Walk a whole event, choosing winners with `pick`, and report what happened. */
function simulate(
  n: number,
  rounds: number,
  pick: (a: string, b: string, round: number) => string,
  seed = 12345,
  priority: PairingPriority = "record",
) {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const pts = new Map(ids.map((id) => [id, 0]));
  const opps = new Map(ids.map((id) => [id, [] as string[]]));
  const byes = new Map(ids.map((id) => [id, 0]));
  let rematches = 0;
  let maxByes = 0;

  for (let r = 1; r <= rounds; r++) {
    const input = ids.map((id) => player(id, pts.get(id)!, opps.get(id)!, byes.get(id)!));
    const out = pairRound(input, { seed: seed + r, policy: { priority } });

    const seen = new Set<string>();
    for (const pr of out.pairs) {
      expect(seen.has(pr.a), `${pr.a} paired twice in round ${r}`).toBe(false);
      expect(seen.has(pr.b), `${pr.b} paired twice in round ${r}`).toBe(false);
      seen.add(pr.a);
      seen.add(pr.b);
      if (pr.rematch) rematches++;
      opps.get(pr.a)!.push(pr.b);
      opps.get(pr.b)!.push(pr.a);
      const winner = pick(pr.a, pr.b, r);
      pts.set(winner, pts.get(winner)! + WIN);
    }
    if (out.bye !== null) {
      expect(seen.has(out.bye)).toBe(false);
      seen.add(out.bye);
      byes.set(out.bye, byes.get(out.bye)! + 1);
      pts.set(out.bye, pts.get(out.bye)! + WIN);
    }
    // Everyone must be accounted for: paired, or holding the bye.
    expect(seen.size, `round ${r} left players unpaired`).toBe(n);
    maxByes = Math.max(maxByes, ...[...byes.values()]);
  }
  return { rematches, maxByes, pts, byes };
}

describe("policy defaults", () => {
  it("defaults to strict record-pairing", () => {
    expect(DEFAULT_POLICY.priority).toBe("record");
  });
});

describe("strict record-pairing dominates rematch avoidance", () => {
  // Two 6-point players who have already met, and two 0-point players who have
  // not. Keeping records together means replaying a-b; avoiding the rematch
  // means pairing 6-pointers against 0-pointers.
  const field = () => [
    player("a", 6, ["b"]),
    player("b", 6, ["a"]),
    player("c", 0, []),
    player("d", 0, []),
  ];

  it("record priority accepts the rematch to keep records together", () => {
    const out = pairRound(field(), { seed: 4, policy: { priority: "record" } });
    expect(out.recordGap).toBe(0);
    expect(out.pairs.filter((p) => p.rematch)).toHaveLength(1);
    const ab = out.pairs.find((p) => [p.a, p.b].includes("a"));
    expect([ab!.a, ab!.b].sort()).toEqual(["a", "b"]);
    expect(out.warnings.join(" ")).toMatch(/equal records/i);
  });

  it("avoid-rematch priority crosses records instead", () => {
    const out = pairRound(field(), { seed: 4, policy: { priority: "avoid-rematch" } });
    expect(out.pairs.filter((p) => p.rematch)).toHaveLength(0);
    expect(out.recordGap).toBe(72); // two pairs, 6-point gap each
    expect(out.warnings.join(" ")).toMatch(/crossed records/i);
  });
});

describe("the greedy counterexample", () => {
  // Greedy "pair with the first opponent you haven't met" strands itself here:
  // it reaches the last two players and finds they have already played.
  const field = () => [
    player("p0", 6, ["p1", "p2"]),
    player("p4", 6, ["p1", "p5"]),
    player("p2", 3, ["p0", "p3"]),
    player("p3", 3, ["p2", "p5"]),
    player("p1", 0, ["p0", "p4"]),
    player("p5", 0, ["p3", "p4"]),
  ];

  it("record priority pairs every player within their own record", () => {
    const out = pairRound(field(), { seed: 7 });
    expect(out.pairs).toHaveLength(3);
    expect(out.bye).toBeNull();
    expect(out.recordGap).toBe(0);
    // p2 and p3 are the only two 3-pointers and have already met, so strict
    // record-pairing must replay them. That is the documented trade-off.
    expect(out.pairs.filter((p) => p.rematch)).toHaveLength(1);
  });

  it("avoid-rematch priority finds the rematch-free pairing greedy misses", () => {
    const out = pairRound(field(), { seed: 7, policy: { priority: "avoid-rematch" } });
    expect(out.pairs).toHaveLength(3);
    expect(out.pairs.filter((p) => p.rematch)).toHaveLength(0);
  });
});

describe("record gap is minimal per round", () => {
  // Pairing adjacent players in standings order is the textbook Swiss fold and
  // a valid upper bound on achievable record gap. The solver must never do
  // worse than it.
  it("never beaten by adjacent standings-order pairing", () => {
    for (let trial = 0; trial < 300; trial++) {
      let s = trial * 2654435761 + 7;
      const rand = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
      const n = 4 + Math.floor(rand() * 13);
      const players = Array.from({ length: n }, (_, i) =>
        player(`p${i}`, 3 * Math.floor(rand() * 4), []),
      );
      const out = pairRound(players, { seed: trial });

      const ordered = standingsOrder(players, trial);
      const pool = out.bye ? ordered.filter((p) => p.userId !== out.bye) : ordered;
      let fold = 0;
      for (let i = 0; i + 1 < pool.length; i += 2) {
        const d = pool[i]!.matchPoints - pool[i + 1]!.matchPoints;
        fold += d * d;
      }
      expect(out.recordGap).toBeLessThanOrEqual(fold);
    }
  });
});

describe("3-round events never deadlock and never double-bye", () => {
  // Exhaustive over win/loss paths. These hold under BOTH policies.
  for (const priority of ["record", "avoid-rematch"] as const) {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      it(`${priority}, n=${n}: all outcome paths stay legal`, () => {
        let worstByes = 0;
        const paths = 2 ** (3 * Math.ceil(n / 2));
        const step = Math.max(1, Math.floor(paths / 512));
        for (let mask = 0; mask < paths; mask += step) {
          let bit = 0;
          const res = simulate(
            n,
            3,
            (a, b) => {
              const choose = (mask >> bit) & 1;
              bit = (bit + 1) % 30;
              return choose === 0 ? a : b;
            },
            12345,
            priority,
          );
          worstByes = Math.max(worstByes, res.maxByes);
        }
        // Proven feasible for n >= 3: no second bye is ever required.
        expect(worstByes).toBeLessThanOrEqual(1);
      });
    }
  }

  for (const n of [9, 12, 15, 16, 23, 32]) {
    it(`n=${n}: randomized paths stay legal and need no rematches`, () => {
      let worstRematches = 0;
      let worstByes = 0;
      for (let trial = 0; trial < 40; trial++) {
        let s = trial * 2654435761;
        const rand = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
        const res = simulate(n, 3, (a, b) => (rand() < 0.5 ? a : b), 1000 + trial);
        worstRematches = Math.max(worstRematches, res.rematches);
        worstByes = Math.max(worstByes, res.maxByes);
      }
      expect(worstByes).toBeLessThanOrEqual(1);
      // From 7 players up there is enough room that strict record-pairing
      // costs nothing: measured zero rematches across every seed here.
      expect(worstRematches).toBe(0);
    });
  }

  it("small fields are where strict record-pairing costs rematches", () => {
    // Documents the trade-off rather than pretending it away.
    let total = 0;
    for (let trial = 0; trial < 30; trial++) {
      let s = trial * 48271 + 11;
      const rand = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
      total += simulate(4, 3, (a, b) => (rand() < 0.5 ? a : b), 500 + trial).rematches;
    }
    // 4 players over 3 rounds is a full round robin, so round 3 generally has
    // to replay the two players sharing the middle record.
    expect(total).toBeGreaterThan(0);
  });
});

describe("degenerate field sizes", () => {
  it("n=1 gives a bye and warns rather than throwing", () => {
    const out = pairRound([player("solo")], { seed: 1 });
    expect(out.bye).toBe("solo");
    expect(out.pairs).toHaveLength(0);
  });

  it("n=2 pairs the only possible match in round 1", () => {
    const out = pairRound([player("a"), player("b")], { seed: 1 });
    expect(out.pairs).toHaveLength(1);
    expect(out.bye).toBeNull();
    expect(out.pairs[0]!.rematch).toBe(false);
  });

  it("n=2 round 2 is a forced rematch under either policy, reported not refused", () => {
    for (const priority of ["record", "avoid-rematch"] as const) {
      const out = pairRound([player("a", 3, ["b"]), player("b", 0, ["a"])], {
        seed: 1,
        policy: { priority },
      });
      expect(out.pairs).toHaveLength(1);
      expect(out.pairs[0]!.rematch).toBe(true);
      expect(out.warnings.join(" ")).toMatch(/rematch/i);
    }
  });

  it("n=0 is a no-op", () => {
    const out = pairRound([], { seed: 1 });
    expect(out.pairs).toHaveLength(0);
    expect(out.bye).toBeNull();
  });
});

describe("bye selection", () => {
  it("never hands a second bye to someone while a fresh player exists", () => {
    const players = [
      player("a", 6, ["b", "c"], 0),
      player("b", 3, ["a"], 1),
      player("c", 3, ["a"], 1),
      player("d", 0, [], 1),
      player("e", 0, [], 0),
    ];
    const out = pairRound(players, { seed: 3 });
    expect(["a", "e"]).toContain(out.bye);
  });

  it("prefers the lowest-ranked eligible player when costs tie", () => {
    const players = [player("top", 6, []), player("mid", 3, []), player("low", 0, [])];
    const out = pairRound(players, { seed: 5 });
    expect(out.bye).toBe("low");
  });

  it("pairs within records when it can", () => {
    const players = [player("w1", 3, []), player("w2", 3, []), player("l1", 0, []), player("l2", 0, [])];
    const out = pairRound(players, { seed: 11 });
    expect(out.recordGap).toBe(0);
    const byId = new Map(players.map((p) => [p.userId, p.matchPoints]));
    for (const pr of out.pairs) expect(byId.get(pr.a)).toBe(byId.get(pr.b));
  });

  it("uses the bye to even out an odd record group", () => {
    // Three 3-pointers and two 0-pointers: giving the bye to a 0-pointer would
    // leave an odd top group, so the cheapest outcome pairs within records.
    const players = [
      player("a", 3, []),
      player("b", 3, []),
      player("c", 3, []),
      player("d", 0, []),
      player("e", 0, []),
    ];
    const out = pairRound(players, { seed: 9 });
    expect(out.recordGap).toBe(0);
    expect(["a", "b", "c"]).toContain(out.bye);
  });
});
