import { loadConfig } from "@/lib/config";
import { shortLegend } from "@/lib/domain/deck";
import { computeLeagueElo } from "@/lib/domain/elo";
import { computeStandings, recordLabel } from "@/lib/domain/standings";
import type { EventPlayer, Standing } from "@/lib/domain/types";
import { getLeague, listEventsForLeague } from "@/lib/store/repo";
import { DeckListing, ExpandIcon } from "@/components/deck-view";
import type { Person } from "@/components/event-bits";
import { Avatar, Card, Empty, Pill, thClass } from "@/components/ui";
import { loadEventView } from "../load";

/** Player · Deck · Elo · Record. On phones the Deck column folds under the name. */
const ROW =
  "grid grid-cols-[minmax(0,1fr)_2.75rem_3.5rem_2.75rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_3.5rem_4rem_3rem] sm:gap-x-4";

/**
 * The Decks tab: everyone in the event with their deck, their league Elo and
 * their record here. A row with a deck opens to show the full list.
 */
export default async function EventPlayersPage(props: PageProps<"/events/[id]/players">) {
  const { id } = await props.params;
  const { userId, event, who } = await loadEventView(id);

  const league = await getLeague(event.leagueId);
  const leagueEvents = league ? await listEventsForLeague(league.id) : [];
  const elo = new Map(
    computeLeagueElo(leagueEvents, league?.memberIds ?? [], loadConfig().elo).map((r) => [
      r.userId,
      r.rating,
    ]),
  );

  const started = event.status !== "draft";
  const standings = computeStandings(event);
  const byId = new Map(standings.map((s) => [s.userId, s]));
  // Before the start, sign-up order; after, the order they're standing in.
  const players: EventPlayer[] = started
    ? standings
        .map((s) => event.players.find((p) => p.userId === s.userId))
        .filter((p): p is EventPlayer => p !== undefined)
    : event.players;

  if (players.length === 0) return <Empty>Nobody yet.</Empty>;

  return (
    <Card className="overflow-hidden">
      <div className={`${ROW} border-b border-hair-soft px-4`}>
        <span className={thClass}>Player</span>
        <span className={`${thClass} hidden sm:block`}>Deck</span>
        <span className={`${thClass} text-right`}>Elo</span>
        <span className={`${thClass} text-right`}>{started ? "W-L-D" : ""}</span>
        <span />
      </div>
      <ul>
        {players.map((p) => (
          <PlayerRow
            key={p.userId}
            player={p}
            person={who(p.userId)}
            me={p.userId === userId}
            elo={elo.get(p.userId) ?? null}
            standing={started ? (byId.get(p.userId) ?? null) : null}
          />
        ))}
      </ul>
    </Card>
  );
}

function PlayerRow({
  player,
  person,
  me,
  elo,
  standing,
}: {
  player: EventPlayer;
  person: Person;
  me: boolean;
  elo: number | null;
  standing: Standing | null;
}) {
  const deck = player.deck;
  const dropped = player.droppedAfterRound !== null;
  const deckLabel = deck ? (shortLegend(deck.legend) ?? deck.name) : null;
  const cells = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={person.name} image={person.image} />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={`truncate ${me ? "font-semibold text-accent" : ""} ${dropped ? "text-fg-faint line-through" : ""}`}
            >
              {person.name}
            </span>
            {standing && standing.byes > 0 ? <Pill size="sm">bye</Pill> : null}
          </span>
          <span className="block truncate text-xs text-fg-dim sm:hidden">
            {deckLabel ?? <span className="text-fg-faint">No deck</span>}
          </span>
        </span>
      </span>
      <span className="hidden truncate text-fg-dim sm:block">
        {deckLabel ?? <span className="text-fg-faint">—</span>}
      </span>
      <span className="text-right font-mono tabular-nums">{elo ?? "—"}</span>
      <span className="text-right font-mono tabular-nums text-fg-dim">
        {standing ? recordLabel(standing) : ""}
      </span>
    </>
  );

  const rowClass = `border-b border-hair-soft last:border-0 ${me ? "bg-accent/[0.06]" : ""}`;

  if (!deck)
    return (
      <li className={rowClass}>
        <div className={`${ROW} px-4 py-3 text-sm`}>
          {cells}
          <span />
        </div>
      </li>
    );

  return (
    <li className={rowClass}>
      <details className="group">
        <summary
          className={`${ROW} cursor-pointer list-none px-4 py-3 text-sm transition-colors hover:bg-raised`}
        >
          {cells}
          <span className="flex justify-end">
            <span className="sr-only">Decklist</span>
            <ExpandIcon />
          </span>
        </summary>
        <div className="px-4 pb-4">
          <DeckListing deck={deck} />
        </div>
      </details>
    </li>
  );
}
