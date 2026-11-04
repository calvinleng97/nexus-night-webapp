import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { cardPool } from "@/lib/domain/card-pool";
import { DeckBuilder } from "@/components/deck-builder";
import { BackLink } from "@/components/ui";

/** Build a new deck from card art. */
export default async function NewDeckBuilderPage() {
  if (!(await currentUserId())) redirect("/");
  return (
    <div className="lg:-mx-24 xl:-mx-40">
      <BackLink href="/decks">My decks</BackLink>
      <div className="mt-3">
        <DeckBuilder
          pool={cardPool()}
          deckId={null}
          start={{ name: "", legend: null, champion: null, main: {}, battlefields: {}, runes: {}, sideboard: {} }}
        />
      </div>
    </div>
  );
}
