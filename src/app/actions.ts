"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { snapshotDeck } from "@/lib/domain/deck";
import { isValidEventDate } from "@/lib/domain/schedule";
import {
  confirmResult,
  disputeResult,
  dropPlayer,
  forceCloseRound,
  setEventDate,
  setPlayerDeck,
  startEvent,
  submitResult,
} from "@/lib/domain/event-machine";
import {
  cancelEvent,
  createDeck,
  createEvent,
  createLeague,
  deleteDeck,
  getDeck,
  joinEvent,
  getLeagueByJoinCode,
  joinLeague,
  leaveEvent,
  leaveLeague,
  mutateEvent,
  removeLeagueMember,
  rotateJoinCode,
  setLeagueManager,
} from "@/lib/store/repo";

import type { ActionState } from "./action-state";

function fail(message: string): ActionState {
  return { ok: false, message };
}

/** Wrap an action so a thrown error becomes a message instead of a 500 page. */
async function guard(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    // redirect() and notFound() signal by throwing; those must reach Next.js.
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// ------------------------------------------------------------------ leagues

export async function createLeagueAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const name = str(form, "name");
    if (name.length < 2) return fail("Give the league a name of at least 2 characters.");
    if (name.length > 80) return fail("League names are capped at 80 characters.");
    const league = await createLeague({ name, createdBy: userId });
    revalidatePath("/leagues");
    redirect(`/leagues/${league.id}`);
  });
}

/** Join a specific league, with its code. */
export async function joinLeagueAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const leagueId = str(form, "leagueId");
    const code = str(form, "code");
    if (!code) return fail("Enter the league's join code.");
    await joinLeague(leagueId, userId, code);
    revalidatePath("/leagues");
    revalidatePath(`/leagues/${leagueId}`, "layout");
    return { ok: true };
  });
}

/** Join whichever league owns the code, without needing its link. */
export async function joinByCodeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const code = str(form, "code");
    if (!code) return fail("Enter a join code.");
    const league = await getLeagueByJoinCode(code);
    if (!league) return fail("No league has that join code.");
    await joinLeague(league.id, userId, code);
    revalidatePath("/leagues");
    redirect(`/leagues/${league.id}`);
  });
}

export async function rotateJoinCodeAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const leagueId = str(form, "leagueId");
    await rotateJoinCode(leagueId, userId);
    revalidatePath(`/leagues/${leagueId}`, "layout");
    return { ok: true, warnings: ["The old code no longer works."] };
  });
}

export async function leaveLeagueAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const leagueId = str(form, "leagueId");
    await leaveLeague(leagueId, userId);
    revalidatePath("/leagues");
    revalidatePath(`/leagues/${leagueId}`, "layout");
    return { ok: true };
  });
}

export async function setManagerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const leagueId = str(form, "leagueId");
    await setLeagueManager(leagueId, userId, str(form, "targetId"), str(form, "make") === "1");
    revalidatePath(`/leagues/${leagueId}`, "layout");
    return { ok: true };
  });
}

export async function removeMemberAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const leagueId = str(form, "leagueId");
    const { warnings } = await removeLeagueMember(leagueId, userId, str(form, "targetId"));
    revalidatePath("/leagues");
    revalidatePath(`/leagues/${leagueId}`, "layout");
    return { ok: true, warnings };
  });
}

// -------------------------------------------------------------------- decks

export async function addDeckAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const source = typeof form.get("source") === "string" ? (form.get("source") as string) : "";
    if (source.trim() === "") return fail("Paste a decklist first.");
    if (source.length > 20_000) return fail("That decklist is implausibly long.");
    // createDeck throws the parser's message, which names the offending line.
    await createDeck({ ownerId: userId, name: str(form, "name").slice(0, 80), source });
    revalidatePath("/decks");
    return { ok: true };
  });
}

export async function deleteDeckAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    await deleteDeck(str(form, "deckId"), userId);
    revalidatePath("/decks");
    return {
      ok: true,
      warnings: ["Events you already registered it for keep their own record of it."],
    };
  });
}

/** Register a deck for an event, or clear it with an empty deckId. */
export async function registerDeckAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    const deckId = str(form, "deckId");
    const targetId = str(form, "targetId") || userId;

    let registered = null;
    if (deckId !== "") {
      const deck = await getDeck(deckId);
      if (!deck) return fail("That deck no longer exists.");
      if (deck.ownerId !== targetId) return fail("That deck belongs to someone else.");
      // The whole list is copied onto the event, so the night's record cannot
      // be rewritten by editing or deleting the deck afterwards.
      registered = snapshotDeck(deck);
    }

    const { warnings } = await mutateEvent(eventId, userId, (event) => {
      const res = setPlayerDeck(event, targetId, userId, registered);
      if (!res.ok) throw new Error(res.error);
      return {
        event: res.value.event,
        log: { action: "deck_registered", targetId, deckId: deckId || null },
        warnings: res.value.warnings,
      };
    });
    revalidatePath(`/events/${eventId}`, "layout");
    return { ok: true, warnings };
  });
}

// ------------------------------------------------------------------- events

export async function createEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const leagueId = str(form, "leagueId");
    const name = str(form, "name");
    if (name.length < 2) return fail("Give the event a name of at least 2 characters.");
    const scheduledFor = str(form, "scheduledFor") || null;
    if (scheduledFor !== null && !isValidEventDate(scheduledFor))
      return fail("Use a real date and time, or leave it blank.");
    const roundsRaw = str(form, "totalRounds");
    const totalRounds = roundsRaw ? Number(roundsRaw) : undefined;
    if (totalRounds !== undefined && (!Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > 12))
      return fail("Rounds must be a whole number between 1 and 12.");
    const event = await createEvent({
      leagueId,
      name,
      createdBy: userId,
      totalRounds,
      scheduledFor,
    });
    revalidatePath(`/leagues/${leagueId}`, "layout");
    redirect(`/events/${event.id}`);
  });
}

export async function joinEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    await joinEvent(eventId, userId);
    revalidatePath(`/events/${eventId}`, "layout");
    return { ok: true };
  });
}

export async function leaveEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    await leaveEvent(eventId, userId);
    revalidatePath(`/events/${eventId}`, "layout");
    return { ok: true };
  });
}

export async function setEventDateAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    const raw = str(form, "scheduledFor");
    const scheduledFor = raw === "" ? null : raw;
    if (scheduledFor !== null && !isValidEventDate(scheduledFor))
      return fail("Use a real date and time, or clear it.");
    const { warnings } = await mutateEvent(eventId, userId, (event) => {
      const res = setEventDate(event, userId, scheduledFor);
      if (!res.ok) throw new Error(res.error);
      return {
        event: res.value.event,
        log: { action: "event_date_set", scheduledFor },
        warnings: res.value.warnings,
      };
    });
    revalidatePath(`/events/${eventId}`, "layout");
    revalidatePath("/leagues");
    return { ok: true, warnings };
  });
}

export async function startEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    const { warnings } = await mutateEvent(eventId, userId, (event) => {
      const res = startEvent(event, userId);
      if (!res.ok) throw new Error(res.error);
      return {
        event: res.value.event,
        log: { action: "event_started", players: event.players.map((p) => p.userId) },
        warnings: res.value.warnings,
      };
    });
    revalidatePath(`/events/${eventId}`, "layout");
    return { ok: true, warnings };
  });
}

export async function submitScoreAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    const pairingId = str(form, "pairingId");
    // "mine-theirs", e.g. "2-1", always from the submitting player's view.
    const [mineRaw, theirsRaw] = str(form, "score").split("-");
    const mine = Number(mineRaw);
    const theirs = Number(theirsRaw);
    if (!Number.isInteger(mine) || !Number.isInteger(theirs)) return fail("Pick a game score.");

    const { warnings } = await mutateEvent(eventId, userId, (event) => {
      const res = submitResult(event, pairingId, userId, { a: mine, b: theirs });
      if (!res.ok) throw new Error(res.error);
      return {
        event: res.value.event,
        log: { action: "result_submitted", pairingId, score: { mine, theirs }, by: userId },
        warnings: res.value.warnings,
      };
    });
    revalidatePath(`/events/${eventId}`, "layout");
    return { ok: true, warnings };
  });
}

export async function confirmScoreAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    const pairingId = str(form, "pairingId");
    const { warnings } = await mutateEvent(eventId, userId, (event) => {
      const res = confirmResult(event, pairingId, userId);
      if (!res.ok) throw new Error(res.error);
      return {
        event: res.value.event,
        log: { action: "result_confirmed", pairingId, by: userId },
        warnings: res.value.warnings,
      };
    });
    revalidatePath(`/events/${eventId}`, "layout");
    return { ok: true, warnings };
  });
}

export async function disputeScoreAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    const pairingId = str(form, "pairingId");
    const { warnings } = await mutateEvent(eventId, userId, (event) => {
      const res = disputeResult(event, pairingId, userId);
      if (!res.ok) throw new Error(res.error);
      return {
        event: res.value.event,
        log: { action: "result_disputed", pairingId, by: userId },
        warnings: res.value.warnings,
      };
    });
    revalidatePath(`/events/${eventId}`, "layout");
    return { ok: true, warnings };
  });
}

export async function dropPlayerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    const targetId = str(form, "targetId");
    const { warnings } = await mutateEvent(eventId, userId, (event) => {
      const res = dropPlayer(event, targetId, userId);
      if (!res.ok) throw new Error(res.error);
      return {
        event: res.value.event,
        log: { action: "player_dropped", targetId, by: userId },
        warnings: res.value.warnings,
      };
    });
    revalidatePath(`/events/${eventId}`, "layout");
    return { ok: true, warnings };
  });
}

export async function forceCloseRoundAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    const { warnings } = await mutateEvent(eventId, userId, (event) => {
      const res = forceCloseRound(event, userId);
      if (!res.ok) throw new Error(res.error);
      return {
        event: res.value.event,
        log: { action: "round_force_closed", by: userId },
        warnings: res.value.warnings,
      };
    });
    revalidatePath(`/events/${eventId}`, "layout");
    return { ok: true, warnings };
  });
}

export async function cancelEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    const event = await cancelEvent(eventId, userId, str(form, "revertElo") === "1");
    revalidatePath(`/events/${eventId}`, "layout");
    revalidatePath(`/leagues/${event.leagueId}`, "layout");
    return { ok: true };
  });
}
