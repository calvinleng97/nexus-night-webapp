import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { matchHistory, recordString, summarize } from "@/lib/domain/history";
import type { ReactNode } from "react";
import { hasCardList, shortLegend } from "@/lib/domain/deck";
import { leagueDeckHistory } from "@/lib/domain/league-decks";
import { recordLabel } from "@/lib/domain/standings";
import type { RegisteredDeck, UserId } from "@/lib/domain/types";
import { DeckListing } from "@/components/deck-view";
import { getUsers, listDecksForUser, listEventsForUser } from "@/lib/store/repo";
import {
  Avatar,
  Card,
  Chevron,
  Empty,
  LinkButton,
  PageHeader,
  Pill,
  Score,
  Section,
  Stat,
  WinRate,
  thClass,
} from "@/components/ui";

const RESULT = {
  win: { letter: "W", cls: "bg-win/15 text-win" },
  loss: { letter: "L", cls: "bg-loss/15 text-loss" },
  draw: { letter: "D", cls: "bg-draw/15 text-draw" },
} as const;

export default async function HistoryPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const [events, saved] = await Promise.all([listEventsForUser(userId), listDecksForUser(userId)]);
  const versioned = new Set(saved.filter((d) => (d.version ?? 1) > 1).map((d) => d.id));
  const entries = matchHistory(events, userId);
  const totals = summarize(entries);

  const users = await getUsers(
    entries.map((e) => e.opponentId).filter((x): x is UserId => x !== null),
  );
  const nameOf = (id: UserId | null) => (id ? (users.get(id)?.name ?? "Unknown") : "—");

  if (entries.length === 0)
    return (
      <div>
        <PageHeader title="History" />
        <Empty
          action={
            <LinkButton href="/leagues" variant="primary">
              Find an event
            </LinkButton>
          }
        >
          No matches yet.
        </Empty>
      </div>
    );

  // Group by event, preserving the newest-first order of the entries.
  const byEvent: Array<{ id: string; name: string; rows: typeof entries }> = [];
  for (const e of entries) {
    const last = byEvent[byEvent.length - 1];
    if (last && last.id === e.eventId) last.rows.push(e);
    else byEvent.push({ id: e.eventId, name: e.eventName, rows: [e] });
  }

  const winRate = totals.matches > 0 ? Math.round((totals.wins / totals.matches) * 100) : null;

  // What everyone brought, per event: the snapshots the events kept.
  const decksAt = new Map(
    events.map((e) => [e.id, new Map(e.players.map((p) => [p.userId, p.deck]))]),
  );
  const deckOf = (eventId: string, uid: UserId | null): RegisteredDeck | null =>
    uid ? (decksAt.get(eventId)?.get(uid) ?? null) : null;
  // Same aggregation the league Decks tab uses, here across every league.
  const myDecks = leagueDeckHistory(events).find((h) => h.userId === userId)?.decks ?? [];

  return (
    <div>
      <PageHeader title="History" />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Record" value={recordString(totals)} />
        <Stat
          label="Win rate"
          value={winRate === null ? "—" : `${winRate}%`}
          footer={<WinRate size="tile" rate={winRate === null ? null : winRate / 100} />}
        />
        <Stat label="Games" value={`${totals.gamesWon}–${totals.gamesLost}`} />
      </div>

      {myDecks.length > 0 ? (
        <Section title="By deck" count={myDecks.length}>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hair-soft text-left">
                  <th className={`${thClass} pl-4 pr-2`}>Deck</th>
                  <th className={`${thClass} pr-2 text-right`}>Nights</th>
                  <th className={`${thClass} pr-2 text-right`}>Record</th>
                  <th className={`${thClass} pr-4 text-right`}>Win rate</th>
                </tr>
              </thead>
              <tbody>
                {myDecks.map((d) => {
                  const rounds = d.wins + d.losses + d.draws;
                  const wr = rounds > 0 ? d.wins / rounds : null;
                  return (
                    <tr key={d.deckId} className="border-b border-hair-soft last:border-0">
                      <td className="py-2.5 pl-4 pr-2">
                        <span className="block truncate font-medium">{d.name}</span>
                        {d.legend && d.legend !== d.name ? (
                          <span className="block truncate text-xs text-fg-faint">{shortLegend(d.legend)}</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-2 text-right font-mono tabular-nums text-fg-dim">{d.outings.length}</td>
                      <td className="py-2.5 pr-2 text-right font-mono tabular-nums text-fg-dim">{recordLabel(d)}</td>
                      <td className="py-2.5 pr-4">
                        <WinRate rate={wr} className="ml-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </Section>
      ) : null}

      <Section title="Nights" count={byEvent.length}>
        <div className="space-y-4">
          {byEvent.map((group) => {
            const played = group.rows.filter((r) => r.result !== "pending" && r.result !== "bye");
            const wins = played.filter((r) => r.result === "win").length;
            const draws = played.filter((r) => r.result === "draw").length;
            const losses = played.length - wins - draws;
            const mine = deckOf(group.id, userId);
            return (
              <Card key={group.id} className="overflow-hidden">
                <Link
                  href={`/events/${group.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">{group.name}</span>
                  <span
                    className={`rounded-lg px-2.5 py-1 font-mono text-base font-bold tabular-nums ${
                      wins > losses
                        ? "bg-win/15 text-win"
                        : wins < losses
                          ? "bg-loss/15 text-loss"
                          : "bg-draw/15 text-draw"
                    }`}
                  >
                    {recordString({ wins, losses, draws })}
                  </span>
                  <Chevron />
                </Link>

                {/* The deck you brought, opening to its list. */}
                <DeckRow
                  deck={mine}
                  lead={<span className="w-7 shrink-0 text-xs font-semibold text-accent">You</span>}
                  title={mine ? mine.name : "No deck"}
                  subtitle={
                    [
                      mine?.legend && mine.legend !== mine.name ? shortLegend(mine.legend) : null,
                      // Which version you brought, once the deck has more than one.
                      mine && versioned.has(mine.deckId) ? `v${mine.version ?? 1}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                  tone="mine"
                />

                <ul className="divide-y divide-hair-soft border-t border-hair-soft">
                  {[...group.rows]
                    .sort((a, b) => a.roundNumber - b.roundNumber)
                    .map((r) => {
                      const theirs = deckOf(r.eventId, r.opponentId);
                      const result =
                        r.result === "pending" ? (
                          <Pill size="sm">In progress</Pill>
                        ) : r.result === "bye" ? (
                          <Pill size="sm" tone="accent">
                            Free win
                          </Pill>
                        ) : (
                          <>
                            <Score mine={r.mine} theirs={r.theirs} />
                            <span
                              className={`inline-flex size-6 items-center justify-center rounded-md text-xs font-bold ${RESULT[r.result].cls}`}
                            >
                              {RESULT[r.result].letter}
                            </span>
                          </>
                        );
                      return (
                        <li key={`${r.eventId}-${r.roundNumber}`}>
                          <DeckRow
                            deck={r.result === "bye" ? null : theirs}
                            lead={
                              <>
                                <span className="w-7 shrink-0 font-mono text-xs text-fg-faint">
                                  R{r.roundNumber}
                                </span>
                                {r.result === "bye" ? null : (
                                  <Avatar
                                    name={nameOf(r.opponentId)}
                                    image={r.opponentId ? users.get(r.opponentId)?.image : null}
                                    size="xs"
                                  />
                                )}
                              </>
                            }
                            title={r.result === "bye" ? "Bye" : nameOf(r.opponentId)}
                            subtitle={theirs && r.result !== "bye" ? (shortLegend(theirs.legend) ?? theirs.name) : null}
                            trailing={result}
                          />
                        </li>
                      );
                    })}
                </ul>
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

/**
 * A row that names a deck and, when its cards were kept, opens to the full
 * list — the opponent's, so you can see what beat you, or your own.
 */
function DeckRow({
  deck,
  lead,
  title,
  subtitle,
  trailing,
  tone,
}: {
  deck: RegisteredDeck | null;
  lead: ReactNode;
  title: string;
  subtitle: string | null;
  trailing?: ReactNode;
  tone?: "mine";
}) {
  const row = (open: boolean) => (
    <>
      {lead}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${tone === "mine" ? "font-medium" : ""}`}>{title}</span>
        {subtitle ? <span className="block truncate text-xs text-fg-faint">{subtitle}</span> : null}
      </span>
      {trailing}
      {open ? (
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-fg-faint transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      ) : (
        <span className="size-4 shrink-0" />
      )}
    </>
  );
  const cls = `flex items-center gap-3 px-4 py-2.5 ${tone === "mine" ? "bg-accent/[0.05]" : ""}`;
  if (!deck || !hasCardList(deck)) return <div className={cls}>{row(false)}</div>;
  return (
    <details className="group">
      <summary className={`${cls} cursor-pointer list-none transition-colors hover:bg-raised`}>
        {row(true)}
      </summary>
      <div className="px-4 pb-4 pt-1">
        <DeckListing deck={deck} />
      </div>
    </details>
  );
}
