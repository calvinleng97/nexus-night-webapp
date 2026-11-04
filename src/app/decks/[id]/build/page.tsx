import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { cardPool } from "@/lib/domain/card-pool";
import type { DeckCard } from "@/lib/domain/types";
import { getDeck } from "@/lib/store/repo";
import { DeckBuilder } from "@/components/deck-builder";
import { BackLink } from "@/components/ui";

const counts = (cards: DeckCard[]) => {
  const out: Record<string, number> = {};
  for (const c of cards) out[c.name] = (out[c.name] ?? 0) + c.count;
  return out;
};

/** Edit a saved deck from card art. Saving makes a new version if the cards changed. */
export default async function DeckBuilderPage(props: PageProps<"/decks/[id]/build">) {
  const { id } = await props.params;
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const deck = await getDeck(id);
  if (!deck || deck.ownerId !== userId) notFound();

  return (
    <div className="lg:-mx-24 xl:-mx-40">
      <BackLink href={`/decks/${deck.id}`}>{deck.name}</BackLink>
      <div className="mt-3">
        <DeckBuilder
          pool={cardPool()}
          deckId={deck.id}
          start={{
            name: deck.name,
            legend: deck.legend,
            champion: deck.champions[0]?.name ?? null,
            main: counts(deck.mainDeck),
            battlefields: counts(deck.battlefields),
            runes: counts(deck.runes),
            sideboard: counts(deck.sideboard),
          }}
        />
      </div>
    </div>
  );
}
