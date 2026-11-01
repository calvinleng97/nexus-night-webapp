"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import {
  confirmResult,
  disputeResult,
  dropPlayer,
  forceCloseRound,
  startEvent,
  submitResult,
} from "@/lib/domain/event-machine";
import {
  createEvent,
  createLeague,
  joinEvent,
  joinLeague,
  leaveEvent,
  leaveLeague,
  mutateEvent,
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

export async function joinLeagueAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const leagueId = str(form, "leagueId");
    await joinLeague(leagueId, userId);
    revalidatePath("/leagues");
    revalidatePath(`/leagues/${leagueId}`);
    return { ok: true };
  });
}

export async function leaveLeagueAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const leagueId = str(form, "leagueId");
    await leaveLeague(leagueId, userId);
    revalidatePath("/leagues");
    revalidatePath(`/leagues/${leagueId}`);
    return { ok: true };
  });
}

export async function setManagerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const leagueId = str(form, "leagueId");
    await setLeagueManager(leagueId, userId, str(form, "targetId"), str(form, "make") === "1");
    revalidatePath(`/leagues/${leagueId}`);
    return { ok: true };
  });
}

// ------------------------------------------------------------------- events

export async function createEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const leagueId = str(form, "leagueId");
    const name = str(form, "name");
    if (name.length < 2) return fail("Give the event a name of at least 2 characters.");
    const roundsRaw = str(form, "totalRounds");
    const totalRounds = roundsRaw ? Number(roundsRaw) : undefined;
    if (totalRounds !== undefined && (!Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > 12))
      return fail("Rounds must be a whole number between 1 and 12.");
    const event = await createEvent({ leagueId, name, createdBy: userId, totalRounds });
    revalidatePath(`/leagues/${leagueId}`);
    redirect(`/events/${event.id}`);
  });
}

export async function joinEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    await joinEvent(eventId, userId);
    revalidatePath(`/events/${eventId}`);
    return { ok: true };
  });
}

export async function leaveEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireUserId();
    const eventId = str(form, "eventId");
    await leaveEvent(eventId, userId);
    revalidatePath(`/events/${eventId}`);
    return { ok: true };
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
    revalidatePath(`/events/${eventId}`);
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
    revalidatePath(`/events/${eventId}`);
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
    revalidatePath(`/events/${eventId}`);
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
    revalidatePath(`/events/${eventId}`);
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
    revalidatePath(`/events/${eventId}`);
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
    revalidatePath(`/events/${eventId}`);
    return { ok: true, warnings };
  });
}
