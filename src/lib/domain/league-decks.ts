/**
 * Which decks each player has actually played in a league.
 *
 * Built entirely from the snapshots events keep on their players, never from
 * the decks people currently have saved: this answers "what did they bring",
 * which is a question about the past, so deleting a deck does not erase it
 * from the league's record.
 *
 * Draft events are excluded on purpose. A deck registered for an event that
 * has not started has not been played yet, and showing it would let anyone
 * scout the field before pairings exist.
 */

import { computeStandings } from "./standings";
import type { DeckId, EventStatus, NexusEvent, RegisteredDeck, Standing, UserId } from "./types";

/** One event a deck was played in, with the record it put up there. */
export interface DeckOuting {
  eventId: string;
  eventName: string;
  /** When it happened: the scheduled date if the event has one, else created. */
  at: string;
  status: EventStatus;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  matchPoints: number;
}

export interface PlayedDeck {
  deckId: DeckId;
  name: string;
  legend: string | null;
  /** The most recent registration, which carries the cards. */
  snapshot: RegisteredDeck;
  /** Newest first. */
  outings: DeckOuting[];
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  lastPlayedAt: string;
}

export interface PlayerDecks {
  userId: UserId;
  /** Newest first. */
  decks: PlayedDeck[];
  /** Started events in this league the player took part in. */
  events: number;
  /** How many of those they registered no deck for. */
  eventsWithoutDeck: number;
  /** Newest outing across all their decks, or null if they have none. */
  lastPlayedAt: string | null;
}

export interface LeagueDeckSummary {
  /** Players who have registered at least one deck. */
  players: number;
  decks: number;
  legends: number;
  events: number;
  /** Player-events where no deck was registered. */
  unregistered: number;
}

export interface LegendUsage {
  legend: string;
  /** Distinct decks built on this Legend. */
  decks: number;
  /** Times it has been brought to an event. */
  outings: number;
  /** Distinct players who have played it. */
  players: number;
}

function whenHappened(event: NexusEvent): string {
  return event.scheduledFor ?? event.startedAt ?? event.createdAt;
}

function blankRecord(): Pick<DeckOuting, "wins" | "losses" | "draws" | "byes" | "matchPoints"> {
  return { wins: 0, losses: 0, draws: 0, byes: 0, matchPoints: 0 };
}

function recordOf(standing: Standing | undefined) {
  if (!standing) return blankRecord();
  return {
    wins: standing.wins,
    losses: standing.losses,
    draws: standing.draws,
    byes: standing.byes,
    matchPoints: standing.matchPoints,
  };
}

/**
 * Every deck every player has played in the league, grouped by player.
 *
 * `memberIds` is optional: pass a league's members to include people who have
 * registered nothing, so a page can show who is still missing a list.
 *
 * A player who swapped decks part-way through an event is credited with the
 * deck they finished on, for the whole of that event's record — the event
 * stores one registration per player, not one per round.
 */
export function leagueDeckHistory(
  events: NexusEvent[],
  memberIds: UserId[] = [],
): PlayerDecks[] {
  const byPlayer = new Map<UserId, PlayerDecks>();
  const ensure = (userId: UserId): PlayerDecks => {
    let row = byPlayer.get(userId);
    if (!row) {
      row = { userId, decks: [], events: 0, eventsWithoutDeck: 0, lastPlayedAt: null };
      byPlayer.set(userId, row);
    }
    return row;
  };
  for (const id of memberIds) ensure(id);

  const played = events.filter((e) => e.status !== "draft");

  for (const event of played) {
    const standings = new Map(computeStandings(event).map((s) => [s.userId, s]));
    const at = whenHappened(event);

    for (const player of event.players) {
      const row = ensure(player.userId);
      row.events += 1;
      if (!player.deck) {
        row.eventsWithoutDeck += 1;
        continue;
      }

      const record = recordOf(standings.get(player.userId));
      const outing: DeckOuting = {
        eventId: event.id,
        eventName: event.name,
        at,
        status: event.status,
        ...record,
      };

      const existing = row.decks.find((d) => d.deckId === player.deck!.deckId);
      if (existing) {
        existing.outings.push(outing);
        existing.wins += record.wins;
        existing.losses += record.losses;
        existing.draws += record.draws;
        existing.byes += record.byes;
        // Keep the newest registration, and prefer one that has the cards.
        const newer = player.deck.registeredAt > existing.snapshot.registeredAt;
        const fillsIn =
          existing.snapshot.mainDeck.length === 0 && player.deck.mainDeck.length > 0;
        if (newer || fillsIn) {
          existing.snapshot = player.deck;
          existing.name = player.deck.name;
          existing.legend = player.deck.legend;
        }
        if (at > existing.lastPlayedAt) existing.lastPlayedAt = at;
      } else {
        row.decks.push({
          deckId: player.deck.deckId,
          name: player.deck.name,
          legend: player.deck.legend,
          snapshot: player.deck,
          outings: [outing],
          wins: record.wins,
          losses: record.losses,
          draws: record.draws,
          byes: record.byes,
          lastPlayedAt: at,
        });
      }
      if (row.lastPlayedAt === null || at > row.lastPlayedAt) row.lastPlayedAt = at;
    }
  }

  for (const row of byPlayer.values()) {
    for (const deck of row.decks) deck.outings.sort((a, b) => b.at.localeCompare(a.at));
    row.decks.sort(
      (a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt) || a.name.localeCompare(b.name),
    );
  }

  // Players who have played most recently first; people with nothing last.
  return [...byPlayer.values()].sort((a, b) => {
    if (a.lastPlayedAt === null && b.lastPlayedAt === null) return 0;
    if (a.lastPlayedAt === null) return 1;
    if (b.lastPlayedAt === null) return -1;
    return b.lastPlayedAt.localeCompare(a.lastPlayedAt);
  });
}

export function summarizeLeagueDecks(history: PlayerDecks[]): LeagueDeckSummary {
  const legends = new Set<string>();
  const eventIds = new Set<string>();
  let decks = 0;
  let players = 0;
  let unregistered = 0;

  for (const row of history) {
    if (row.decks.length > 0) players += 1;
    decks += row.decks.length;
    unregistered += row.eventsWithoutDeck;
    for (const deck of row.decks) {
      if (deck.legend) legends.add(deck.legend);
      for (const outing of deck.outings) eventIds.add(outing.eventId);
    }
  }
  return { players, decks, legends: legends.size, events: eventIds.size, unregistered };
}

/** Which Legends the league is actually playing, most brought first. */
export function legendUsage(history: PlayerDecks[]): LegendUsage[] {
  const map = new Map<string, { decks: number; outings: number; players: Set<UserId> }>();
  for (const row of history) {
    for (const deck of row.decks) {
      if (!deck.legend) continue;
      let entry = map.get(deck.legend);
      if (!entry) {
        entry = { decks: 0, outings: 0, players: new Set() };
        map.set(deck.legend, entry);
      }
      entry.decks += 1;
      entry.outings += deck.outings.length;
      entry.players.add(row.userId);
    }
  }
  return [...map.entries()]
    .map(([legend, e]) => ({
      legend,
      decks: e.decks,
      outings: e.outings,
      players: e.players.size,
    }))
    .sort((a, b) => b.outings - a.outings || a.legend.localeCompare(b.legend));
}
