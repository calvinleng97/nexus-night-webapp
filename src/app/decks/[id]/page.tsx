import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { decklistText } from "@/lib/domain/deck";
import { formatDay } from "@/lib/domain/schedule";
import { recordLabel } from "@/lib/domain/standings";
import { getDeck } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { DeckArt, DeckGallery, RuneSplit } from "@/components/deck-gallery";
import { CardLink, DeckListing } from "@/components/deck-view";
import { BackLink, Card, Chevron, Pill, Section, Stat, WinRate } from "@/components/ui";
import { deleteDeckAction } from "../../actions";
import { deckStatsFor, winRateOf } from "../stats";

/**
 * One saved deck: its Legend's art, how it has done, and the list itself —
 * as cards by default (each one readable on hover or tap), or as text to
 * scan or copy.
 */
export default async function DeckPage(props: PageProps<"/decks/[id]">) {
  const { id } = await props.params;
  const { view } = await props.searchParams;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const deck = await getDeck(id);
  // Saved decks are personal; what others played lives on events and leagues.
  if (!deck || deck.ownerId !== userId) notFound();
  const played = (await deckStatsFor(userId)).get(deck.id) ?? null;
  const asList = view === "list";

  const viewTab = (label: string, list: boolean) => (
    <Link
      href={list ? `/decks/${deck.id}?view=list` : `/decks/${deck.id}`}
      scroll={false}
      aria-current={asList === list ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        asList === list ? "bg-raised text-fg shadow-sm shadow-black/40" : "text-fg-faint hover:text-fg-dim"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <BackLink href="/decks">My decks</BackLink>

      <header className="relative mt-3 overflow-hidden rounded-3xl border border-hair-soft bg-surface">
        <DeckArt legend={deck.legend} className="h-48 sm:h-64" />
        <div className="relative -mt-16 p-5 pt-0 sm:p-6 sm:pt-0">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-balance sm:text-[2rem]">
            {deck.name}
          </h1>
          {deck.legend ? (
            <p className="mt-1 text-accent">
              <CardLink name={deck.legend} legend />
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <RuneSplit runes={deck.runes} />
            <span className="flex-1" />
            <CopyButton
              text={decklistText(deck)}
              className="!h-8 !rounded-lg !px-3 !text-[0.8rem]"
              label="Copy list"
              title="Copy the decklist to import back into RiftAtlas"
            />
            <ActionForm
              action={deleteDeckAction}
              fields={{ deckId: deck.id }}
              label="Delete"
              variant="ghost"
              size="sm"
              confirm="Delete deck?"
            />
          </div>
        </div>
      </header>

      {played ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Nights" value={String(played.outings.length)} />
          <Stat label="Record" value={recordLabel(played)} />
          <Stat
            label="Win rate"
            value={winRateOf(played) === null ? "—" : `${Math.round(winRateOf(played)! * 100)}%`}
            footer={<WinRate size="tile" rate={winRateOf(played)} />}
          />
        </div>
      ) : (
        <div className="mt-4 flex">
          <Pill>Unplayed</Pill>
        </div>
      )}

      <Section
        title="Cards"
        action={
          <nav aria-label="Decklist view" className="flex gap-1 rounded-xl border border-hair-soft bg-ink/60 p-1">
            {viewTab("Cards", false)}
            {viewTab("List", true)}
          </nav>
        }
      >
        {asList ? <DeckListing deck={deck} /> : <DeckGallery deck={deck} />}
      </Section>

      {played ? (
        <Section title="Played at" count={played.outings.length}>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-hair-soft">
              {played.outings.map((o) => (
                <li key={o.eventId}>
                  <Link
                    href={`/events/${o.eventId}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised"
                  >
                    <span className="w-14 shrink-0 font-mono text-xs tabular-nums text-fg-faint">
                      {formatDay(o.at)?.replace(/ \d{4}$/, "")}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.eventName}</span>
                    {o.status === "running" ? (
                      <Pill size="sm" tone="win" pulse>
                        live
                      </Pill>
                    ) : null}
                    <span className="font-mono text-sm tabular-nums text-fg-dim">{recordLabel(o)}</span>
                    <WinRate rate={winRateOf(o)} />
                    <Chevron />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}
    </div>
  );
}
