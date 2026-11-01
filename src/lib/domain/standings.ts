import { MATCH_POINTS, type NexusEvent, type Pairing, type Standing, type UserId } from "./types";
import type { PairingPlayer } from "./pairing";

/** Outcome of a single pairing from one player's perspective. */
type Side = "a" | "b";

function outcomeFor(p: Pairing, side: Side): "win" | "loss" | "draw" | "bye" | null {
  if (p.status !== "confirmed") return null;
  if (p.kind === "bye") return side === "a" ? "bye" : null;
  if (!p.report) {
    // A forfeit with no recorded score: the present player wins.
    if (p.kind === "forfeit") return "win";
    return null;
  }
  const { a, b } = p.report.score;
  if (a === b) return "draw";
  const aWon = a > b;
  if (side === "a") return aWon ? "win" : "loss";
  return aWon ? "loss" : "win";
}

/**
 * Standings are records only — match points, W/L/D, games, byes. No
 * tiebreakers are computed and no champion is declared: players on equal
 * match points share a rank. Every underlying game score is kept on disk, so
 * tiebreakers like opponent match-win % remain computable later from the data.
 */
export function computeStandings(event: NexusEvent): Standing[] {
  const base = new Map<UserId, Standing>();
  for (const pl of event.players) {
    base.set(pl.userId, {
      userId: pl.userId,
      matchPoints: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      byes: 0,
      gamesWon: 0,
      gamesLost: 0,
      opponents: [],
      dropped: pl.droppedAfterRound !== null,
      rank: 0,
    });
  }

  for (const round of event.rounds) {
    for (const p of round.pairings) {
      const sides: Array<[UserId, Side]> = p.b === null ? [[p.a, "a"]] : [[p.a, "a"], [p.b, "b"]];
      for (const [userId, side] of sides) {
        const s = base.get(userId);
        if (!s) continue;
        const res = outcomeFor(p, side);
        if (res === null) continue;
        if (res === "bye") {
          s.byes += 1;
          s.matchPoints += MATCH_POINTS.win;
          continue;
        }
        const opp = side === "a" ? p.b : p.a;
        if (opp) s.opponents.push(opp);
        if (p.report) {
          const own = side === "a" ? p.report.score.a : p.report.score.b;
          const other = side === "a" ? p.report.score.b : p.report.score.a;
          s.gamesWon += own;
          s.gamesLost += other;
        }
        if (res === "win") {
          s.wins += 1;
          s.matchPoints += MATCH_POINTS.win;
        } else if (res === "loss") {
          s.losses += 1;
          s.matchPoints += MATCH_POINTS.loss;
        } else {
          s.draws += 1;
          s.matchPoints += MATCH_POINTS.draw;
        }
      }
    }
  }

  // Stable display order: match points desc, then join order (not a tiebreak,
  // just a deterministic way to print equal records).
  const joinOrder = new Map(event.players.map((p, i) => [p.userId, i]));
  const rows = [...base.values()].sort(
    (x, y) =>
      y.matchPoints - x.matchPoints ||
      (joinOrder.get(x.userId) ?? 0) - (joinOrder.get(y.userId) ?? 0),
  );

  // Shared ranks: equal match points get the same rank number.
  let rank = 0;
  let prevPoints: number | null = null;
  rows.forEach((row, i) => {
    if (prevPoints === null || row.matchPoints !== prevPoints) {
      rank = i + 1;
      prevPoints = row.matchPoints;
    }
    row.rank = rank;
  });
  return rows;
}

/** True when more than one player shares the top rank. */
export function hasSharedLead(standings: Standing[]): boolean {
  const top = standings.filter((s) => s.rank === 1);
  return top.length > 1;
}

/** Build pairing inputs for the next round from current standings. */
export function toPairingPlayers(event: NexusEvent, standings: Standing[]): PairingPlayer[] {
  const byId = new Map(standings.map((s) => [s.userId, s]));
  return event.players
    .filter((p) => p.droppedAfterRound === null)
    .map((p) => {
      const s = byId.get(p.userId);
      return {
        userId: p.userId,
        matchPoints: s?.matchPoints ?? 0,
        opponents: s?.opponents ?? [],
        byes: s?.byes ?? 0,
      };
    });
}

export function recordLabel(s: Standing): string {
  return s.draws > 0 ? `${s.wins}-${s.losses}-${s.draws}` : `${s.wins}-${s.losses}`;
}
