import { describe, expect, it } from "vitest";
import {
  cancelEvent,
  confirmResult,
  disputeResult,
  dropPlayer,
  emptyEvent,
  forceCloseRound,
  startEvent,
  submitResult,
  validateScore,
  currentRound,
  pairingForUser,
} from "@/lib/domain/event-machine";
import { computeStandings, recordLabel } from "@/lib/domain/standings";
import type { NexusEvent } from "@/lib/domain/types";

function makeEvent(playerCount: number, rounds = 3): NexusEvent {
  const e = emptyEvent({
    id: "ev_test",
    leagueId: "lg_test",
    name: "Test Night",
    createdBy: "mgr",
    totalRounds: rounds,
    seed: 42,
  });
  e.players = Array.from({ length: playerCount }, (_, i) => ({
    userId: `p${i}`,
    joinedAt: new Date().toISOString(),
    deck: null,
    droppedAfterRound: null,
  }));
  return e;
}

/** Resolve every open match in the current round, player A always winning 2-0. */
function resolveRound(event: NexusEvent): NexusEvent {
  let e = event;
  const round = currentRound(e)!;
  for (const p of round.pairings) {
    if (p.status === "confirmed" || p.b === null) continue;
    const sub = submitResult(e, p.id, p.a, { a: 2, b: 0 });
    expect(sub.ok).toBe(true);
    if (!sub.ok) throw new Error(sub.error);
    e = sub.value.event;
    // Round may have auto-advanced after the last confirm, so re-read it.
    const stillOpen = currentRound(e)!.pairings.find((x) => x.id === p.id);
    if (stillOpen && stillOpen.status === "awaiting_confirmation") {
      const conf = confirmResult(e, p.id, p.b);
      if (!conf.ok) throw new Error(conf.error);
      e = conf.value.event;
    }
  }
  return e;
}

describe("score validation", () => {
  it("accepts legal best-of-three results", () => {
    for (const s of [
      { a: 2, b: 0 },
      { a: 2, b: 1 },
      { a: 1, b: 2 },
      { a: 0, b: 2 },
      { a: 1, b: 1 },
    ])
      expect(validateScore(s).ok).toBe(true);
  });

  it("rejects impossible results", () => {
    expect(validateScore({ a: 3, b: 0 }).ok).toBe(false);
    expect(validateScore({ a: 2, b: 2 }).ok).toBe(false);
    expect(validateScore({ a: -1, b: 1 }).ok).toBe(false);
    expect(validateScore({ a: 1.5, b: 0 }).ok).toBe(false);
  });
});

describe("starting an event", () => {
  it("refuses a non-manager", () => {
    const e = makeEvent(4);
    const res = startEvent(e, "p1");
    expect(res.ok).toBe(false);
  });

  it("refuses a field of one", () => {
    const res = startEvent(makeEvent(1), "mgr");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/at least 2/);
  });

  it("warns that a 2-player event must rematch", () => {
    const res = startEvent(makeEvent(2), "mgr");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.warnings.join(" ")).toMatch(/rematch/i);
  });

  it("pairs round 1 and gives an odd field a bye", () => {
    const res = startEvent(makeEvent(5), "mgr");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const round = currentRound(res.value.event)!;
    expect(round.pairings.filter((p) => p.b === null)).toHaveLength(1);
    expect(round.pairings.filter((p) => p.b !== null)).toHaveLength(2);
    // The bye is pre-confirmed; nobody needs to report it.
    expect(round.pairings.find((p) => p.b === null)!.status).toBe("confirmed");
  });
});

describe("reporting and confirming", () => {
  it("requires the opponent to confirm, not the submitter", () => {
    const started = startEvent(makeEvent(4), "mgr");
    if (!started.ok) throw new Error("setup");
    const e = started.value.event;
    const p = currentRound(e)!.pairings.find((x) => x.b !== null)!;

    const sub = submitResult(e, p.id, p.a, { a: 2, b: 1 });
    if (!sub.ok) throw new Error(sub.error);
    expect(currentRound(sub.value.event)!.pairings.find((x) => x.id === p.id)!.status).toBe(
      "awaiting_confirmation",
    );

    const selfConfirm = confirmResult(sub.value.event, p.id, p.a);
    expect(selfConfirm.ok).toBe(false);

    const oppConfirm = confirmResult(sub.value.event, p.id, p.b!);
    expect(oppConfirm.ok).toBe(true);
  });

  it("confirms when both players submit the same score", () => {
    const started = startEvent(makeEvent(4), "mgr");
    if (!started.ok) throw new Error("setup");
    const e = started.value.event;
    const p = currentRound(e)!.pairings.find((x) => x.b !== null)!;

    // A reports "I won 2-1"; B, not having seen it, reports "I lost 1-2".
    const first = submitResult(e, p.id, p.a, { a: 2, b: 1 });
    if (!first.ok) throw new Error(first.error);
    const second = submitResult(first.value.event, p.id, p.b!, { a: 1, b: 2 });
    if (!second.ok) throw new Error(second.error);

    const stored = currentRound(second.value.event)!.pairings.find((x) => x.id === p.id)!;
    expect(stored.status).toBe("confirmed");
    expect(stored.report!.score).toEqual({ a: 2, b: 1 });
    expect(stored.report!.submittedBy).toBe(p.a);
    expect(stored.confirmedBy).toBe(p.b);
  });

  it("treats a differing second submission as a counter-claim for the other side", () => {
    const started = startEvent(makeEvent(4), "mgr");
    if (!started.ok) throw new Error("setup");
    const e = started.value.event;
    const p = currentRound(e)!.pairings.find((x) => x.b !== null)!;

    const first = submitResult(e, p.id, p.a, { a: 2, b: 1 });
    if (!first.ok) throw new Error(first.error);
    const second = submitResult(first.value.event, p.id, p.b!, { a: 2, b: 1 });
    if (!second.ok) throw new Error(second.error);

    const stored = currentRound(second.value.event)!.pairings.find((x) => x.id === p.id)!;
    expect(stored.status).toBe("awaiting_confirmation");
    expect(stored.report!.submittedBy).toBe(p.b);
    expect(confirmResult(second.value.event, p.id, p.a).ok).toBe(true);
  });

  it("stores player B's submission from A's perspective", () => {
    const started = startEvent(makeEvent(4), "mgr");
    if (!started.ok) throw new Error("setup");
    const e = started.value.event;
    const p = currentRound(e)!.pairings.find((x) => x.b !== null)!;

    // B reports "I won 2-1", which must be stored as A 1 - B 2.
    const sub = submitResult(e, p.id, p.b!, { a: 2, b: 1 });
    if (!sub.ok) throw new Error(sub.error);
    const stored = currentRound(sub.value.event)!.pairings.find((x) => x.id === p.id)!;
    expect(stored.report!.score).toEqual({ a: 1, b: 2 });
  });

  it("blocks the round while a result is disputed, then a manager resolves it", () => {
    const started = startEvent(makeEvent(2), "mgr");
    if (!started.ok) throw new Error("setup");
    let e = started.value.event;
    const p = currentRound(e)!.pairings[0]!;

    const sub = submitResult(e, p.id, p.a, { a: 2, b: 0 });
    if (!sub.ok) throw new Error(sub.error);
    e = sub.value.event;

    const dis = disputeResult(e, p.id, p.b!);
    if (!dis.ok) throw new Error(dis.error);
    e = dis.value.event;
    expect(currentRound(e)!.pairings[0]!.status).toBe("disputed");
    expect(e.rounds).toHaveLength(1); // did not advance

    const override = submitResult(e, p.id, "mgr", { a: 1, b: 2 });
    if (!override.ok) throw new Error(override.error);
    e = override.value.event;
    expect(e.rounds.length).toBe(2); // manager's result closed the round
    const first = e.rounds[0]!.pairings[0]!;
    expect(first.status).toBe("confirmed");
    expect(first.overriddenBy).toBe("mgr");
  });
});

describe("full event progression", () => {
  for (const n of [3, 4, 5, 6, 7, 8, 9]) {
    it(`n=${n}: auto-advances through 3 rounds and completes`, () => {
      const started = startEvent(makeEvent(n), "mgr");
      if (!started.ok) throw new Error("setup");
      let e = started.value.event;
      for (let r = 1; r <= 3; r++) {
        expect(e.status).toBe(r === 1 ? "running" : "running");
        e = resolveRound(e);
      }
      expect(e.status).toBe("complete");
      expect(e.rounds).toHaveLength(3);
      for (const round of e.rounds) expect(round.closedAt).not.toBeNull();

      // Everyone played or sat out exactly 3 rounds.
      const standings = computeStandings(e);
      for (const s of standings) {
        expect(s.wins + s.losses + s.draws + s.byes).toBe(3);
        expect(s.byes).toBeLessThanOrEqual(1);
      }
      // Match points must equal 3 per win plus 3 per bye.
      for (const s of standings) expect(s.matchPoints).toBe(3 * (s.wins + s.byes) + s.draws);
    });
  }
});

describe("standings arithmetic", () => {
  it("counts a bye as 3 points but not as a win", () => {
    const started = startEvent(makeEvent(3), "mgr");
    if (!started.ok) throw new Error("setup");
    const e = resolveRound(started.value.event);
    const standings = computeStandings(e);
    const withBye = standings.find((s) => s.byes === 1)!;
    expect(withBye.matchPoints).toBe(3);
    expect(withBye.wins).toBe(0);
    expect(recordLabel(withBye)).toBe("0-0");
  });

  it("scores a 1-1 draw as one point each", () => {
    const started = startEvent(makeEvent(2), "mgr");
    if (!started.ok) throw new Error("setup");
    let e = started.value.event;
    const p = currentRound(e)!.pairings[0]!;
    const sub = submitResult(e, p.id, p.a, { a: 1, b: 1 });
    if (!sub.ok) throw new Error(sub.error);
    const conf = confirmResult(sub.value.event, p.id, p.b!);
    if (!conf.ok) throw new Error(conf.error);
    e = conf.value.event;
    for (const s of computeStandings(e)) {
      expect(s.draws).toBe(1);
      expect(s.matchPoints).toBe(1);
    }
  });
});

describe("dropping a player", () => {
  it("gives the opponent a 2-0 forfeit and excludes them from later rounds", () => {
    const started = startEvent(makeEvent(6), "mgr");
    if (!started.ok) throw new Error("setup");
    let e = started.value.event;
    const victim = currentRound(e)!.pairings.find((p) => p.b !== null)!;
    const dropped = victim.a;
    const survivor = victim.b!;

    const res = dropPlayer(e, dropped, "mgr");
    if (!res.ok) throw new Error(res.error);
    e = res.value.event;

    const pairing = e.rounds[0]!.pairings.find((p) => p.id === victim.id)!;
    expect(pairing.kind).toBe("forfeit");
    expect(pairing.status).toBe("confirmed");
    expect(pairing.report!.score).toEqual({ a: 0, b: 2 });

    e = resolveRound(e);
    expect(e.rounds).toHaveLength(2);
    const round2 = e.rounds[1]!;
    const stillPlaying = round2.pairings.flatMap((p) => [p.a, p.b]).filter(Boolean);
    expect(stillPlaying).not.toContain(dropped);
    expect(stillPlaying).toContain(survivor);
  });

  it("refuses a drop from a non-manager", () => {
    const started = startEvent(makeEvent(4), "mgr");
    if (!started.ok) throw new Error("setup");
    expect(dropPlayer(started.value.event, "p0", "p1").ok).toBe(false);
  });

  it("closes the event early when too few players remain", () => {
    const started = startEvent(makeEvent(3), "mgr");
    if (!started.ok) throw new Error("setup");
    let e = resolveRound(started.value.event);
    for (const id of ["p0", "p1"]) {
      const res = dropPlayer(e, id, "mgr");
      if (res.ok) e = res.value.event;
    }
    expect(e.status).toBe("complete");
  });
});

describe("force closing a round", () => {
  it("records unplayed matches as 0-0 and advances", () => {
    const started = startEvent(makeEvent(4), "mgr");
    if (!started.ok) throw new Error("setup");
    const res = forceCloseRound(started.value.event, "mgr");
    if (!res.ok) throw new Error(res.error);
    const e = res.value.event;
    expect(e.rounds).toHaveLength(2);
    for (const p of e.rounds[0]!.pairings) {
      expect(p.status).toBe("confirmed");
      expect(p.overriddenBy).toBe("mgr");
    }
    for (const s of computeStandings(e)) expect(s.draws).toBe(1);
  });

  it("refuses a non-manager", () => {
    const started = startEvent(makeEvent(4), "mgr");
    if (!started.ok) throw new Error("setup");
    expect(forceCloseRound(started.value.event, "p0").ok).toBe(false);
  });
});

describe("pairing lookup", () => {
  it("finds a player's match in the current round", () => {
    const started = startEvent(makeEvent(5), "mgr");
    if (!started.ok) throw new Error("setup");
    const e = started.value.event;
    for (const p of e.players) {
      expect(pairingForUser(currentRound(e)!, p.userId)).not.toBeNull();
    }
  });
});

describe("cancelling an event", () => {
  const live = () => {
    const started = startEvent(makeEvent(4), "mgr");
    if (!started.ok) throw new Error("setup");
    return started.value.event;
  };

  it("cancels a running event", () => {
    const res = cancelEvent(resolveRound(live()), "mgr", true, "2026-01-01T00:00:00.000Z");
    if (!res.ok) throw new Error(res.error);
    expect(res.value.event.status).toBe("cancelled");
    expect(res.value.event.cancelledAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("refuses once later results build on its Elo", () => {
    expect(cancelEvent(live(), "mgr", false).ok).toBe(false);
  });

  it("cancels a draft", () => {
    expect(cancelEvent(makeEvent(4), "mgr", true).ok).toBe(true);
  });

  it("refuses a non-manager, a finished event, and a second cancel", () => {
    expect(cancelEvent(live(), "p0", true).ok).toBe(false);
    expect(cancelEvent({ ...live(), status: "complete" }, "mgr", true).ok).toBe(false);
    const once = cancelEvent(live(), "mgr", true);
    if (!once.ok) throw new Error(once.error);
    expect(cancelEvent(once.value.event, "mgr", true).ok).toBe(false);
  });

  it("takes no more results once cancelled", () => {
    const res = cancelEvent(live(), "mgr", true);
    if (!res.ok) throw new Error(res.error);
    const e = res.value.event;
    const p = currentRound(e)!.pairings.find((x) => x.b !== null)!;
    expect(submitResult(e, p.id, p.a, { a: 2, b: 0 }).ok).toBe(false);
    expect(submitResult(e, p.id, "mgr", { a: 2, b: 0 }).ok).toBe(false);
    expect(dropPlayer(e, p.a, "mgr").ok).toBe(false);
    expect(forceCloseRound(e, "mgr").ok).toBe(false);
  });
});
