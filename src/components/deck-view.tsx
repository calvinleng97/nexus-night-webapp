import { cardTotal, deckSections, hasCardList } from "@/lib/domain/deck";
import type { DeckCard } from "@/lib/domain/types";
import { MicroLabel } from "./ui";

/**
 * Anything with the five card sections: a saved Deck or the snapshot an event
 * keeps of one. Both render the same way, which is the point — a list you are
 * looking at on the league page is the list that was played.
 */
export interface DeckLike {
  legend: string | null;
  champions: DeckCard[];
  mainDeck: DeckCard[];
  battlefields: DeckCard[];
  runes: DeckCard[];
  sideboard: DeckCard[];
}

function Section({ label, cards }: { label: string; cards: DeckCard[] }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <MicroLabel>{label}</MicroLabel>
        <span className="font-mono text-[0.7rem] tabular-nums text-fg-faint/70">
          {cardTotal(cards)}
        </span>
      </div>
      <ul className="mt-1.5 font-mono text-[0.78rem] leading-relaxed text-fg-dim">
        {cards.map((c, i) => (
          <li key={`${c.name}-${i}`} className="flex gap-2">
            <span className="w-5 shrink-0 text-right tabular-nums text-fg-faint">{c.count}</span>
            <span className="min-w-0 break-words text-fg">{c.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The full list, laid out by section. Plain text, so it can be copied out. */
export function DeckListing({ deck }: { deck: DeckLike }) {
  const sections = deckSections(deck);
  if (sections.length === 0)
    return (
      <p className="text-sm text-fg-faint">
        The cards for this one were not kept — it was registered before lists were recorded, and
        the deck has since been deleted.
      </p>
    );
  return (
    <div className="rounded-xl border border-hair-soft bg-ink p-4">
      {deck.legend ? (
        <div className="mb-4 border-b border-hair-soft pb-3">
          <MicroLabel>Legend</MicroLabel>
          <p className="mt-1 text-sm font-medium text-accent">{deck.legend}</p>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        {sections.map((s) => (
          <Section key={s.key} label={s.label} cards={s.cards} />
        ))}
      </div>
    </div>
  );
}

/** A collapsed full list. The default way other people's decks are shown. */
export function DeckDisclosure({
  deck,
  label = "Decklist",
}: {
  deck: DeckLike;
  label?: string;
}) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs text-fg-faint transition-colors hover:text-fg">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span> {label}
        {hasCardList(deck) ? null : <span className="ml-1.5">(not recorded)</span>}
      </summary>
      <div className="mt-2.5">
        <DeckListing deck={deck} />
      </div>
    </details>
  );
}
