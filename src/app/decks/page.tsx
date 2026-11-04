import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { listDecksForUser } from "@/lib/store/repo";
import { recordLabel } from "@/lib/domain/standings";
import { ActionForm } from "@/components/action-form";
import { DeckArt, RuneSplit } from "@/components/deck-gallery";
import { Card, Empty, Field, LinkButton, PageHeader, Pill, WinRate, inputClass } from "@/components/ui";
import { addDeckAction } from "../actions";
import { deckStatsFor, winRateOf } from "./stats";

const PLACEHOLDER = `Legend:
1 Riven, The Exile

Champion:
1 Riven, Broken Blade

MainDeck:
3 Astral Heron
1 Baron Nashor
...

Battlefields:
1 Emperor's Dais

Runes:
6 Calm Rune
6 Chaos Rune`;

export default async function DecksPage(props: PageProps<"/decks">) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const { new: adding } = await props.searchParams;

  const [decks, stats] = await Promise.all([listDecksForUser(userId), deckStatsFor(userId)]);

  return (
    <div>
      <PageHeader
        title="My decks"
        action={
          adding ? null : (
            <LinkButton href="/decks?new=1" variant="primary" size="sm">
              + Add deck
            </LinkButton>
          )
        }
      />

      {adding ? (
        <Card className="mb-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[1.05rem] font-semibold">Paste a decklist</h3>
            <Link href="/decks" className="text-sm text-fg-dim hover:text-fg">
              Cancel
            </Link>
          </div>
          <ActionForm action={addDeckAction} label="Save deck" variant="solid" size="lg">
            <div className="mb-4 space-y-4">
              <Field label="Name">
                <input
                  name="name"
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
                  rows={14}
                  spellCheck={false}
                  placeholder={PLACEHOLDER}
                  className={`${inputClass} resize-y font-mono text-[0.8rem] leading-relaxed`}
                />
              </Field>
            </div>
          </ActionForm>
        </Card>
      ) : null}

      {decks.length === 0 && !adding ? (
        <Empty
          action={
            <LinkButton href="/decks?new=1" variant="solid">
              + Add your first deck
            </LinkButton>
          }
        >
          No decks yet.
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {decks.map((d) => {
            const played = stats.get(d.id);
            return (
              <Card as="li" key={d.id} interactive className="relative overflow-hidden">
                <DeckArt legend={d.legend} className="h-28" sizes="(min-width: 640px) 360px, 100vw" />
                <div className="relative -mt-8 p-4 pt-0">
                  <Link
                    href={`/decks/${d.id}`}
                    className="block truncate text-[1.1rem] font-bold after:absolute after:inset-0"
                  >
                    {d.name}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-accent">
                    {d.legend ?? <span className="text-fg-faint">No Legend</span>}
                  </p>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="min-w-0 flex-1">
                      <RuneSplit runes={d.runes} />
                    </span>
                    {played ? (
                      <>
                        <span className="font-mono text-sm tabular-nums text-fg-dim">
                          {recordLabel(played)}
                        </span>
                        <WinRate rate={winRateOf(played)} />
                      </>
                    ) : (
                      <Pill size="sm">Unplayed</Pill>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
