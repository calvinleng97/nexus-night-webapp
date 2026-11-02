import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import {
  leagueDeckHistory,
  legendUsage,
  summarizeLeagueDecks,
  type PlayedDeck,
} from "@/lib/domain/league-decks";
import { formatDay } from "@/lib/domain/schedule";
import { getLeague, getUsers, listEventsForLeague } from "@/lib/store/repo";
import { DeckDisclosure } from "@/components/deck-view";
import {
  Badge,
  Card,
  CountPill,
  Empty,
  SectionHead,
  Stat,
  Tag,
} from "@/components/ui";

function record(d: Pick<PlayedDeck, "wins" | "losses" | "draws">): string {
  return d.draws > 0 ? `${d.wins}-${d.losses}-${d.draws}` : `${d.wins}-${d.losses}`;
}

/**
 * The Decks tab: every deck played in this league, by player.
 *
 * Members only, like the league page itself: the join code is what gates a
 * league, so anyone who is not in it gets sent back to the door.
 */
export default async function LeagueDecksPage(props: PageProps<"/leagues/[id]/decks">) {
  const { id } = await props.params;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const league = await getLeague(id);
  if (!league) notFound();
  if (!league.memberIds.includes(userId)) redirect(`/leagues/${id}`);

  const events = await listEventsForLeague(id);
  const history = leagueDeckHistory(events, league.memberIds);
  // Everyone in the history, not just current members: someone who has since
  // left the league still played the decks they played.
  const users = await getUsers(history.map((h) => h.userId));
  const totals = summarizeLeagueDecks(history);
  const legends = legendUsage(history);

  const withDecks = history.filter((h) => h.decks.length > 0);
  const withoutDecks = history.filter((h) => h.decks.length === 0);
  const nameOf = (uid: string) => users.get(uid)?.name ?? "Unknown";

  return (
    <div>
      {totals.decks === 0 ? (
        <Empty>No decks played yet.</Empty>
      ) : (
        <>
          <div className="mb-9 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Decks" value={String(totals.decks)} />
            <Stat label="Legends" value={String(totals.legends)} />
            <Stat label="Players" value={String(totals.players)} />
            <Stat label="Events" value={String(totals.events)} />
          </div>

          {legends.length > 0 ? (
            <div className="mb-9">
              <SectionHead count={legends.length}>Legends played</SectionHead>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hair text-left text-xs uppercase tracking-wide text-fg-faint">
                      <th className="py-2.5 pl-4 pr-2 font-medium">Legend</th>
                      <th className="py-2.5 pr-2 text-right font-medium">Players</th>
                      <th className="py-2.5 pr-2 text-right font-medium">Decks</th>
                      <th className="py-2.5 pr-4 text-right font-medium">Brought</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legends.map((l) => (
                      <tr key={l.legend} className="border-b border-hair-soft last:border-0">
                        <td className="py-2.5 pl-4 pr-2 text-accent">{l.legend}</td>
                        <td className="py-2.5 pr-2 text-right font-mono tabular-nums text-fg-dim">
                          {l.players}
                        </td>
                        <td className="py-2.5 pr-2 text-right font-mono tabular-nums text-fg-dim">
                          {l.decks}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {l.outings}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          ) : null}

          {withDecks.map((player) => (
            <div key={player.userId} className="mb-9">
              <SectionHead
                count={player.decks.length}
                action={
                  player.eventsWithoutDeck > 0 ? (
                    <CountPill value={player.eventsWithoutDeck} label="no deck" tone="warn" />
                  ) : null
                }
              >
                <span className={player.userId === userId ? "text-accent" : ""}>
                  {nameOf(player.userId)}
                </span>
              </SectionHead>

              <ul className="space-y-2.5">
                {player.decks.map((deck) => (
                  <Card as="li" key={deck.deckId} className="p-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="font-medium">{deck.name}</p>
                      {deck.legend && deck.legend !== deck.name ? (
                        <p className="text-sm text-accent">{deck.legend}</p>
                      ) : null}
                      <span className="ml-auto font-mono text-sm tabular-nums text-fg-dim">
                        {record(deck)}
                      </span>
                    </div>

                    <ul className="mt-3 divide-y divide-hair-soft border-t border-hair-soft">
                      {deck.outings.map((o) => (
                        <li
                          key={o.eventId}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                        >
                          <Link
                            href={`/events/${o.eventId}`}
                            className="min-w-0 flex-1 truncate text-sm hover:text-accent"
                          >
                            {o.eventName}
                          </Link>
                          {formatDay(o.at) ? (
                            <span className="font-mono text-xs tabular-nums text-fg-faint">
                              {formatDay(o.at)}
                            </span>
                          ) : null}
                          {o.status === "running" ? <Badge tone="accent">live</Badge> : null}
                          <span className="font-mono text-sm tabular-nums text-fg-dim">
                            {record(o)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3">
                      <DeckDisclosure deck={deck.snapshot} />
                    </div>
                  </Card>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {withoutDecks.length > 0 ? (
        <div className="mt-9 border-t border-hair-soft pt-6">
          <SectionHead count={withoutDecks.length}>Nothing registered</SectionHead>
          <ul className="flex flex-wrap gap-2">
            {withoutDecks.map((p) => (
              <li key={p.userId}>
                <Tag tone={p.userId === userId ? "accent" : "plain"}>{nameOf(p.userId)}</Tag>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
