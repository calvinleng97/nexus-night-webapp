import { loadConfig } from "../config";
import { newId, newJoinCode, newSeed, normalizeJoinCode, userIdFromGoogleSub } from "../ids";
import { cancelEvent as cancelEventTransition, emptyEvent } from "../domain/event-machine";
import { canRevertElo } from "../domain/elo";
import { eventOrderKey } from "../domain/schedule";
import type {
  Deck,
  DeckId,
  League,
  NexusEvent,
  RegisteredDeck,
  User,
  UserId,
} from "../domain/types";
import { parseDecklist, snapshotDeck, suggestDeckName } from "../domain/deck";
import {
  appendJsonl,
  ensureDir,
  listJsonFiles,
  readJson,
  withLock,
  writeJsonAtomic,
} from "./fsjson";
import { rm, stat } from "node:fs/promises";
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
  await ensureDir(paths.decksDir());
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
  if (meta.schemaVersion < SCHEMA_VERSION) await migrate(meta.schemaVersion);
}

/** Forward-only migrations, run once at startup. */
async function migrate(from: number): Promise<void> {
  if (from < 2) {
    // v2 introduced League.joinCode. Give every existing league one.
    const files = await listJsonFiles(paths.leaguesDir());
    for (const file of files) {
      const league = await readJson<League>(file);
      if (!league || league.joinCode) continue;
      await writeJsonAtomic(file, { ...league, joinCode: newJoinCode() });
    }
  }
  if (from < 4) {
    // v4 introduced EventPlayer.deck. Nobody had registered one before.
    const files = await listJsonFiles(paths.eventsDir());
    for (const file of files) {
      const event = await readJson<NexusEvent>(file);
      if (!event || !event.players.some((p) => p.deck === undefined)) continue;
      await writeJsonAtomic(file, {
        ...event,
        players: event.players.map((p) => ({ ...p, deck: p.deck ?? null })),
      });
    }
  }
  if (from < 3) {
    // v3 introduced NexusEvent.scheduledFor. Older events are undated.
    const files = await listJsonFiles(paths.eventsDir());
    for (const file of files) {
      const event = await readJson<NexusEvent>(file);
      if (!event || event.scheduledFor !== undefined) continue;
      await writeJsonAtomic(file, { ...event, scheduledFor: null });
    }
  }
  if (from < 5) {
    // v5 widened RegisteredDeck from {name, legend} to the whole list, so an
    // event can show the decks that were played in it. Backfill the cards
    // from the saved deck where it still exists; where the owner has already
    // deleted it, the cards are simply gone and the record keeps the name.
    const files = await listJsonFiles(paths.eventsDir());
    for (const file of files) {
      const event = await readJson<NexusEvent>(file);
      if (!event) continue;
      const stale = event.players.filter((p) => p.deck && p.deck.source === undefined);
      if (stale.length === 0) continue;

      const players = await Promise.all(
        event.players.map(async (p) => {
          if (!p.deck || p.deck.source !== undefined) return p;
          const saved = await readJson<Deck>(paths.deck(p.deck.deckId));
          const filled: RegisteredDeck = saved
            ? { ...snapshotDeck(saved, p.deck.registeredAt), name: p.deck.name, legend: p.deck.legend }
            : {
                ...p.deck,
                champions: [],
                mainDeck: [],
                battlefields: [],
                runes: [],
                sideboard: [],
                source: "",
              };
          return { ...p, deck: filled };
        }),
      );
      await writeJsonAtomic(file, { ...event, players });
    }
  }
  if (from < 6) {
    // v6 introduced cancellation. Nothing had been cancelled before.
    const files = await listJsonFiles(paths.eventsDir());
    for (const file of files) {
      const event = await readJson<NexusEvent>(file);
      if (!event || event.eloReverted !== undefined) continue;
      await writeJsonAtomic(file, { ...event, cancelledAt: null, eloReverted: false });
    }
  }
  await writeJsonAtomic(paths.meta(), {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    app: "nexus-night-webapp",
  } satisfies StoreMeta);
  await audit({ action: "store_migrated", from, to: SCHEMA_VERSION });
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
  // Codes are the only way in, so make sure two leagues never share one.
  const taken = new Set((await listLeagues()).map((l) => l.joinCode));
  let joinCode = newJoinCode();
  for (let tries = 0; taken.has(joinCode) && tries < 20; tries++) joinCode = newJoinCode();

  const league: League = {
    id: newId("lg"),
    name: input.name.trim(),
    joinCode,
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

/** Find a league by its join code. Case and punctuation insensitive. */
export async function getLeagueByJoinCode(code: string): Promise<League | null> {
  await storeReady();
  const wanted = normalizeJoinCode(code);
  if (!wanted) return null;
  const all = await listLeagues();
  return all.find((l) => normalizeJoinCode(l.joinCode) === wanted) ?? null;
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

/**
 * Join a league. The code is required for anyone who is not already a member;
 * re-joining is a no-op so a stale form submission cannot fail confusingly.
 */
export async function joinLeague(
  leagueId: string,
  userId: UserId,
  code: string,
): Promise<League> {
  const league = await mutateLeague(leagueId, (l) => {
    if (l.memberIds.includes(userId)) return l;
    if (normalizeJoinCode(code) !== normalizeJoinCode(l.joinCode))
      throw new Error("That join code is not right.");
    return { ...l, memberIds: [...l.memberIds, userId] };
  });
  await audit({ action: "league_joined", leagueId, actor: userId });
  return league;
}

/** Issue a new code, which invalidates the old one immediately. */
export async function rotateJoinCode(leagueId: string, actorId: UserId): Promise<League> {
  const taken = new Set((await listLeagues()).map((l) => l.joinCode));
  const league = await mutateLeague(leagueId, (l) => {
    if (!l.managerIds.includes(actorId))
      throw new Error("Only a league manager can change the join code.");
    let next = newJoinCode();
    for (let tries = 0; (taken.has(next) || next === l.joinCode) && tries < 20; tries++)
      next = newJoinCode();
    return { ...l, joinCode: next };
  });
  await audit({ action: "league_code_rotated", leagueId, actor: actorId });
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

// ---------------------------------------------------------------- decks

export async function createDeck(input: {
  ownerId: UserId;
  name: string;
  source: string;
}): Promise<Deck> {
  await storeReady();
  const parsed = parseDecklist(input.source);
  if (!parsed.ok) throw new Error(parsed.error);
  const deck: Deck = {
    id: newId("dk"),
    ownerId: input.ownerId,
    name: input.name.trim() || suggestDeckName(parsed.deck),
    legend: parsed.deck.legend,
    champions: parsed.deck.champions,
    mainDeck: parsed.deck.mainDeck,
    battlefields: parsed.deck.battlefields,
    runes: parsed.deck.runes,
    sideboard: parsed.deck.sideboard,
    source: input.source,
    createdAt: new Date().toISOString(),
  };
  await writeJsonAtomic(paths.deck(deck.id), deck);
  await audit({ action: "deck_created", deckId: deck.id, actor: input.ownerId });
  return deck;
}

export async function getDeck(id: DeckId): Promise<Deck | null> {
  await storeReady();
  return readJson<Deck>(paths.deck(id));
}

export async function listDecksForUser(ownerId: UserId): Promise<Deck[]> {
  await storeReady();
  const files = await listJsonFiles(paths.decksDir());
  const loaded = await Promise.all(files.map((f) => readJson<Deck>(f)));
  return loaded
    .filter((d): d is Deck => d !== null && d.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Delete a deck. Events keep their own snapshot of what was registered, so
 * past results are unaffected.
 */
export async function deleteDeck(id: DeckId, actorId: UserId): Promise<void> {
  await storeReady();
  const deck = await readJson<Deck>(paths.deck(id));
  if (!deck) throw new Error("Deck not found.");
  if (deck.ownerId !== actorId) throw new Error("That is not your deck.");
  await rm(paths.deck(id), { force: true });
  await audit({ action: "deck_deleted", deckId: id, actor: actorId });
}

// --------------------------------------------------------------- events

export async function createEvent(input: {
  leagueId: string;
  name: string;
  createdBy: UserId;
  totalRounds?: number;
  scheduledFor?: string | null;
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
    scheduledFor: input.scheduledFor ?? null,
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

/**
 * A cheap marker that changes whenever the event file is rewritten, so open
 * pages can tell when to re-render without loading the whole event.
 */
export async function getEventVersion(id: string): Promise<string | null> {
  await storeReady();
  try {
    const s = await stat(paths.event(id));
    return `${s.mtimeMs}-${s.size}`;
  } catch {
    return null;
  }
}

export async function listEventsForLeague(leagueId: string): Promise<NexusEvent[]> {
  await storeReady();
  const files = await listJsonFiles(paths.eventsDir());
  const loaded = await Promise.all(files.map((f) => readJson<NexusEvent>(f)));
  return loaded
    .filter((e): e is NexusEvent => e !== null && e.leagueId === leagueId)
    .sort((a, b) => eventOrderKey(b).localeCompare(eventOrderKey(a)));
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
    if (event.status === "cancelled" && before.status !== "cancelled")
      await appendJsonl(paths.eventLog(id), {
        at,
        actor: actorId,
        action: "event_cancelled",
        eloReverted: event.eloReverted,
      });

    await audit({ action: "event_mutated", eventId: id, actor: actorId, detail: log.action });
    return { event, warnings: warnings ?? [] };
  });
}

/**
 * Cancel an event, optionally reverting its Elo.
 *
 * Whether the revert is allowed depends on the league's other events, which
 * are read just before taking this event's lock; the locked copy of this
 * event replaces its stale one in that set.
 */
export async function cancelEvent(
  eventId: string,
  actorId: UserId,
  revertElo: boolean,
): Promise<NexusEvent> {
  const existing = await getEvent(eventId);
  if (!existing) throw new Error("Event not found.");
  const others = (await listEventsForLeague(existing.leagueId)).filter((e) => e.id !== eventId);
  const { event } = await mutateEvent(eventId, actorId, (e) => {
    const res = cancelEventTransition(e, actorId, {
      revertElo,
      revertAllowed: canRevertElo([...others, e], e.id),
    });
    if (!res.ok) throw new Error(res.error);
    return { event: res.value.event, log: { action: "event_cancelled", revertElo, by: actorId } };
  });
  return event;
}

export async function joinEvent(eventId: string, userId: UserId): Promise<NexusEvent> {
  const { event } = await mutateEvent(eventId, userId, (e) => {
    if (e.status !== "draft") throw new Error("This event has already started.");
    if (e.players.some((p) => p.userId === userId)) return { event: e, log: { action: "noop" } };
    const next = structuredClone(e);
    next.players.push({
      userId,
      joinedAt: new Date().toISOString(),
      deck: null,
      droppedAfterRound: null,
    });
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
