import type { NexusEvent, UserId } from "./types";

/**
 * Per-league Elo.
 *
 * Ratings are DERIVED, never stored: they are recomputed from the confirmed
 * results on disk every time they are shown. That keeps them consistent with
 * the data (there is no cached number to drift), and means changing the
 * constants below retroactively re-rates everyone.
 *
 * What counts:
 *   - only `played` matches that reached `confirmed`
 *   - a match outcome of win / draw / loss, scored 1 / 0.5 / 0
 *
 * What does not:
 *   - byes, which have no opponent to rate against
 *   - forfeits from a drop, which say nothing about how either player plays
 *   - anything in a cancelled event, which counts as never having happened
 *
 * Game margin is ignored: 2-0 and 2-1 move a rating identically, the same way
 * standings treat them. The per-game scores are all on disk, so a
 * margin-weighted variant stays possible later without a migration.
 */

export interface EloConfig {
  /** Rating everyone starts from. */
  base: number;
  /** Multiplier once a player is established. */
  k: number;
  /** Larger multiplier while a player is still settling. */
  provisionalK: number;
  /** Rated matches before a player is no longer provisional. */
  provisionalGames: number;
}

export const DEFAULT_ELO: EloConfig = {
  base: 1200,
  k: 24,
  provisionalK: 40,
  provisionalGames: 10,
};

export interface EloRating {
  userId: UserId;
  rating: number;
  /** Rated matches played (byes and forfeits excluded). */
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** Highest rating ever held. */
  peak: number;
  /** Change from the most recent rated match, or null if never rated. */
  lastDelta: number | null;
  /** True while the player has fewer than `provisionalGames` rated matches. */
  provisional: boolean;
  rank: number;
}

/** Probability that `a` beats `b`, by the logistic Elo curve. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

interface RatedMatch {
  eventId: string;
  a: UserId;
  b: UserId;
  /** Player A's result: 1 win, 0.5 draw, 0 loss. */
  scoreA: number;
  order: [string, number, string];
}

/** Pull the rateable matches out of a set of events, in chronological order. */
function ratedMatches(events: NexusEvent[]): RatedMatch[] {
  const out: RatedMatch[] = [];
  for (const event of events) {
    if (event.status === "cancelled") continue;
    const eventAt = event.startedAt ?? event.createdAt;
    for (const round of event.rounds) {
      for (const p of round.pairings) {
        if (p.kind !== "played" || p.status !== "confirmed" || p.b === null || !p.report) continue;
        const { a: ga, b: gb } = p.report.score;
        out.push({
          eventId: event.id,
          a: p.a,
          b: p.b,
          scoreA: ga > gb ? 1 : ga < gb ? 0 : 0.5,
          order: [eventAt, round.number, p.resolvedAt ?? ""],
        });
      }
    }
  }
  return out.sort((x, y) => {
    if (x.order[0] !== y.order[0]) return x.order[0].localeCompare(y.order[0]);
    if (x.order[1] !== y.order[1]) return x.order[1] - y.order[1];
    return x.order[2].localeCompare(y.order[2]);
  });
}

/**
 * Whether an event's Elo changes can be taken back without disturbing anyone
 * else's: true when none of its matches has a rated match from another event
 * after it, i.e. its matches are the most recent the league has rated. An
 * event with no rated matches has nothing to revert, so it always can.
 *
 * Ratings are recomputed from scratch, so reverting an older event would
 * quietly re-rate every match played since. This is the guard against that.
 */
export function canRevertElo(events: NexusEvent[], eventId: string): boolean {
  const matches = ratedMatches(events);
  const first = matches.findIndex((m) => m.eventId === eventId);
  if (first === -1) return true;
  return matches.slice(first).every((m) => m.eventId === eventId);
}

/**
 * Rate every member of a league from that league's events.
 *
 * Members who have not played are returned at `base` so the table is complete.
 * Players appearing in the events but not in `memberIds` (they left the
 * league) still affect their opponents' ratings but are not listed.
 */
export function computeLeagueElo(
  events: NexusEvent[],
  memberIds: UserId[],
  config: EloConfig = DEFAULT_ELO,
): EloRating[] {
  const state = new Map<UserId, EloRating>();
  const ensure = (id: UserId): EloRating => {
    let r = state.get(id);
    if (!r) {
      r = {
        userId: id,
        rating: config.base,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        peak: config.base,
        lastDelta: null,
        provisional: true,
        rank: 0,
      };
      state.set(id, r);
    }
    return r;
  };
  for (const id of memberIds) ensure(id);

  for (const m of ratedMatches(events)) {
    const a = ensure(m.a);
    const b = ensure(m.b);

    // Both updates use the pre-match ratings, so the exchange is symmetric.
    const beforeA = a.rating;
    const beforeB = b.rating;
    const expA = expectedScore(beforeA, beforeB);
    const kA = a.games < config.provisionalGames ? config.provisionalK : config.k;
    const kB = b.games < config.provisionalGames ? config.provisionalK : config.k;

    const deltaA = kA * (m.scoreA - expA);
    const deltaB = kB * (1 - m.scoreA - (1 - expA));

    a.rating = beforeA + deltaA;
    b.rating = beforeB + deltaB;
    a.lastDelta = deltaA;
    b.lastDelta = deltaB;
    a.games += 1;
    b.games += 1;
    a.peak = Math.max(a.peak, a.rating);
    b.peak = Math.max(b.peak, b.rating);

    if (m.scoreA === 1) {
      a.wins += 1;
      b.losses += 1;
    } else if (m.scoreA === 0) {
      a.losses += 1;
      b.wins += 1;
    } else {
      a.draws += 1;
      b.draws += 1;
    }
  }

  const rows = memberIds
    .map((id) => {
      const r = state.get(id)!;
      return {
        ...r,
        rating: Math.round(r.rating),
        peak: Math.round(r.peak),
        lastDelta: r.lastDelta === null ? null : Math.round(r.lastDelta),
        provisional: r.games < config.provisionalGames,
      };
    })
    .sort((x, y) => y.rating - x.rating || y.games - x.games);

  // Shared ranks for equal ratings, matching how standings read.
  let rank = 0;
  let prev: number | null = null;
  rows.forEach((row, i) => {
    if (prev === null || row.rating !== prev) {
      rank = i + 1;
      prev = row.rating;
    }
    row.rank = rank;
  });
  return rows;
}
