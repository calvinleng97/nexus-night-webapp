import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { listDecksForUser } from "@/lib/store/repo";
import { decklistText } from "@/lib/domain/deck";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { CardLink, DeckDisclosure } from "@/components/deck-view";
import { Card, Empty, Field, LinkButton, PageHeader, inputClass } from "@/components/ui";
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
        <ul className="space-y-3">
          {decks.map((d) => (
            <Card as="li" key={d.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1.05rem] font-semibold">{d.name}</p>
                  {d.legend && d.legend !== d.name ? (
                    <p className="mt-1 text-sm text-accent">
                      <CardLink name={d.legend} legend />
                    </p>
                  ) : !d.legend ? (
                    <p className="mt-1 text-sm text-fg-faint">No Legend</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <CopyButton
                    text={decklistText(d)}
                    className="!h-8 !rounded-lg !px-3 !text-[0.8rem]"
                    label="Copy"
                    title="Copy the decklist to import back into RiftAtlas"
                  />
                  <ActionForm
                    action={deleteDeckAction}
                    fields={{ deckId: d.id }}
                    label="Delete"
                    variant="ghost"
                    size="sm"
                    confirm="Delete?"
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
