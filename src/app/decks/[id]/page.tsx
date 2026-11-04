import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { decklistText } from "@/lib/domain/deck";
import { deckVersions, diffDecks, recordByVersion } from "@/lib/domain/deck-versions";
import { formatDay } from "@/lib/domain/schedule";
import { recordLabel } from "@/lib/domain/standings";
import { getDeck } from "@/lib/store/repo";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { DeckArt, RuneSplit } from "@/components/deck-gallery";
import { CardLink, DeckListing } from "@/components/deck-view";
import {
  BackLink,
  Card,
  Chevron,
  Field,
  LinkButton,
  Pill,
  Section,
  Stat,
  WinRate,
  inputClass,
} from "@/components/ui";
import { deleteDeckAction, updateDeckAction } from "../../actions";
import { deckStatsFor, winRateOf } from "../stats";

/**
 * One saved deck: its Legend's art, how it has done, and the list itself
 * (the shared viewer: cards by default, or the text list).
 */
export default async function DeckPage(props: PageProps<"/decks/[id]">) {
  const { id } = await props.params;
  const { edit } = await props.searchParams;
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const deck = await getDeck(id);
  // Saved decks are personal; what others played lives on events and leagues.
  if (!deck || deck.ownerId !== userId) notFound();
  const played = (await deckStatsFor(userId)).get(deck.id) ?? null;
  const editing = edit === "1";
  const versions = deckVersions(deck);
  const byVersion = recordByVersion(played?.outings ?? []);

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
            {editing ? null : (
              <>
                <LinkButton href={`/decks/${deck.id}/build`} size="sm" variant="primary">
                  Edit
                </LinkButton>
                <LinkButton href={`/decks/${deck.id}?edit=1`} size="sm" variant="ghost">
                  Edit text
                </LinkButton>
              </>
            )}
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

      {editing ? (
        <Card className="mt-4 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[1.05rem] font-semibold">Edit as text</h2>
            <Link href={`/decks/${deck.id}`} className="text-sm text-fg-dim hover:text-fg">
              Cancel
            </Link>
          </div>
          <ActionForm
            action={updateDeckAction}
            fields={{ deckId: deck.id }}
            label="Save changes"
            variant="solid"
            size="lg"
          >
            <div className="mb-4 space-y-4">
              <Field label="Name">
                <input
                  name="name"
                  defaultValue={deck.name}
                  maxLength={80}
                  className={inputClass}
                  placeholder="Left blank, the Legend's name is used"
                />
              </Field>
              <Field label="Decklist">
                <textarea
                  name="source"
                  required
                  autoFocus
                  rows={18}
                  spellCheck={false}
                  // The original paste, so an edit starts from exactly what was imported.
                  defaultValue={deck.source || decklistText(deck)}
                  className={`${inputClass} resize-y font-mono text-[0.8rem] leading-relaxed`}
                />
              </Field>
            </div>
          </ActionForm>
        </Card>
      ) : null}

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

      <Section title="Cards">
        {/* The hero already names the Legend. */}
        <DeckListing deck={deck} showLegend={false} />
      </Section>

      {versions.length > 1 ? (
        <Section title="Versions" count={versions.length}>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-hair-soft">
              {versions.map((v, i) => {
                const prev = versions[i + 1];
                const diff = prev ? diffDecks(prev, v) : null;
                const rec = byVersion.get(v.version);
                return (
                  <li key={v.version} className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Pill tone={v.current ? "accent" : "neutral"}>v{v.version}</Pill>
                      <span className="min-w-0 flex-1 truncate text-sm text-fg-dim">
                        {v.current ? "Current" : null}
                        {v.current ? " · " : null}
                        {formatDay(v.savedAt)}
                      </span>
                      {rec ? (
                        <>
                          <span className="font-mono text-sm tabular-nums text-fg-dim">
                            {recordLabel(rec)}
                          </span>
                          <WinRate rate={winRateOf(rec)} />
                        </>
                      ) : (
                        <Pill size="sm">Unplayed</Pill>
                      )}
                    </div>
                    {diff ? (
                      <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label={`Changes in v${v.version}`}>
                        {diff.legend ? (
                          <li>
                            <Pill size="sm" tone="accent">
                              Legend → {diff.legend[1] ?? "none"}
                            </Pill>
                          </li>
                        ) : null}
                        {diff.cards.map((c) => (
                          <li key={`${c.section}-${c.name}`}>
                            <Pill size="sm" tone={c.delta > 0 ? "win" : "loss"}>
                              <span className="font-mono tabular-nums">
                                {c.delta > 0 ? "+" : "−"}
                                {Math.abs(c.delta)}
                              </span>
                              {c.name}
                              {c.section !== "Main deck" ? (
                                <span className="text-fg-faint">{c.section.toLowerCase()}</span>
                              ) : null}
                            </Pill>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </Section>
      ) : null}

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
                    {versions.length > 1 ? <Pill size="sm">v{o.version}</Pill> : null}
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
