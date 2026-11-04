import { currentRound, pairingForUser } from "./event-machine";
import type { GameScore, NexusEvent, Pairing, Round, UserId } from "./types";

/** A score as one player sees it. */
export interface Seen {
  mine: number;
  theirs: number;
}

/** Re-orient a stored (A-perspective) score for one side of a pairing. */
export function seenFrom(score: GameScore, iAmA: boolean): Seen {
  return iAmA ? { mine: score.a, theirs: score.b } : { mine: score.b, theirs: score.a };
}

/**
 * Where a player stands in the current round, phrased as what they need to do.
 *
 * - `report`   — nothing submitted yet: enter the score
 * - `confirm`  — the opponent submitted: agree or dispute
 * - `waiting`  — you submitted: the opponent has to confirm
 * - `disputed` — a manager has to settle it
 * - `done`     — confirmed; waiting on the rest of the round
 * - `bye`      — no match this round
 */
export type MyMatch =
  | { kind: "bye"; pairing: Pairing }
  | { kind: "report"; pairing: Pairing; opponent: UserId }
  | { kind: "confirm"; pairing: Pairing; opponent: UserId; score: Seen }
  | { kind: "waiting"; pairing: Pairing; opponent: UserId; score: Seen }
  | { kind: "disputed"; pairing: Pairing; opponent: UserId }
  | { kind: "done"; pairing: Pairing; opponent: UserId; score: Seen | null };

export function myMatch(event: NexusEvent, userId: UserId): MyMatch | null {
  if (event.status !== "running") return null;
  const round = currentRound(event);
  if (!round) return null;
  const pairing = pairingForUser(round, userId);
  if (!pairing) return null;
  if (pairing.kind === "bye" || pairing.b === null) return { kind: "bye", pairing };

  const iAmA = pairing.a === userId;
  const opponent = iAmA ? pairing.b : pairing.a;
  const score = pairing.report ? seenFrom(pairing.report.score, iAmA) : null;

  switch (pairing.status) {
    case "pending":
      return { kind: "report", pairing, opponent };
    case "awaiting_confirmation":
      if (!pairing.report || !score) return { kind: "report", pairing, opponent };
      return pairing.report.submittedBy === userId
        ? { kind: "waiting", pairing, opponent, score }
        : { kind: "confirm", pairing, opponent, score };
    case "disputed":
      return { kind: "disputed", pairing, opponent };
    case "confirmed":
      return { kind: "done", pairing, opponent, score };
  }
}

/** Matches in a round that need a result, against those that have one. Byes don't count. */
export function roundProgress(round: Round): { done: number; total: number } {
  const matches = round.pairings.filter((p) => p.kind !== "bye" && p.b !== null);
  return {
    done: matches.filter((p) => p.status === "confirmed").length,
    total: matches.length,
  };
}

/** Pairings in the current round a manager may need to step in on. */
export function disputedCount(event: NexusEvent): number {
  if (event.status !== "running") return 0;
  const round = currentRound(event);
  return round ? round.pairings.filter((p) => p.status === "disputed").length : 0;
}
