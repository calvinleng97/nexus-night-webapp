import { describe, expect, it } from "vitest";
import { cancelEvent, emptyEvent, startEvent } from "@/lib/domain/event-machine";
import { matchHistory, summarize } from "@/lib/domain/history";
import type { NexusEvent } from "@/lib/domain/types";

function runningEvent(id: string): NexusEvent {
  const e = emptyEvent({
    id,
    leagueId: "lg_test",
    name: id,
    createdBy: "mgr",
    totalRounds: 3,
    seed: 7,
  });
  e.players = ["p0", "p1"].map((userId) => ({
    userId,
    joinedAt: e.createdAt,
    deck: null,
    droppedAfterRound: null,
  }));
  const started = startEvent(e, "mgr");
  if (!started.ok) throw new Error(started.error);
  return started.value.event;
}

describe("match history", () => {
  it("leaves out cancelled events as if they never happened", () => {
    const kept = runningEvent("ev_kept");
    const res = cancelEvent(runningEvent("ev_gone"), "mgr", {
      revertElo: false,
      revertAllowed: true,
    });
    if (!res.ok) throw new Error(res.error);

    const entries = matchHistory([kept, res.value.event], "p0");
    expect(entries.map((e) => e.eventId)).toEqual(["ev_kept"]);
    expect(summarize(entries).events).toBe(1);
  });
});
