import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { shortLegend } from "@/lib/domain/deck";
import {
  leagueDeckHistory,
  legendUsage,
  summarizeLeagueDecks,
  type PlayedDeck,
} from "@/lib/domain/league-decks";
import { formatDay } from "@/lib/domain/schedule";
import { recordLabel } from "@/lib/domain/standings";
import type { UserId } from "@/lib/domain/types";
import { getLeague, getUsers, listEventsForLeague } from "@/lib/store/repo";
import { CardLink, DeckListing } from "@/components/deck-view";
import { Avatar, Card, Empty, Pill, Section, Stat, WinRate, thClass } from "@/components/ui";

/** Rows shown before "Show all", so a big league doesn't open as a wall. */
const PAGE = 15;
/** Legends shown in the meta table before the rest fold away. */
const TOP_LEGENDS = 6;

function winRate(d: { wins: number; losses: number; draws: number }): number | null {
  const rounds = d.wins + d.losses + d.draws;
  return rounds > 0 ? d.wins / rounds : null;
}

/**
 * The Decks tab, built to scale with the league: overview first (the meta),
 * then filter (by player or Legend, kept in the URL so it can be shared), then
 * details on demand (each deck row opens to its outings and full list).
 *
 * Members only, like the league page itself.
 */
export default async function LeagueDecksPage(props: PageProps<"/leagues/[id]/decks">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
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
  const nameOf = (uid: string) => users.get(uid)?.name ?? "Unknown";

  if (totals.decks === 0) return <Empty>No decks played yet.</Empty>;

  const player = typeof sp.player === "string" ? sp.player : null;
  const legend = typeof sp.legend === "string" ? sp.legend : null;
  const showAll = sp.all === "1";
  const base = `/leagues/${league.id}/decks`;
  const href = (next: { player?: string | null; legend?: string | null; all?: boolean }) => {
    const q = new URLSearchParams();
    const p = next.player === undefined ? player : next.player;
    const l = next.legend === undefined ? legend : next.legend;
    if (p) q.set("player", p);
    if (l) q.set("legend", l);
    if (next.all) q.set("all", "1");
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  const all: Array<PlayedDeck & { userId: UserId }> = history
    .flatMap((h) => h.decks.map((d) => ({ ...d, userId: h.userId })))
    .sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt));
  const filtered = all.filter(
    (d) => (!player || d.userId === player) && (!legend || d.legend === legend),
  );
  const shown = showAll ? filtered : filtered.slice(0, PAGE);
  const players = history.filter((h) => h.decks.length > 0);

  const legendRow = (l: (typeof legends)[number]) => {
    const on = legend === l.legend;
    return (
      <tr key={l.legend} className={`border-b border-hair-soft last:border-0 ${on ? "bg-accent/[0.08]" : ""}`}>
        <td className="py-2.5 pl-4 pr-2">
          <Link
            href={href({ legend: on ? null : l.legend })}
            className={`font-medium transition-colors hover:text-accent ${on ? "text-accent" : ""}`}
          >
            {l.legend}
          </Link>
        </td>
        <td className="py-2.5 pr-2 text-right font-mono tabular-nums text-fg-dim">{l.players}</td>
        <td className="py-2.5 pr-4">
          <WinRate rate={l.winRate} className="ml-auto" />
        </td>
      </tr>
    );
  };

  return (
    <div>
      {/* ----------------------------------------------------- overview */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Decks" value={String(totals.decks)} />
        <Stat label="Legends" value={String(totals.legends)} />
        <Stat label="Events" value={String(totals.events)} />
      </div>

      {legends.length > 0 ? (
        <Section title="Meta" count={legends.length}>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hair-soft text-left">
                  <th className={`${thClass} pl-4 pr-2`}>Legend</th>
                  <th className={`${thClass} pr-2 text-right`}>Players</th>
                  <th className={`${thClass} pr-4 text-right`}>Win rate</th>
                </tr>
              </thead>
              <tbody>{legends.slice(0, TOP_LEGENDS).map(legendRow)}</tbody>
            </table>
            {legends.length > TOP_LEGENDS ? (
              <details className="group border-t border-hair-soft">
                <summary className="cursor-pointer list-none px-4 py-2.5 text-center text-sm text-fg-dim transition-colors hover:text-fg group-open:hidden">
                  All {legends.length} legends
                </summary>
                <table className="w-full text-sm">
                  <tbody>{legends.slice(TOP_LEGENDS).map(legendRow)}</tbody>
                </table>
              </details>
            ) : null}
          </Card>
        </Section>
      ) : null}

      {/* ------------------------------------------------ filter + list */}
      <Section title="Decks" count={filtered.length}>
        <div className="mb-3 flex flex-wrap gap-2">
          <FilterChip href={href({ player: null })} on={!player}>
            Everyone
          </FilterChip>
          {players.map((h) => (
            <FilterChip
              key={h.userId}
              href={href({ player: player === h.userId ? null : h.userId })}
              on={player === h.userId}
            >
              <Avatar name={nameOf(h.userId)} image={users.get(h.userId)?.image} size="xs" />
              {h.userId === userId ? "You" : nameOf(h.userId)}
            </FilterChip>
          ))}
        </div>
        {legend ? (
          <div className="mb-3 flex">
            <Link href={href({ legend: null })}>
              <Pill tone="accent">
                {legend} <span aria-label="Clear legend filter">✕</span>
              </Pill>
            </Link>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <Empty>No decks match.</Empty>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-hair-soft">
              {shown.map((d) => (
                <DeckRow
                  key={`${d.userId}-${d.deckId}`}
                  deck={d}
                  owner={nameOf(d.userId)}
                  image={users.get(d.userId)?.image ?? null}
                  mine={d.userId === userId}
                />
              ))}
            </ul>
            {!showAll && filtered.length > PAGE ? (
              <Link
                href={href({ all: true })}
                className="block border-t border-hair-soft px-4 py-3 text-center text-sm text-fg-dim transition-colors hover:bg-raised hover:text-fg"
              >
                Show all {filtered.length}
              </Link>
            ) : null}
          </Card>
        )}
      </Section>
    </div>
  );
}

function FilterChip({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border pl-1.5 pr-3 text-sm font-medium whitespace-nowrap transition-colors first:pl-3 ${
        on
          ? "border-accent/50 bg-accent/15 text-accent"
          : "border-hair bg-surface text-fg-dim hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

/** One deck as one row; opens to where it was played and the list itself. */
function DeckRow({
  deck,
  owner,
  image,
  mine,
}: {
  deck: PlayedDeck;
  owner: string;
  image: string | null;
  mine: boolean;
}) {
  const wr = winRate(deck);
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-raised">
          <Avatar name={owner} image={image} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{deck.name}</span>
            <span className="block truncate text-xs text-fg-faint">
              <span className={mine ? "text-accent" : ""}>{mine ? "You" : owner}</span>
              {deck.legend && deck.legend !== deck.name ? ` · ${shortLegend(deck.legend)}` : ""}
              <span className="font-mono tabular-nums min-[420px]:hidden"> · {recordLabel(deck)}</span>
            </span>
          </span>
          <span className="hidden w-14 text-right font-mono text-sm tabular-nums text-fg-dim min-[420px]:block">
            {recordLabel(deck)}
          </span>
          <WinRate rate={wr} />
          <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-fg-faint transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </summary>
        <div className="space-y-3 bg-ink/40 px-4 pb-4 pt-1">
          {deck.legend ? (
            <p className="text-sm text-accent">
              <CardLink name={deck.legend} legend />
            </p>
          ) : null}
          <ul className="divide-y divide-hair-soft rounded-xl border border-hair-soft">
            {deck.outings.map((o) => (
              <li key={o.eventId} className="flex items-center gap-3 px-3 py-2">
                <Link href={`/events/${o.eventId}`} className="min-w-0 flex-1 truncate text-sm hover:text-accent">
                  {o.eventName}
                </Link>
                {o.status === "running" ? (
                  <Pill size="sm" tone="win" pulse>
                    live
                  </Pill>
                ) : null}
                <span className="font-mono text-xs tabular-nums text-fg-faint">{formatDay(o.at)}</span>
                <span className="w-12 text-right font-mono text-sm tabular-nums text-fg-dim">
                  {recordLabel(o)}
                </span>
              </li>
            ))}
          </ul>
          <DeckListing deck={deck.snapshot} />
        </div>
      </details>
    </li>
  );
}
