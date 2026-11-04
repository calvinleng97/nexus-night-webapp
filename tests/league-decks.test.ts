import { describe, expect, it } from "vitest";
import { parseDecklist, snapshotDeck } from "@/lib/domain/deck";
import {
  leagueDeckHistory,
  legendUsage,
  summarizeLeagueDecks,
} from "@/lib/domain/league-decks";
import {
  cancelEvent,
  confirmResult,
  currentRound,
  emptyEvent,
  startEvent,
  submitResult,
} from "@/lib/domain/event-machine";
import type { Deck, NexusEvent, RegisteredDeck } from "@/lib/domain/types";

function makeDeck(id: string, ownerId: string, legend: string, name = legend): Deck {
  const source = `Legend:\n1 ${legend}\n\nMainDeck:\n3 Gust\n2 Defy\n\nRunes:\n6 Calm Rune\n`;
  const parsed = parseDecklist(source);
  if (!parsed.ok) throw new Error(parsed.error);
  return {
    id,
    ownerId,
    name,
    legend: parsed.deck.legend,
    champions: parsed.deck.champions,
    mainDeck: parsed.deck.mainDeck,
    battlefields: parsed.deck.battlefields,
    runes: parsed.deck.runes,
    sideboard: parsed.deck.sideboard,
    source,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeEvent(opts: {
  id: string;
  name: string;
  players: Array<{ userId: string; deck: RegisteredDeck | null }>;
  scheduledFor?: string | null;
}): NexusEvent {
  const e = emptyEvent({
    id: opts.id,
    leagueId: "lg_1",
    name: opts.name,
    createdBy: "mgr",
    totalRounds: 1,
    seed: 7,
    scheduledFor: opts.scheduledFor ?? null,
  });
  e.players = opts.players.map((p) => ({
    userId: p.userId,
    joinedAt: "2026-01-01T00:00:00.000Z",
    deck: p.deck,
    droppedAfterRound: null,
  }));
  return e;
}

/** Start the event and settle round 1 with player A winning every match 2-0. */
function play(event: NexusEvent): NexusEvent {
  const started = startEvent(event, "mgr");
  if (!started.ok) throw new Error(started.error);
  let e = started.value.event;
  for (const p of currentRound(e)!.pairings) {
    if (p.b === null) continue;
    const sub = submitResult(e, p.id, p.a, { a: 2, b: 0 });
    if (!sub.ok) throw new Error(sub.error);
    e = sub.value.event;
    const open = currentRound(e)!.pairings.find((x) => x.id === p.id);
    if (open?.status === "awaiting_confirmation") {
      const conf = confirmResult(e, p.id, p.b);
      if (!conf.ok) throw new Error(conf.error);
      e = conf.value.event;
    }
  }
  return e;
}

const riven = makeDeck("dk_riven", "p0", "Riven, The Exile");
const vex = makeDeck("dk_vex", "p1", "Vex, Apathetic");
const jinx = makeDeck("dk_jinx", "p0", "Jinx, Loose Cannon", "Jinx burn");

describe("league deck history", () => {
  it("leaves out a cancelled event as if it never happened", () => {
    const kept = play(
      makeEvent({
        id: "ev_1",
        name: "Night one",
        scheduledFor: "2026-03-01T19:00",
        players: [
          { userId: "p0", deck: snapshotDeck(riven) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );
    // Started and under way, so it would count as played if not cancelled.
    const started = startEvent(
      makeEvent({
        id: "ev_2",
        name: "Night two",
        scheduledFor: "2026-03-08T19:00",
        players: [
          { userId: "p0", deck: snapshotDeck(jinx) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
      "mgr",
    );
    if (!started.ok) throw new Error(started.error);
    const cancelled = cancelEvent(started.value.event, "mgr", true);
    if (!cancelled.ok) throw new Error(cancelled.error);

    const history = leagueDeckHistory([kept, cancelled.value.event], ["p0", "p1"]);
    expect(history.find((h) => h.userId === "p0")!.decks.map((d) => d.deckId)).toEqual([
      "dk_riven",
    ]);
    expect(history.find((h) => h.userId === "p1")!.events).toBe(1);
  });

  it("lists every deck a player has played, newest first", () => {
    const first = play(
      makeEvent({
        id: "ev_1",
        name: "Night one",
        scheduledFor: "2026-03-01T19:00",
        players: [
          { userId: "p0", deck: snapshotDeck(riven) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );
    const second = play(
      makeEvent({
        id: "ev_2",
        name: "Night two",
        scheduledFor: "2026-03-08T19:00",
        players: [
          { userId: "p0", deck: snapshotDeck(jinx) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );

    const history = leagueDeckHistory([first, second], ["p0", "p1"]);
    const p0 = history.find((h) => h.userId === "p0")!;
    expect(p0.decks.map((d) => d.deckId)).toEqual(["dk_jinx", "dk_riven"]);
    expect(p0.events).toBe(2);
    expect(p0.eventsWithoutDeck).toBe(0);
  });

  it("groups repeat appearances of one deck and adds up its record", () => {
    const first = play(
      makeEvent({
        id: "ev_1",
        name: "Night one",
        scheduledFor: "2026-03-01T19:00",
        players: [
          { userId: "p0", deck: snapshotDeck(riven) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );
    const second = play(
      makeEvent({
        id: "ev_2",
        name: "Night two",
        scheduledFor: "2026-03-08T19:00",
        players: [
          { userId: "p0", deck: snapshotDeck(riven) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );

    const history = leagueDeckHistory([first, second], ["p0", "p1"]);
    const p0deck = history.find((h) => h.userId === "p0")!.decks[0]!;
    expect(p0deck.deckId).toBe("dk_riven");
    expect(p0deck.outings.map((o) => o.eventId)).toEqual(["ev_2", "ev_1"]);
    // Player A wins every match in `play`, and p0 is seeded first.
    expect(p0deck.wins + p0deck.losses).toBe(2);
    expect(p0deck.outings).toHaveLength(2);

    const p1deck = history.find((h) => h.userId === "p1")!.decks[0]!;
    expect(p1deck.wins + p1deck.losses).toBe(2);
    expect(p1deck.wins).toBe(2 - p0deck.wins);
  });

  it("carries the cards, so a list can be shown from the league page", () => {
    const event = play(
      makeEvent({
        id: "ev_1",
        name: "Night one",
        players: [
          { userId: "p0", deck: snapshotDeck(riven) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );
    const deck = leagueDeckHistory([event])[0]!.decks[0]!;
    expect(deck.snapshot.mainDeck).toEqual([
      { count: 3, name: "Gust" },
      { count: 2, name: "Defy" },
    ]);
    expect(deck.snapshot.runes).toEqual([{ count: 6, name: "Calm Rune" }]);
    expect(deck.snapshot.source).toContain("3 Gust");
  });

  it("ignores draft events, which nobody has played yet", () => {
    const draft = makeEvent({
      id: "ev_draft",
      name: "Upcoming",
      players: [{ userId: "p0", deck: snapshotDeck(riven) }],
    });
    expect(draft.status).toBe("draft");

    const history = leagueDeckHistory([draft], ["p0"]);
    expect(history[0]!.decks).toHaveLength(0);
    expect(history[0]!.events).toBe(0);
    expect(summarizeLeagueDecks(history).decks).toBe(0);
  });

  it("counts events a player turned up to without a registered deck", () => {
    const event = play(
      makeEvent({
        id: "ev_1",
        name: "Night one",
        players: [
          { userId: "p0", deck: snapshotDeck(riven) },
          { userId: "p1", deck: null },
        ],
      }),
    );
    const history = leagueDeckHistory([event], ["p0", "p1"]);
    const p1 = history.find((h) => h.userId === "p1")!;
    expect(p1.decks).toHaveLength(0);
    expect(p1.events).toBe(1);
    expect(p1.eventsWithoutDeck).toBe(1);
    expect(summarizeLeagueDecks(history).unregistered).toBe(1);
  });

  it("includes members who have registered nothing, sorted last", () => {
    const event = play(
      makeEvent({
        id: "ev_1",
        name: "Night one",
        players: [
          { userId: "p0", deck: snapshotDeck(riven) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );
    const history = leagueDeckHistory([event], ["p0", "p1", "p_lurker"]);
    expect(history).toHaveLength(3);
    expect(history[history.length - 1]!.userId).toBe("p_lurker");
    expect(history[history.length - 1]!.lastPlayedAt).toBeNull();
  });

  it("keeps a snapshot whose cards were never recorded, rather than dropping it", () => {
    const unrecorded: RegisteredDeck = {
      deckId: "dk_gone",
      name: "Lost list",
      legend: "Ahri, Nine-Tailed",
      champions: [],
      mainDeck: [],
      battlefields: [],
      runes: [],
      sideboard: [],
      source: "",
      registeredAt: "2026-02-01T00:00:00.000Z",
    };
    const event = play(
      makeEvent({
        id: "ev_1",
        name: "Night one",
        players: [
          { userId: "p0", deck: unrecorded },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );
    const deck = leagueDeckHistory([event], ["p0"])[0]!.decks[0]!;
    expect(deck.name).toBe("Lost list");
    expect(deck.legend).toBe("Ahri, Nine-Tailed");
    expect(deck.snapshot.mainDeck).toEqual([]);
  });

  it("prefers a later registration that has the cards over an earlier bare one", () => {
    const bare: RegisteredDeck = { ...snapshotDeck(riven, "2026-02-01T00:00:00.000Z") };
    bare.mainDeck = [];
    bare.runes = [];
    bare.champions = [];
    bare.battlefields = [];
    bare.sideboard = [];
    bare.source = "";

    const first = play(
      makeEvent({
        id: "ev_1",
        name: "Night one",
        scheduledFor: "2026-03-01T19:00",
        players: [
          { userId: "p0", deck: bare },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );
    const second = play(
      makeEvent({
        id: "ev_2",
        name: "Night two",
        scheduledFor: "2026-03-08T19:00",
        players: [
          { userId: "p0", deck: snapshotDeck(riven, "2026-03-08T19:00:00.000Z") },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );

    const deck = leagueDeckHistory([first, second], ["p0"]).find((h) => h.userId === "p0")!
      .decks[0]!;
    expect(deck.outings).toHaveLength(2);
    expect(deck.snapshot.mainDeck).toHaveLength(2);
  });
});

describe("league deck summary", () => {
  it("counts decks, legends, players and events", () => {
    const first = play(
      makeEvent({
        id: "ev_1",
        name: "Night one",
        scheduledFor: "2026-03-01T19:00",
        players: [
          { userId: "p0", deck: snapshotDeck(riven) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );
    const second = play(
      makeEvent({
        id: "ev_2",
        name: "Night two",
        scheduledFor: "2026-03-08T19:00",
        players: [
          { userId: "p0", deck: snapshotDeck(jinx) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );

    const summary = summarizeLeagueDecks(leagueDeckHistory([first, second], ["p0", "p1"]));
    expect(summary.decks).toBe(3);
    expect(summary.legends).toBe(3);
    expect(summary.players).toBe(2);
    expect(summary.events).toBe(2);
  });

  it("ranks legends by how often they have been brought", () => {
    const first = play(
      makeEvent({
        id: "ev_1",
        name: "Night one",
        scheduledFor: "2026-03-01T19:00",
        players: [
          { userId: "p0", deck: snapshotDeck(riven) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );
    const second = play(
      makeEvent({
        id: "ev_2",
        name: "Night two",
        scheduledFor: "2026-03-08T19:00",
        players: [
          { userId: "p0", deck: snapshotDeck(riven) },
          { userId: "p1", deck: snapshotDeck(vex) },
        ],
      }),
    );

    const usage = legendUsage(leagueDeckHistory([first, second], ["p0", "p1"]));
    expect(usage.map((u) => u.legend)).toEqual(["Riven, The Exile", "Vex, Apathetic"]);
    for (const u of usage) {
      expect(u.outings).toBe(2);
      expect(u.decks).toBe(1);
      expect(u.players).toBe(1);
    }
  });
});
