import { loadConfig } from "@/lib/config";
import { shortLegend } from "@/lib/domain/deck";
import { computeLeagueElo } from "@/lib/domain/elo";
import { computeStandings, recordLabel } from "@/lib/domain/standings";
import type { EventPlayer, Standing } from "@/lib/domain/types";
import { getLeague, listEventsForLeague } from "@/lib/store/repo";
import { DeckListing, ExpandIcon } from "@/components/deck-view";
import { Badge, Card, Empty } from "@/components/ui";
import { loadEventView } from "../load";

/**
 * Player · Deck · Elo · Record, shared by the header and every row. On phones
 * the Deck column folds under the player's name so names have room.
 */
const ROW =
  "grid grid-cols-[minmax(0,1fr)_2.75rem_3.25rem_2.75rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_3.25rem_3.5rem_3rem] sm:gap-x-3";

/**
 * The Players tab: everyone in the event as one table — their deck, their
 * league Elo, and their record here, which fills in as results are confirmed.
 * A row with a deck opens to show the full list; anyone can look.
 */
export default async function EventPlayersPage(props: PageProps<"/events/[id]/players">) {
  const { id } = await props.params;
  const { userId, event, nameOf } = await loadEventView(id);

  const league = await getLeague(event.leagueId);
  const leagueEvents = league ? await listEventsForLeague(league.id) : [];
  const elo = new Map(
    computeLeagueElo(leagueEvents, league?.memberIds ?? [], loadConfig().elo).map((r) => [
      r.userId,
      r.rating,
    ]),
  );

  const started = event.status !== "draft";
  const standings = new Map(computeStandings(event).map((s) => [s.userId, s]));
  // Before the start, sign-up order; after, the order they're standing in.
  const players: EventPlayer[] = started
    ? computeStandings(event)
        .map((s) => event.players.find((p) => p.userId === s.userId))
        .filter((p): p is EventPlayer => p !== undefined)
    : event.players;

  if (players.length === 0)
    return (
      <Card className="p-5">
        <Empty>Nobody yet.</Empty>
      </Card>
    );

  return (
    <Card className="overflow-hidden">
      <div
        className={`${ROW} border-b border-hair px-4 py-2.5 text-xs uppercase tracking-wide text-fg-faint`}
      >
        <span>Player</span>
        <span className="hidden sm:block">Deck</span>
        <span className="text-right">Elo</span>
        <span className="text-right">Record</span>
        <span />
      </div>
      <ul>
        {players.map((p) => (
          <PlayerRow
            key={p.userId}
            player={p}
            name={nameOf(p.userId)}
            me={p.userId === userId}
            elo={elo.get(p.userId) ?? null}
            standing={started ? (standings.get(p.userId) ?? null) : null}
          />
        ))}
      </ul>
    </Card>
  );
}

function PlayerRow({
  player,
  name,
  me,
  elo,
  standing,
}: {
  player: EventPlayer;
  name: string;
  me: boolean;
  elo: number | null;
  standing: Standing | null;
}) {
  const deck = player.deck;
  const dropped = player.droppedAfterRound !== null;
  const deckLabel = deck ? (shortLegend(deck.legend) ?? deck.name) : null;
  const cells = (
    <>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={`truncate ${me ? "text-accent" : ""} ${dropped ? "text-fg-faint line-through" : ""}`}
          >
            {name}
          </span>
          {standing && standing.byes > 0 ? <Badge>bye</Badge> : null}
        </span>
        {deckLabel ? (
          <span className="block truncate text-xs text-fg-dim sm:hidden">{deckLabel}</span>
        ) : null}
      </span>
      <span className="hidden truncate text-fg-dim sm:block">
        {deckLabel ?? <span className="text-fg-faint">—</span>}
      </span>
      <span className="text-right font-mono tabular-nums">{elo ?? "—"}</span>
      <span className="text-right font-mono tabular-nums text-fg-dim">
        {standing ? recordLabel(standing) : "—"}
      </span>
    </>
  );

  const rowClass = `border-b border-hair-soft last:border-0 ${me ? "bg-accent/5" : ""}`;

  if (!deck)
    return (
      <li className={rowClass}>
        <div className={`${ROW} px-4 py-2.5 text-sm`}>
          {cells}
          <span />
        </div>
      </li>
    );

  return (
    <li className={rowClass}>
      <details className="group">
        <summary
          className={`${ROW} cursor-pointer list-none px-4 py-2.5 text-sm transition-colors hover:bg-raised`}
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
