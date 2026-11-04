import type { MatchKind, MatchStatus, NexusEvent, Pairing, UserId } from "./types";

export interface MatchHistoryEntry {
  eventId: string;
  eventName: string;
  leagueId: string;
  roundNumber: number;
  /** When the result was settled, falling back to when the round was paired. */
  at: string;
  /** Null for a bye. */
  opponentId: UserId | null;
  kind: MatchKind;
  status: MatchStatus;
  /** Games won by the viewer and by their opponent. */
  mine: number;
  theirs: number;
  result: "win" | "loss" | "draw" | "bye" | "pending";
}

export interface HistorySummary {
  events: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  gamesWon: number;
  gamesLost: number;
  opponents: number;
}

function entryFor(
  event: NexusEvent,
  pairing: Pairing,
  roundCreatedAt: string,
  userId: UserId,
): MatchHistoryEntry | null {
  const iAmA = pairing.a === userId;
  if (!iAmA && pairing.b !== userId) return null;

  const base = {
    eventId: event.id,
    eventName: event.name,
    leagueId: event.leagueId,
    roundNumber: pairing.roundNumber,
    at: pairing.resolvedAt ?? roundCreatedAt,
    kind: pairing.kind,
    status: pairing.status,
  };

  if (pairing.kind === "bye")
    return { ...base, opponentId: null, mine: 0, theirs: 0, result: "bye" };

  const opponentId = iAmA ? pairing.b : pairing.a;
  if (pairing.status !== "confirmed" || !pairing.report)
    return { ...base, opponentId, mine: 0, theirs: 0, result: "pending" };

  const mine = iAmA ? pairing.report.score.a : pairing.report.score.b;
  const theirs = iAmA ? pairing.report.score.b : pairing.report.score.a;
  return {
    ...base,
    opponentId,
    mine,
    theirs,
    result: mine > theirs ? "win" : mine < theirs ? "loss" : "draw",
  };
}

/** Every match the given player has been in, across one event. */
export function matchHistoryForEvent(event: NexusEvent, userId: UserId): MatchHistoryEntry[] {
  const out: MatchHistoryEntry[] = [];
  for (const round of event.rounds) {
    for (const pairing of round.pairings) {
      const entry = entryFor(event, pairing, round.createdAt, userId);
      if (entry) out.push(entry);
    }
  }
  return out;
}

/**
 * Every match across many events, most recent first.
 *
 * Cancelled events are left out entirely, as if they never happened: no
 * matches, and they do not count toward the event total either.
 */
export function matchHistory(events: NexusEvent[], userId: UserId): MatchHistoryEntry[] {
  return events
    .filter((e) => e.status !== "cancelled")
    .flatMap((e) => matchHistoryForEvent(e, userId))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function summarize(entries: MatchHistoryEntry[]): HistorySummary {
  const opponents = new Set<UserId>();
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let byes = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  let matches = 0;
  const events = new Set<string>();

  for (const e of entries) {
    events.add(e.eventId);
    if (e.result === "pending") continue;
    if (e.result === "bye") {
      byes += 1;
      continue;
    }
    matches += 1;
    if (e.opponentId) opponents.add(e.opponentId);
    gamesWon += e.mine;
    gamesLost += e.theirs;
    if (e.result === "win") wins += 1;
    else if (e.result === "loss") losses += 1;
    else draws += 1;
  }
  return {
    events: events.size,
    matches,
    wins,
    losses,
    draws,
    byes,
    gamesWon,
    gamesLost,
    opponents: opponents.size,
  };
}

export function recordString(s: Pick<HistorySummary, "wins" | "losses" | "draws">): string {
  return s.draws > 0 ? `${s.wins}-${s.losses}-${s.draws}` : `${s.wins}-${s.losses}`;
}
