import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { listDecksForUser } from "@/lib/store/repo";
import { decklistText } from "@/lib/domain/deck";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { CardLink, DeckDisclosure } from "@/components/deck-view";
import { Card, Empty, Field, PageTitle, SectionHead, inputClass } from "@/components/ui";
import { addDeckAction, deleteDeckAction } from "../actions";

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

  const decks = await listDecksForUser(userId);

  return (
    <div>
      <PageTitle>My decks</PageTitle>

      <SectionHead
        count={decks.length}
        action={
          adding ? null : (
            <Link
              href="/decks?new=1"
              aria-label="Add a deck"
              title="Add a deck"
              className="inline-flex size-7 items-center justify-center rounded-lg border border-hair bg-raised text-base leading-none text-fg-dim transition-colors hover:border-accent/40 hover:text-accent"
            >
              <span aria-hidden>+</span>
            </Link>
          )
        }
      >
        Saved
      </SectionHead>

      {adding ? (
        <Card className="mb-3 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Paste a decklist</h3>
            <Link href="/decks" className="px-1 text-sm text-fg-faint hover:text-fg">
              Cancel
            </Link>
          </div>
          <ActionForm action={addDeckAction} label="Save deck" variant="primary">
            <div className="mb-3 space-y-3">
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
        <Empty>
          No decks yet — tap <span className="text-fg-dim">+</span> and paste one from RiftAtlas.
        </Empty>
      ) : (
        <ul className="space-y-2.5">
          {decks.map((d) => (
            <Card as="li" key={d.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.name}</p>
                  {d.legend && d.legend !== d.name ? (
                    <p className="mt-1 text-sm text-accent">
                      <CardLink name={d.legend} />
                    </p>
                  ) : !d.legend ? (
                    <p className="mt-1 text-sm text-fg-faint">No Legend in this list</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <CopyButton
                    text={decklistText(d)}
                    label="Copy list"
                    title="Copy the decklist to import back into RiftAtlas"
                  />
                  <ActionForm
                    action={deleteDeckAction}
                    fields={{ deckId: d.id }}
                    label="Delete"
                    variant="danger"
                    confirm="Confirm delete"
                    compact
                  />
                </div>
              </div>
              <div className="mt-3">
                <DeckDisclosure deck={d} label="Full list" />
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
