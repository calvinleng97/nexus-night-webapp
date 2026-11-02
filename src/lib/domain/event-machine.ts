import { loadConfig } from "../config";
import { isValidEventDate } from "./schedule";
import { newId } from "../ids";
import { pairRound } from "./pairing";
import { computeStandings, toPairingPlayers } from "./standings";
import type {
  EventId,
  GameScore,
  NexusEvent,
  Pairing,
  RegisteredDeck,
  Round,
  UserId,
} from "./types";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = <T>(error: string): Result<T> => ({ ok: false, error });

/** Minimum field size we will start an event with. */
export const MIN_PLAYERS = 2;

export function isManager(event: NexusEvent, userId: UserId | undefined): boolean {
  return !!userId && event.managerIds.includes(userId);
}

export function currentRound(event: NexusEvent): Round | null {
  return event.rounds.length > 0 ? event.rounds[event.rounds.length - 1]! : null;
}

export function activePlayers(event: NexusEvent): UserId[] {
  return event.players.filter((p) => p.droppedAfterRound === null).map((p) => p.userId);
}

export function pairingForUser(round: Round, userId: UserId): Pairing | null {
  return round.pairings.find((p) => p.a === userId || p.b === userId) ?? null;
}

/**
 * A best-of-three score. Valid shapes: 2-0, 2-1, 1-2, 0-2 (decisive),
 * 1-1 and 0-0 (draw, e.g. time ran out), 1-0 and 0-1 (match called early).
 */
export function validateScore(score: GameScore): Result<GameScore> {
  const { a, b } = score;
  for (const v of [a, b]) {
    if (!Number.isInteger(v) || v < 0 || v > 2) return err("Each side must win 0, 1 or 2 games.");
  }
  if (a + b > 3) return err("A best-of-three cannot have more than 3 games.");
  return ok({ a, b });
}

function sideOf(p: Pairing, userId: UserId): "a" | "b" | null {
  if (p.a === userId) return "a";
  if (p.b === userId) return "b";
  return null;
}

function buildPairings(event: NexusEvent, roundNumber: number) {
  const cfg = loadConfig();
  const standings = computeStandings(event);
  const players = toPairingPlayers(event, standings);
  const outcome = pairRound(players, {
    seed: event.seed + roundNumber,
    policy: { priority: cfg.pairing.priority },
  });
  const pairings: Pairing[] = outcome.pairs.map((pr) => ({
    id: newId("m"),
    roundNumber,
    a: pr.a,
    b: pr.b,
    kind: "played",
    status: "pending",
    rematch: pr.rematch,
    report: null,
    confirmedBy: null,
    overriddenBy: null,
    disputedBy: null,
    resolvedAt: null,
  }));
  if (outcome.bye !== null) {
    pairings.push({
      id: newId("m"),
      roundNumber,
      a: outcome.bye,
      b: null,
      kind: "bye",
      status: "confirmed",
      rematch: false,
      report: null,
      confirmedBy: null,
      overriddenBy: null,
      disputedBy: null,
      resolvedAt: new Date().toISOString(),
    });
  }
  return { pairings, warnings: outcome.warnings };
}

export function startEvent(
  event: NexusEvent,
  actorId: UserId,
  now = new Date().toISOString(),
): Result<{ event: NexusEvent; warnings: string[] }> {
  if (!isManager(event, actorId)) return err("Only an event manager can start the event.");
  if (event.status !== "draft") return err("This event has already been started.");
  const active = activePlayers(event);
  if (active.length < MIN_PLAYERS)
    return err(`Need at least ${MIN_PLAYERS} players to start; ${active.length} joined.`);

  const next = structuredClone(event);
  next.status = "running";
  next.startedAt = now;
  const { pairings, warnings } = buildPairings(next, 1);
  next.rounds = [{ number: 1, pairings, createdAt: now, closedAt: null }];
  if (active.length === 2)
    warnings.push(
      "With only 2 players, rounds 2 and 3 must be rematches — there is no other possible pairing.",
    );
  return ok({ event: next, warnings });
}

/** Advance the event if the current round is fully resolved. */
export function maybeAdvance(
  event: NexusEvent,
  now = new Date().toISOString(),
): { event: NexusEvent; advanced: boolean; warnings: string[] } {
  if (event.status !== "running") return { event, advanced: false, warnings: [] };
  const round = currentRound(event);
  if (!round || round.closedAt !== null) return { event, advanced: false, warnings: [] };
  const unresolved = round.pairings.filter((p) => p.status !== "confirmed");
  if (unresolved.length > 0) return { event, advanced: false, warnings: [] };

  const next = structuredClone(event);
  const closing = next.rounds[next.rounds.length - 1]!;
  closing.closedAt = now;

  if (closing.number >= next.totalRounds) {
    next.status = "complete";
    next.completedAt = now;
    return { event: next, advanced: true, warnings: [] };
  }
  const active = activePlayers(next);
  if (active.length < MIN_PLAYERS) {
    next.status = "complete";
    next.completedAt = now;
    return {
      event: next,
      advanced: true,
      warnings: ["Too few players remain to pair another round; the event was closed early."],
    };
  }
  const roundNumber = closing.number + 1;
  const { pairings, warnings } = buildPairings(next, roundNumber);
  next.rounds.push({ number: roundNumber, pairings, createdAt: now, closedAt: null });
  return { event: next, advanced: true, warnings };
}

export function submitResult(
  event: NexusEvent,
  pairingId: string,
  actorId: UserId,
  score: GameScore,
  now = new Date().toISOString(),
): Result<{ event: NexusEvent; warnings: string[] }> {
  const valid = validateScore(score);
  if (!valid.ok) return valid;
  const next = structuredClone(event);
  const round = currentRound(next);
  if (!round) return err("This event has no active round.");
  const pairing = round.pairings.find((p) => p.id === pairingId);
  if (!pairing) return err("That match is not part of the current round.");
  if (pairing.kind === "bye") return err("A bye has no score to report.");
  if (pairing.status === "confirmed") return err("That match is already confirmed.");

  const side = sideOf(pairing, actorId);
  const manager = isManager(next, actorId);
  if (!side && !manager) return err("You are not in that match.");

  // Scores are always stored from player A's perspective.
  const oriented: GameScore = side === "b" ? { a: score.b, b: score.a } : { a: score.a, b: score.b };

  pairing.report = { score: oriented, submittedBy: actorId, submittedAt: now };
  pairing.disputedBy = null;

  if (manager && !side) {
    pairing.status = "confirmed";
    pairing.overriddenBy = actorId;
    pairing.resolvedAt = now;
  } else {
    pairing.status = "awaiting_confirmation";
    pairing.confirmedBy = null;
  }
  const advanced = maybeAdvance(next, now);
  return ok({ event: advanced.event, warnings: advanced.warnings });
}

export function confirmResult(
  event: NexusEvent,
  pairingId: string,
  actorId: UserId,
  now = new Date().toISOString(),
): Result<{ event: NexusEvent; warnings: string[] }> {
  const next = structuredClone(event);
  const round = currentRound(next);
  if (!round) return err("This event has no active round.");
  const pairing = round.pairings.find((p) => p.id === pairingId);
  if (!pairing) return err("That match is not part of the current round.");
  if (pairing.status !== "awaiting_confirmation" && pairing.status !== "disputed")
    return err("There is no submitted result to confirm.");
  if (!pairing.report) return err("There is no submitted result to confirm.");

  const side = sideOf(pairing, actorId);
  if (!side && !isManager(next, actorId)) return err("You are not in that match.");
  if (side && pairing.report.submittedBy === actorId)
    return err("Your opponent has to confirm the result you submitted.");

  pairing.status = "confirmed";
  pairing.confirmedBy = actorId;
  pairing.resolvedAt = now;
  if (!side) pairing.overriddenBy = actorId;
  const advanced = maybeAdvance(next, now);
  return ok({ event: advanced.event, warnings: advanced.warnings });
}

export function disputeResult(
  event: NexusEvent,
  pairingId: string,
  actorId: UserId,
): Result<{ event: NexusEvent; warnings: string[] }> {
  const next = structuredClone(event);
  const round = currentRound(next);
  if (!round) return err("This event has no active round.");
  const pairing = round.pairings.find((p) => p.id === pairingId);
  if (!pairing) return err("That match is not part of the current round.");
  if (pairing.status !== "awaiting_confirmation") return err("There is no pending result to dispute.");
  const side = sideOf(pairing, actorId);
  if (!side) return err("You are not in that match.");
  if (pairing.report?.submittedBy === actorId) return err("You cannot dispute your own submission.");

  pairing.status = "disputed";
  pairing.disputedBy = actorId;
  return ok({
    event: next,
    warnings: ["Result disputed. An event manager has to resolve it before the round can close."],
  });
}

export function dropPlayer(
  event: NexusEvent,
  targetId: UserId,
  actorId: UserId,
  now = new Date().toISOString(),
): Result<{ event: NexusEvent; warnings: string[] }> {
  if (!isManager(event, actorId)) return err("Only an event manager can drop a player.");
  const next = structuredClone(event);
  const player = next.players.find((p) => p.userId === targetId);
  if (!player) return err("That player is not in this event.");
  if (player.droppedAfterRound !== null) return err("That player has already been dropped.");

  const round = currentRound(next);
  const warnings: string[] = [];
  player.droppedAfterRound = round ? round.number : 0;

  // Resolve their open match in the current round as a forfeit to the opponent.
  if (round && round.closedAt === null) {
    const pairing = pairingForUser(round, targetId);
    if (pairing && pairing.status !== "confirmed") {
      if (pairing.b === null) {
        pairing.status = "confirmed";
        pairing.resolvedAt = now;
      } else {
        const droppedIsA = pairing.a === targetId;
        pairing.kind = "forfeit";
        pairing.status = "confirmed";
        pairing.overriddenBy = actorId;
        pairing.resolvedAt = now;
        pairing.report = {
          score: droppedIsA ? { a: 0, b: 2 } : { a: 2, b: 0 },
          submittedBy: actorId,
          submittedAt: now,
        };
        warnings.push("Their current opponent was given a 2-0 win by forfeit.");
      }
    }
  }
  const advanced = maybeAdvance(next, now);
  return ok({ event: advanced.event, warnings: [...warnings, ...advanced.warnings] });
}

/** Manager escape hatch: force the round closed, conceding any open matches. */
export function forceCloseRound(
  event: NexusEvent,
  actorId: UserId,
  now = new Date().toISOString(),
): Result<{ event: NexusEvent; warnings: string[] }> {
  if (!isManager(event, actorId)) return err("Only an event manager can force a round closed.");
  const next = structuredClone(event);
  const round = currentRound(next);
  if (!round || round.closedAt !== null) return err("There is no open round to close.");
  const warnings: string[] = [];
  for (const p of round.pairings) {
    if (p.status === "confirmed") continue;
    if (p.report) {
      p.status = "confirmed";
      p.overriddenBy = actorId;
      p.resolvedAt = now;
      warnings.push("Accepted a pending submission without opponent confirmation.");
    } else {
      p.status = "confirmed";
      p.kind = "forfeit";
      p.overriddenBy = actorId;
      p.resolvedAt = now;
      p.report = { score: { a: 0, b: 0 }, submittedBy: actorId, submittedAt: now };
      warnings.push("Recorded an unplayed match as a 0-0 draw.");
    }
  }
  const advanced = maybeAdvance(next, now);
  return ok({ event: advanced.event, warnings: [...new Set([...warnings, ...advanced.warnings])] });
}

/**
 * Register (or clear) the deck a player is using for this event.
 *
 * Players set their own; a manager can set anyone's, for the person who turns
 * up without a phone. Allowed while the event is still running so someone can
 * register late — it is informational and does not affect pairing.
 */
export function setPlayerDeck(
  event: NexusEvent,
  targetId: UserId,
  actorId: UserId,
  deck: RegisteredDeck | null,
): Result<{ event: NexusEvent; warnings: string[] }> {
  if (actorId !== targetId && !isManager(event, actorId))
    return err("You can only choose your own deck.");
  if (event.status === "complete") return err("This event has already finished.");
  const next = structuredClone(event);
  const player = next.players.find((p) => p.userId === targetId);
  if (!player) return err("That player is not in this event.");
  player.deck = deck;
  return ok({ event: next, warnings: [] });
}

export function setEventDate(
  event: NexusEvent,
  actorId: UserId,
  scheduledFor: string | null,
): Result<{ event: NexusEvent; warnings: string[] }> {
  if (!isManager(event, actorId)) return err("Only an event manager can change the date.");
  if (event.status === "complete") return err("This event has already finished.");
  if (scheduledFor !== null && !isValidEventDate(scheduledFor))
    return err("Use a real date and time.");
  const next = structuredClone(event);
  next.scheduledFor = scheduledFor;
  return ok({ event: next, warnings: [] });
}

export function emptyEvent(input: {
  id: EventId;
  leagueId: string;
  name: string;
  createdBy: UserId;
  totalRounds: number;
  seed: number;
  scheduledFor?: string | null;
  now?: string;
}): NexusEvent {
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id,
    leagueId: input.leagueId,
    name: input.name,
    status: "draft",
    totalRounds: input.totalRounds,
    scheduledFor: input.scheduledFor ?? null,
    createdBy: input.createdBy,
    managerIds: [input.createdBy],
    players: [],
    rounds: [],
    seed: input.seed,
    createdAt: now,
    startedAt: null,
    completedAt: null,
  };
}
