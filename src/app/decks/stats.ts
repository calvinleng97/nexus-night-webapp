import { leagueDeckHistory, type PlayedDeck } from "@/lib/domain/league-decks";
import type { DeckId, UserId } from "@/lib/domain/types";
import { listEventsForUser } from "@/lib/store/repo";

/**
 * How each of a player's saved decks has done, across every league: the same
 * aggregation the league Decks tab and History use, keyed by deck.
 */
export async function deckStatsFor(userId: UserId): Promise<Map<DeckId, PlayedDeck>> {
  const events = await listEventsForUser(userId);
  const mine = leagueDeckHistory(events).find((h) => h.userId === userId);
  return new Map((mine?.decks ?? []).map((d) => [d.deckId, d]));
}

/** Rounds won over rounds played, or null before any were played. Byes don't count. */
export function winRateOf(d: { wins: number; losses: number; draws: number }): number | null {
  const rounds = d.wins + d.losses + d.draws;
  return rounds > 0 ? d.wins / rounds : null;
}
