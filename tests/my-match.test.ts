import { describe, expect, it } from "vitest";
import {
  confirmResult,
  currentRound,
  disputeResult,
  emptyEvent,
  startEvent,
  submitResult,
} from "@/lib/domain/event-machine";
import { disputedCount, headToHead, myMatch, roundProgress } from "@/lib/domain/my-match";
import type { NexusEvent } from "@/lib/domain/types";

function running(playerCount: number): NexusEvent {
  const e = emptyEvent({
    id: "ev_test",
    leagueId: "lg_test",
    name: "Test Night",
    createdBy: "mgr",
    totalRounds: 3,
    seed: 7,
  });
  e.players = Array.from({ length: playerCount }, (_, i) => ({
    userId: `p${i}`,
    joinedAt: new Date().toISOString(),
    deck: null,
    droppedAfterRound: null,
  }));
  const started = startEvent(e, "mgr");
  if (!started.ok) throw new Error(started.error);
  return started.value.event;
}

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe("myMatch", () => {
  it("is null before the event starts and for spectators", () => {
    const e = running(4);
    expect(myMatch({ ...e, status: "draft" }, "p0")).toBeNull();
    expect(myMatch(e, "nobody")).toBeNull();
  });

  it("walks report → waiting / confirm → done from each side", () => {
    let e = running(4);
    const pairing = currentRound(e)!.pairings[0]!;
    const a = pairing.a;
    const b = pairing.b!;

    expect(myMatch(e, a)).toMatchObject({ kind: "report", opponent: b });

    // A reports a 2-1 win.
    e = unwrap(submitResult(e, pairing.id, a, { a: 2, b: 1 })).event;
    expect(myMatch(e, a)).toMatchObject({ kind: "waiting", score: { mine: 2, theirs: 1 } });
    // B sees it from their side.
    expect(myMatch(e, b)).toMatchObject({ kind: "confirm", score: { mine: 1, theirs: 2 } });

    e = unwrap(confirmResult(e, pairing.id, b)).event;
    expect(myMatch(e, b)).toMatchObject({ kind: "done", score: { mine: 1, theirs: 2 } });
  });

  it("reports disputes, and counts them for managers", () => {
    let e = running(4);
    const pairing = currentRound(e)!.pairings[0]!;
    e = unwrap(submitResult(e, pairing.id, pairing.a, { a: 2, b: 0 })).event;
    e = unwrap(disputeResult(e, pairing.id, pairing.b!)).event;
    expect(myMatch(e, pairing.a)?.kind).toBe("disputed");
    expect(disputedCount(e)).toBe(1);
  });

  it("gives the odd player out a bye, which roundProgress leaves out", () => {
    const e = running(5);
    const round = currentRound(e)!;
    const bye = round.pairings.find((p) => p.b === null)!;
    expect(myMatch(e, bye.a)?.kind).toBe("bye");
    expect(roundProgress(round)).toEqual({ done: 0, total: 2 });
  });
});

describe("headToHead", () => {
  it("counts confirmed results from each side, ignoring others and cancelled nights", () => {
    let e = running(4);
    const pairing = currentRound(e)!.pairings[0]!;
    const [a, b] = [pairing.a, pairing.b!];
    expect(headToHead([e], a, b)).toEqual({ wins: 0, losses: 0, draws: 0, matches: 0 });

    e = unwrap(submitResult(e, pairing.id, a, { a: 2, b: 1 })).event;
    // Reported but not confirmed: not a result yet.
    expect(headToHead([e], a, b).matches).toBe(0);
    e = unwrap(confirmResult(e, pairing.id, b)).event;

    expect(headToHead([e], a, b)).toEqual({ wins: 1, losses: 0, draws: 0, matches: 1 });
    expect(headToHead([e], b, a)).toEqual({ wins: 0, losses: 1, draws: 0, matches: 1 });
    // Someone they didn't play.
    const other = currentRound(e)!.pairings.find((p) => p.a !== a && p.a !== b)?.a ?? "nobody";
    expect(headToHead([e], a, other).matches).toBe(0);
    expect(headToHead([{ ...e, status: "cancelled" }], a, b).matches).toBe(0);
  });
});
