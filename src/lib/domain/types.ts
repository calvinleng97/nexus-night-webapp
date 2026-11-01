// Core domain types. These are also the on-disk JSON shapes, so changes here
// are migrations — bump `schemaVersion` in src/lib/store/schema.ts when editing.

export type UserId = string;
export type LeagueId = string;
export type EventId = string;
export type PairingId = string;

export interface User {
  id: UserId;
  /** Google's stable subject claim. The real identity key. */
  googleSub: string;
  email: string;
  name: string;
  image: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface League {
  id: LeagueId;
  name: string;
  /** Shared secret players need in order to join. Rotatable by a manager. */
  joinCode: string;
  createdBy: UserId;
  /** Managers can create events. The creator is always a manager. */
  managerIds: UserId[];
  memberIds: UserId[];
  createdAt: string;
}

export type EventStatus = "draft" | "running" | "complete";

export interface EventPlayer {
  userId: UserId;
  joinedAt: string;
  /**
   * Round number after which the player stopped participating, or null if
   * still active. A player dropped during round R still has their round-R
   * pairing resolved (as a forfeit), but is excluded from pairing R+1 onward.
   */
  droppedAfterRound: number | null;
}

/** A best-of-three game score. Games won by each side. */
export interface GameScore {
  a: number;
  b: number;
}

export type MatchKind = "played" | "bye" | "forfeit";

export type MatchStatus =
  | "pending" // no result submitted yet
  | "awaiting_confirmation" // one side submitted, opponent has not confirmed
  | "confirmed" // agreed, or set by a manager
  | "disputed"; // opponent rejected the submission; manager must resolve

export interface MatchReport {
  score: GameScore;
  submittedBy: UserId;
  submittedAt: string;
}

export interface Pairing {
  id: PairingId;
  roundNumber: number;
  /** Player A. Always present. */
  a: UserId;
  /** Player B, or null when this is a bye for A. */
  b: UserId | null;
  kind: MatchKind;
  status: MatchStatus;
  /** True when A and B had already played each other in an earlier round. */
  rematch: boolean;
  /** The current (possibly unconfirmed) submission. */
  report: MatchReport | null;
  confirmedBy: UserId | null;
  /** Set when a manager overrode the players' submission. */
  overriddenBy: UserId | null;
  disputedBy: UserId | null;
  resolvedAt: string | null;
}

export interface Round {
  number: number;
  pairings: Pairing[];
  createdAt: string;
  /** Set once every pairing in the round is confirmed. */
  closedAt: string | null;
}

export interface NexusEvent {
  id: EventId;
  leagueId: LeagueId;
  name: string;
  status: EventStatus;
  /** Number of Swiss rounds. Defaults to config.event.defaultRounds (3). */
  totalRounds: number;
  createdBy: UserId;
  managerIds: UserId[];
  players: EventPlayer[];
  rounds: Round[];
  /** Seed for deterministic shuffling and stable display order of ties. */
  seed: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

/** Derived, never stored: computed from an event's confirmed results. */
export interface Standing {
  userId: UserId;
  matchPoints: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  gamesWon: number;
  gamesLost: number;
  opponents: UserId[];
  dropped: boolean;
  /** Shared rank: players on equal match points share a rank number. */
  rank: number;
}

export const MATCH_POINTS = { win: 3, draw: 1, loss: 0 } as const;
