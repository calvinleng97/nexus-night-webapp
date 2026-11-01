import { loadConfig } from "../config";
import { newId, newSeed, userIdFromGoogleSub } from "../ids";
import { emptyEvent } from "../domain/event-machine";
import type { League, NexusEvent, User, UserId } from "../domain/types";
import {
  appendJsonl,
  ensureDir,
  listJsonFiles,
  readJson,
  withLock,
  writeJsonAtomic,
} from "./fsjson";
import { paths } from "./paths";
import { SCHEMA_VERSION, type StoreMeta } from "./schema";

let readyPromise: Promise<void> | null = null;

/**
 * Idempotent, memoized store bootstrap. Every public accessor awaits this so
 * the configured data directory is always prepared before first use.
 */
export function storeReady(): Promise<void> {
  readyPromise ??= initStore();
  return readyPromise;
}

/** Create the directory skeleton and stamp the schema version. */
export async function initStore(): Promise<void> {
  await ensureDir(paths.root());
  await ensureDir(paths.usersDir());
  await ensureDir(paths.leaguesDir());
  await ensureDir(paths.eventsDir());
  await ensureDir(paths.locks());
  const meta = await readJson<StoreMeta>(paths.meta());
  if (!meta) {
    await writeJsonAtomic(paths.meta(), {
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      app: "nexus-night-webapp",
    } satisfies StoreMeta);
    return;
  }
  if (meta.schemaVersion > SCHEMA_VERSION)
    throw new Error(
      `Data directory ${paths.root()} was written by a newer version (schema ${meta.schemaVersion}); ` +
        `this build understands ${SCHEMA_VERSION}.`,
    );
}

async function audit(record: Record<string, unknown>): Promise<void> {
  await appendJsonl(paths.audit(), { at: new Date().toISOString(), ...record });
}

// ---------------------------------------------------------------- users

export async function upsertUser(profile: {
  googleSub: string;
  email: string;
  name: string;
  image: string | null;
}): Promise<User> {
  await storeReady();
  const id = userIdFromGoogleSub(profile.googleSub);
  return withLock(paths.locks(), `user-${id}`, async () => {
    const now = new Date().toISOString();
    const existing = await readJson<User>(paths.user(id));
    const user: User = existing
      ? { ...existing, email: profile.email, name: profile.name, image: profile.image, lastSeenAt: now }
      : { id, ...profile, createdAt: now, lastSeenAt: now };
    await writeJsonAtomic(paths.user(id), user);
    if (!existing) await audit({ action: "user_created", userId: id, email: profile.email });
    return user;
  });
}

export async function getUser(id: UserId): Promise<User | null> {
  await storeReady();
  return readJson<User>(paths.user(id));
}

export async function getUsers(ids: UserId[]): Promise<Map<UserId, User>> {
  const unique = [...new Set(ids)];
  const loaded = await Promise.all(unique.map((id) => getUser(id)));
  const out = new Map<UserId, User>();
  loaded.forEach((u, i) => {
    if (u) out.set(unique[i]!, u);
  });
  return out;
}

/** Display helper that never returns undefined for a missing user record. */
export function displayName(users: Map<UserId, User>, id: UserId): string {
  return users.get(id)?.name ?? "Unknown player";
}

// -------------------------------------------------------------- leagues

export async function createLeague(input: {
  name: string;
  createdBy: UserId;
}): Promise<League> {
  await storeReady();
  const league: League = {
    id: newId("lg"),
    name: input.name.trim(),
    createdBy: input.createdBy,
    managerIds: [input.createdBy],
    memberIds: [input.createdBy],
    createdAt: new Date().toISOString(),
  };
  await writeJsonAtomic(paths.league(league.id), league);
  await audit({ action: "league_created", leagueId: league.id, actor: input.createdBy });
  return league;
}

export async function getLeague(id: string): Promise<League | null> {
  await storeReady();
  return readJson<League>(paths.league(id));
}

export async function listLeagues(): Promise<League[]> {
  await storeReady();
  const files = await listJsonFiles(paths.leaguesDir());
  const loaded = await Promise.all(files.map((f) => readJson<League>(f)));
  return loaded
    .filter((l): l is League => l !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function mutateLeague(
  id: string,
  fn: (league: League) => Promise<League> | League,
): Promise<League> {
  await storeReady();
  return withLock(paths.locks(), `league-${id}`, async () => {
    const current = await readJson<League>(paths.league(id));
    if (!current) throw new Error("League not found.");
    const next = await fn(current);
    await writeJsonAtomic(paths.league(id), next);
    return next;
  });
}

export async function joinLeague(leagueId: string, userId: UserId): Promise<League> {
  const cfg = loadConfig();
  const league = await mutateLeague(leagueId, (l) => {
    if (!cfg.league.openJoin && !l.memberIds.includes(userId))
      throw new Error("This league is not open to join.");
    if (l.memberIds.includes(userId)) return l;
    return { ...l, memberIds: [...l.memberIds, userId] };
  });
  await audit({ action: "league_joined", leagueId, actor: userId });
  return league;
}

export async function leaveLeague(leagueId: string, userId: UserId): Promise<League> {
  const league = await mutateLeague(leagueId, (l) => {
    if (l.createdBy === userId) throw new Error("The league creator cannot leave their own league.");
    return {
      ...l,
      memberIds: l.memberIds.filter((m) => m !== userId),
      managerIds: l.managerIds.filter((m) => m !== userId),
    };
  });
  await audit({ action: "league_left", leagueId, actor: userId });
  return league;
}

/**
 * Remove someone from a league. Manager-only.
 *
 * League membership and event participation are separate: this does not touch
 * events, because dropping a player mid-event forfeits their current match,
 * which is too large a side effect to trigger implicitly. If they are still
 * active somewhere, the returned warning says so.
 */
export async function removeLeagueMember(
  leagueId: string,
  actorId: UserId,
  targetId: UserId,
): Promise<{ league: League; warnings: string[] }> {
  await storeReady();
  if (actorId === targetId) throw new Error('Use "Leave league" to remove yourself.');
  const league = await mutateLeague(leagueId, (l) => {
    if (!l.managerIds.includes(actorId))
      throw new Error("Only a league manager can remove players.");
    if (l.createdBy === targetId) throw new Error("The league creator cannot be removed.");
    if (!l.memberIds.includes(targetId)) throw new Error("That person is not a league member.");
    return {
      ...l,
      memberIds: l.memberIds.filter((m) => m !== targetId),
      managerIds: l.managerIds.filter((m) => m !== targetId),
    };
  });

  const warnings: string[] = [];
  const live = (await listEventsForLeague(leagueId)).filter(
    (e) =>
      e.status === "running" &&
      e.players.some((p) => p.userId === targetId && p.droppedAfterRound === null),
  );
  if (live.length > 0)
    warnings.push(
      `They are still playing in ${live.length} event${live.length === 1 ? "" : "s"} in progress. ` +
        "Drop them there too if they should stop.",
    );
  await audit({ action: "league_member_removed", leagueId, actor: actorId, targetId });
  return { league, warnings };
}

export async function setLeagueManager(
  leagueId: string,
  actorId: UserId,
  targetId: UserId,
  isManager: boolean,
): Promise<League> {
  const league = await mutateLeague(leagueId, (l) => {
    if (!l.managerIds.includes(actorId)) throw new Error("Only a league manager can change managers.");
    if (!isManager && l.createdBy === targetId)
      throw new Error("The league creator cannot be removed as a manager.");
    if (!l.memberIds.includes(targetId)) throw new Error("That person is not a league member.");
    const managerIds = isManager
      ? [...new Set([...l.managerIds, targetId])]
      : l.managerIds.filter((m) => m !== targetId);
    return { ...l, managerIds };
  });
  await audit({ action: "league_manager_set", leagueId, actor: actorId, targetId, isManager });
  return league;
}

// --------------------------------------------------------------- events

export async function createEvent(input: {
  leagueId: string;
  name: string;
  createdBy: UserId;
  totalRounds?: number;
}): Promise<NexusEvent> {
  await storeReady();
  const cfg = loadConfig();
  const league = await getLeague(input.leagueId);
  if (!league) throw new Error("League not found.");
  if (!league.managerIds.includes(input.createdBy))
    throw new Error("Only a league manager can create events.");

  const event = emptyEvent({
    id: newId("ev"),
    leagueId: input.leagueId,
    name: input.name.trim(),
    createdBy: input.createdBy,
    totalRounds: input.totalRounds ?? cfg.event.defaultRounds,
    seed: newSeed(),
  });
  await writeJsonAtomic(paths.event(event.id), event);
  await audit({
    action: "event_created",
    eventId: event.id,
    leagueId: input.leagueId,
    actor: input.createdBy,
  });
  return event;
}

export async function getEvent(id: string): Promise<NexusEvent | null> {
  await storeReady();
  return readJson<NexusEvent>(paths.event(id));
}

export async function listEventsForLeague(leagueId: string): Promise<NexusEvent[]> {
  await storeReady();
  const files = await listJsonFiles(paths.eventsDir());
  const loaded = await Promise.all(files.map((f) => readJson<NexusEvent>(f)));
  return loaded
    .filter((e): e is NexusEvent => e !== null && e.leagueId === leagueId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Every event the given player has joined, newest first. */
export async function listEventsForUser(userId: UserId): Promise<NexusEvent[]> {
  const all = await listAllEvents();
  return all.filter((e) => e.players.some((p) => p.userId === userId));
}

export async function listAllEvents(): Promise<NexusEvent[]> {
  await storeReady();
  const files = await listJsonFiles(paths.eventsDir());
  const loaded = await Promise.all(files.map((f) => readJson<NexusEvent>(f)));
  return loaded
    .filter((e): e is NexusEvent => e !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Apply a transition to an event under lock, persist it, and append the
 * resulting state change to the event's append-only history.
 *
 * `fn` must be pure: hand back the next event plus a log record describing
 * what happened. Nothing is written if it throws.
 */
export async function mutateEvent(
  id: string,
  actorId: UserId,
  fn: (event: NexusEvent) => {
    event: NexusEvent;
    log: Record<string, unknown>;
    warnings?: string[];
  },
): Promise<{ event: NexusEvent; warnings: string[] }> {
  await storeReady();
  return withLock(paths.locks(), `event-${id}`, async () => {
    const current = await readJson<NexusEvent>(paths.event(id));
    if (!current) throw new Error("Event not found.");
    const before = { status: current.status, rounds: current.rounds.length };
    const { event, log, warnings } = fn(current);
    await writeJsonAtomic(paths.event(id), event);

    const at = new Date().toISOString();
    await appendJsonl(paths.eventLog(id), { at, actor: actorId, ...log });

    // Round boundaries and completion are the records stats care about most,
    // so give them their own entries in the append-only history.
    if (event.rounds.length > before.rounds)
      await appendJsonl(paths.eventLog(id), {
        at,
        actor: actorId,
        action: "round_paired",
        round: event.rounds.length,
        pairings: event.rounds[event.rounds.length - 1]!.pairings.map((p) => ({
          pairingId: p.id,
          a: p.a,
          b: p.b,
          kind: p.kind,
          rematch: p.rematch,
        })),
      });
    if (event.status === "complete" && before.status !== "complete")
      await appendJsonl(paths.eventLog(id), { at, actor: actorId, action: "event_completed" });

    await audit({ action: "event_mutated", eventId: id, actor: actorId, detail: log.action });
    return { event, warnings: warnings ?? [] };
  });
}

export async function joinEvent(eventId: string, userId: UserId): Promise<NexusEvent> {
  const { event } = await mutateEvent(eventId, userId, (e) => {
    if (e.status !== "draft") throw new Error("This event has already started.");
    if (e.players.some((p) => p.userId === userId)) return { event: e, log: { action: "noop" } };
    const next = structuredClone(e);
    next.players.push({ userId, joinedAt: new Date().toISOString(), droppedAfterRound: null });
    return { event: next, log: { action: "player_joined", userId } };
  });
  return event;
}

export async function leaveEvent(eventId: string, userId: UserId): Promise<NexusEvent> {
  const { event } = await mutateEvent(eventId, userId, (e) => {
    if (e.status !== "draft")
      throw new Error("The event has started — ask a manager to drop you instead.");
    const next = structuredClone(e);
    next.players = next.players.filter((p) => p.userId !== userId);
    return { event: next, log: { action: "player_left", userId } };
  });
  return event;
}
